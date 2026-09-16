import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Location, MovementType, ProductType, TrackingType, UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { BranchTransfersService } from './branch-transfers.service';
import { BranchTransfersController } from './branch-transfers.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('BranchTransfersService Unit Tests', () => {
  let service: BranchTransfersService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockAtlasBranch = {
    id: 'branch-atlas-id',
    name: 'Atlas',
    isActive: true,
  };

  const mockAberusBranch = {
    id: 'branch-aberus-id',
    name: 'Aberus',
    isActive: true,
  };

  const mockGaradBranch = {
    id: 'branch-garad-id',
    name: 'Garad',
    isActive: true,
  };

  const mockInactiveBranch = {
    id: 'branch-inactive-id',
    name: 'Closed Branch',
    isActive: false,
  };

  const mockAdminUser = {
    id: 'user-admin-id',
    name: 'Admin User',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const mockMattPrivacyProduct = {
    id: 'prod-matt-id',
    name: 'Matt Privacy Screen Protector',
    brand: 'Generic',
    productType: ProductType.ACCESSORY,
    trackingType: TrackingType.QUANTITY,
    isActive: true,
  };

  const mockSerializedProduct = {
    id: 'prod-iphone-id',
    name: 'iPhone 15 Pro',
    brand: 'Apple',
    productType: ProductType.PHONE,
    trackingType: TrackingType.SERIALIZED,
    isActive: true,
  };

  const mockInactiveProduct = {
    id: 'prod-inactive-id',
    name: 'Old Case',
    brand: 'Generic',
    productType: ProductType.ACCESSORY,
    trackingType: TrackingType.QUANTITY,
    isActive: false,
  };

  const mockTx = {
    inventory: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    branchInventory: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    branchTransfer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    branchTransferReversal: {
      create: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  const mockPrismaService = {
    branch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    inventory: {
      findUnique: jest.fn(),
    },
    branchInventory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    branchTransfer: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchTransfersService,
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
      ],
    }).compile();

    service = module.get<BranchTransfersService>(BranchTransfersService);
    reflector = module.get<Reflector>(Reflector);
    rolesGuard = new RolesGuard(reflector);
  });

  describe('1. Successful Main Shop -> Atlas transfer', () => {
    it('should transfer stock to Atlas branch successfully', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 60 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });

      mockTx.branchInventory.upsert.mockResolvedValue({
        id: 'bi-atlas-1',
        branchId: mockAtlasBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 20,
      });

      mockTx.branchTransfer.create.mockResolvedValue({
        id: 'bt-1',
        branchId: mockAtlasBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 20,
        note: 'Atlas initial',
        transferredById: mockAdminUser.id,
      });

      const result = await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
          note: 'Atlas initial',
        },
        mockAdminUser.id,
      );

      expect(result.transfer.id).toBe('bt-1');
      expect(result.branchInventory.quantity).toBe(20);
      expect(result.shopInventoryQuantity).toBe(40);
    });
  });

  describe('2. Successful Main Shop -> Aberus transfer', () => {
    it('should transfer stock to Aberus branch successfully', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAberusBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 25 });

      mockTx.branchInventory.upsert.mockResolvedValue({
        id: 'bi-aberus-1',
        branchId: mockAberusBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 15,
      });

      mockTx.branchTransfer.create.mockResolvedValue({
        id: 'bt-2',
        branchId: mockAberusBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 15,
        transferredById: mockAdminUser.id,
      });

      const result = await service.transferToBranch(
        {
          branchId: mockAberusBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 15,
        },
        mockAdminUser.id,
      );

      expect(result.transfer.id).toBe('bt-2');
      expect(result.branchInventory.quantity).toBe(15);
      expect(result.shopInventoryQuantity).toBe(25);
    });
  });

  describe('3. Successful Main Shop -> Garad transfer', () => {
    it('should transfer stock to Garad branch successfully', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockGaradBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 25 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 15 });

      mockTx.branchInventory.upsert.mockResolvedValue({
        id: 'bi-garad-1',
        branchId: mockGaradBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 10,
      });

      mockTx.branchTransfer.create.mockResolvedValue({
        id: 'bt-3',
        branchId: mockGaradBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 10,
        transferredById: mockAdminUser.id,
      });

      const result = await service.transferToBranch(
        {
          branchId: mockGaradBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 10,
        },
        mockAdminUser.id,
      );

      expect(result.transfer.id).toBe('bt-3');
      expect(result.branchInventory.quantity).toBe(10);
      expect(result.shopInventoryQuantity).toBe(15);
    });
  });

  describe('4. Main Shop stock decreases correctly', () => {
    it('should decrement SHOP inventory by exact transferred amount', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 100 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 70 });
      mockTx.branchInventory.upsert.mockResolvedValue({});
      mockTx.branchTransfer.create.mockResolvedValue({});

      await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 30,
        },
        mockAdminUser.id,
      );

      expect(mockTx.inventory.updateMany).toHaveBeenCalledWith({
        where: {
          productId: mockMattPrivacyProduct.id,
          location: Location.SHOP,
          quantity: { gte: 30 },
        },
        data: { quantity: { decrement: 30 } },
      });
    });
  });

  describe('5. Branch stock increases correctly', () => {
    it('should increment BranchInventory quantity by exact transferred amount', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 50 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 30 });
      mockTx.branchInventory.upsert.mockResolvedValue({});
      mockTx.branchTransfer.create.mockResolvedValue({});

      await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
        },
        mockAdminUser.id,
      );

      expect(mockTx.branchInventory.upsert).toHaveBeenCalledWith({
        where: {
          branchId_productId: {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
          },
        },
        update: {
          quantity: { increment: 20 },
        },
        create: {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
        },
      });
    });
  });

  describe('6. Repeated transfer increases existing BranchInventory', () => {
    it('should use upsert to increment existing BranchInventory record rather than duplicating', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 25 });
      mockTx.branchInventory.upsert.mockResolvedValue({
        id: 'bi-atlas-1',
        branchId: mockAtlasBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 35, // 20 previous + 15 new
      });
      mockTx.branchTransfer.create.mockResolvedValue({});

      const result = await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 15,
        },
        mockAdminUser.id,
      );

      expect(mockTx.branchInventory.upsert).toHaveBeenCalled();
      expect(result.branchInventory.quantity).toBe(35);
    });
  });

  describe('7. Each transfer creates a separate BranchTransfer history record', () => {
    it('should create a new immutable BranchTransfer record on each call', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 50 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 30 });
      mockTx.branchInventory.upsert.mockResolvedValue({});
      mockTx.branchTransfer.create.mockResolvedValue({ id: 'bt-unique-123' });

      await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
          note: 'Second transfer',
        },
        mockAdminUser.id,
      );

      expect(mockTx.branchTransfer.create).toHaveBeenCalledWith({
        data: {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
          note: 'Second transfer',
          transferredById: mockAdminUser.id,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('8. Each transfer creates a BRANCH_TRANSFER StockMovement', () => {
    it('should create StockMovement with movementType BRANCH_TRANSFER and fromLocation SHOP', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 50 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 30 });
      mockTx.branchInventory.upsert.mockResolvedValue({});
      mockTx.branchTransfer.create.mockResolvedValue({});

      await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
          note: 'Audit note',
        },
        mockAdminUser.id,
      );

      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: mockMattPrivacyProduct.id,
          movementType: MovementType.BRANCH_TRANSFER,
          fromLocation: Location.SHOP,
          toLocation: null,
          quantity: 20,
          createdById: mockAdminUser.id,
          note: 'Audit note',
        },
      });
    });
  });

  describe('9. Insufficient Main Shop stock is rejected', () => {
    it('should throw BadRequestException when SHOP inventory is less than requested quantity', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 5 });

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: 20,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.inventory.updateMany).not.toHaveBeenCalled();
      expect(mockTx.branchInventory.upsert).not.toHaveBeenCalled();
      expect(mockTx.branchTransfer.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when atomic updateMany returns 0 affected rows (simulating concurrent overspending)', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 20 });
      mockTx.inventory.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: 20,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.branchInventory.upsert).not.toHaveBeenCalled();
      expect(mockTx.branchTransfer.create).not.toHaveBeenCalled();
    });
  });

  describe('10. Inactive product is rejected', () => {
    it('should throw BadRequestException if product is inactive', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockInactiveProduct);

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockInactiveProduct.id,
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('11. Serialized product is rejected', () => {
    it('should throw BadRequestException if product is SERIALIZED', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockSerializedProduct);

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockSerializedProduct.id,
            quantity: 1,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('12. Invalid branch is rejected', () => {
    it('should throw NotFoundException if branchId does not exist', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(null);

      await expect(
        service.transferToBranch(
          {
            branchId: 'invalid-branch-id',
            productId: mockMattPrivacyProduct.id,
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('13. Inactive branch is rejected', () => {
    it('should throw BadRequestException if branch is inactive', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockInactiveBranch);

      await expect(
        service.transferToBranch(
          {
            branchId: mockInactiveBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('14. Non-positive quantity is rejected', () => {
    it('should throw BadRequestException for zero, negative, and decimal quantities', async () => {
      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: 0,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: -10,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: 5.5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('15. Transaction rollback works if a later operation fails', () => {
    it('should rollback transaction if BranchTransfer.create fails', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 50 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 30 });
      mockTx.branchInventory.upsert.mockResolvedValue({});
      mockTx.branchTransfer.create.mockRejectedValue(new Error('Database write error'));

      await expect(
        service.transferToBranch(
          {
            branchId: mockAtlasBranch.id,
            productId: mockMattPrivacyProduct.id,
            quantity: 20,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow('Database write error');
    });
  });

  describe('16. ADMIN authorization is enforced for transfers', () => {
    it('should allow ADMIN role for transfer endpoint', () => {
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: UserRole.ADMIN },
          }),
        }),
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('should deny USER role for transfer endpoint', () => {
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: UserRole.USER },
          }),
        }),
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('17. Branch-to-branch transfers are not possible through the API', () => {
    it('should only accept destination branchId, always taking source from SHOP', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockAtlasBranch);
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 50 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 30 });
      mockTx.branchInventory.upsert.mockResolvedValue({});
      mockTx.branchTransfer.create.mockResolvedValue({});

      // CreateBranchTransferDto has no sourceBranchId parameter
      await service.transferToBranch(
        {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
        },
        mockAdminUser.id,
      );

      // Verify that stock was decremented specifically from Location.SHOP
      expect(mockTx.inventory.findUnique).toHaveBeenCalledWith({
        where: {
          productId_location: {
            productId: mockMattPrivacyProduct.id,
            location: Location.SHOP,
          },
        },
      });

      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromLocation: Location.SHOP,
          toLocation: null,
        }),
      });
    });
  });

  describe('18. Branch Transfer Reversals', () => {
    const mockBranchTransfer = {
      id: 'bt-101',
      branchId: mockAtlasBranch.id,
      productId: mockMattPrivacyProduct.id,
      quantity: 20,
      reversedQuantity: 0,
      branch: mockAtlasBranch,
      product: mockMattPrivacyProduct,
      transferredById: mockAdminUser.id,
      transferredBy: mockAdminUser,
    };

    beforeEach(() => {
      mockTx.branchTransfer.findUnique.mockReset();
      mockTx.$executeRaw.mockResolvedValue(1);
      mockTx.branchInventory.updateMany.mockResolvedValue({ count: 1 });
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 45 });
      mockTx.branchTransferReversal.create.mockResolvedValue({
        id: 'btr-201',
        branchTransferId: 'bt-101',
        branchId: mockAtlasBranch.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 5,
        reason: 'Excessive stock sent to Atlas',
        reversedById: mockAdminUser.id,
        createdAt: new Date('2026-09-16T12:00:00Z'),
      });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'mov-401' });
      mockTx.user.findUnique.mockResolvedValue(mockAdminUser);
    });

    it('should perform a successful partial branch transfer reversal (5 of 20)', async () => {
      mockTx.branchTransfer.findUnique
        .mockResolvedValueOnce(mockBranchTransfer)
        .mockResolvedValueOnce({ ...mockBranchTransfer, reversedQuantity: 5 });

      const result = await service.reverseBranchTransfer(
        {
          branchTransferId: 'bt-101',
          quantity: 5,
          reason: 'Excessive stock sent to Atlas',
        },
        mockAdminUser.id,
      );

      expect(result.id).toBe('btr-201');
      expect(result.reversedQuantity).toBe(5);
      expect(result.originalTransferQuantity).toBe(20);
      expect(result.totalReversedQuantity).toBe(5);
      expect(result.remainingReversibleQuantity).toBe(15);

      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockTx.branchInventory.updateMany).toHaveBeenCalledWith({
        where: {
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: { gte: 5 },
        },
        data: { quantity: { decrement: 5 } },
      });
      expect(mockTx.inventory.update).toHaveBeenCalledWith({
        where: {
          productId_location: {
            productId: mockMattPrivacyProduct.id,
            location: Location.SHOP,
          },
        },
        data: { quantity: { increment: 5 } },
      });
      expect(mockTx.branchTransferReversal.create).toHaveBeenCalledWith({
        data: {
          branchTransferId: 'bt-101',
          branchId: mockAtlasBranch.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 5,
          reason: 'Excessive stock sent to Atlas',
          reversedById: mockAdminUser.id,
        },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: mockMattPrivacyProduct.id,
          movementType: MovementType.BRANCH_TRANSFER_REVERSAL,
          fromLocation: null,
          toLocation: Location.SHOP,
          quantity: 5,
          createdById: mockAdminUser.id,
          note: 'Branch Transfer Reversal: Excessive stock sent to Atlas',
        },
      });
    });

    it('should perform a successful full branch transfer reversal (20 of 20)', async () => {
      mockTx.branchTransfer.findUnique
        .mockResolvedValueOnce(mockBranchTransfer)
        .mockResolvedValueOnce({ ...mockBranchTransfer, reversedQuantity: 20 });

      const result = await service.reverseBranchTransfer(
        {
          branchTransferId: 'bt-101',
          quantity: 20,
          reason: 'Full transfer reversal',
        },
        mockAdminUser.id,
      );

      expect(result.reversedQuantity).toBe(20);
      expect(result.totalReversedQuantity).toBe(20);
      expect(result.remainingReversibleQuantity).toBe(0);
    });

    it('should support multiple partial reversals until remaining is 0', async () => {
      const partiallyReversedBt = { ...mockBranchTransfer, reversedQuantity: 5 };
      mockTx.branchTransfer.findUnique
        .mockResolvedValueOnce(partiallyReversedBt)
        .mockResolvedValueOnce({ ...mockBranchTransfer, reversedQuantity: 15 });

      const result = await service.reverseBranchTransfer(
        {
          branchTransferId: 'bt-101',
          quantity: 10,
          reason: 'Second partial transfer reversal',
        },
        mockAdminUser.id,
      );

      expect(result.totalReversedQuantity).toBe(15);
      expect(result.remainingReversibleQuantity).toBe(5);
    });

    it('should allow reversal from an INACTIVE branch if sufficient stock exists', async () => {
      const inactiveBranchTransfer = {
        ...mockBranchTransfer,
        branch: mockInactiveBranch,
      };
      mockTx.branchTransfer.findUnique
        .mockResolvedValueOnce(inactiveBranchTransfer)
        .mockResolvedValueOnce({ ...inactiveBranchTransfer, reversedQuantity: 5 });

      const result = await service.reverseBranchTransfer(
        {
          branchTransferId: 'bt-101',
          quantity: 5,
          reason: 'Recovering stock from closed branch',
        },
        mockAdminUser.id,
      );

      expect(result.branch.id).toBe(mockInactiveBranch.id);
      expect(result.reversedQuantity).toBe(5);
    });

    it('should reject reversing more than remaining unreversed quantity', async () => {
      const partiallyReversedBt = { ...mockBranchTransfer, reversedQuantity: 15 };
      mockTx.branchTransfer.findUnique.mockResolvedValue(partiallyReversedBt);

      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: 10,
            reason: 'Excessive transfer reversal',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversal if transfer is already fully reversed', async () => {
      const fullyReversedBt = { ...mockBranchTransfer, reversedQuantity: 20 };
      mockTx.branchTransfer.findUnique.mockResolvedValue(fullyReversedBt);

      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: 1,
            reason: 'Try reversing fully reversed transfer',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversal if branch has insufficient stock to prevent negative balance', async () => {
      mockTx.branchTransfer.findUnique.mockResolvedValue(mockBranchTransfer);
      mockTx.branchInventory.updateMany.mockResolvedValue({ count: 0 });
      mockTx.branchInventory.findUnique.mockResolvedValue({ quantity: 2 });

      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: 10,
            reason: 'Branch holds only 2 items',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversal if atomic executeRaw returns 0 (concurrent over-reversal protection)', async () => {
      mockTx.branchTransfer.findUnique.mockResolvedValue(mockBranchTransfer);
      mockTx.$executeRaw.mockResolvedValue(0);

      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: 5,
            reason: 'Concurrent race test',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if SHOP inventory record does not exist', async () => {
      mockTx.branchTransfer.findUnique.mockResolvedValue(mockBranchTransfer);
      mockTx.inventory.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: 5,
            reason: 'Missing shop inventory',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if branchTransferId does not exist', async () => {
      mockTx.branchTransfer.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'nonexistent-id',
            quantity: 5,
            reason: 'Nonexistent transfer test',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if reason is missing or shorter than 3 chars', async () => {
      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: 5,
            reason: '  ',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if quantity is non-positive or non-integer', async () => {
      await expect(
        service.reverseBranchTransfer(
          {
            branchTransferId: 'bt-101',
            quantity: -5,
            reason: 'Negative quantity test',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
