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
    },
    branchTransfer: {
      create: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
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
});
