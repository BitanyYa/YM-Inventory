import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Location, MovementType, ProductType, TrackingType, UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { SalespersonStockService } from './salesperson-stock.service';
import { SalespersonStockController } from './salesperson-stock.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('SalespersonStockService Unit Tests', () => {
  let service: SalespersonStockService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockTx = {
    inventory: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    salespersonStock: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    productAllocation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    productAllocationReversal: {
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
    product: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    salesperson: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inventory: {
      findUnique: jest.fn(),
    },
    salespersonStock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    productAllocation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  const mockAdminUser = {
    id: 'user-admin-id',
    name: 'Admin User',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const mockSalespersonAbel = {
    id: 'salesperson-abel-id',
    name: 'Abel',
    phone: '0911000000',
    isActive: true,
  };

  const mockSalespersonHana = {
    id: 'salesperson-hana-id',
    name: 'Hana',
    phone: '0922000000',
    isActive: true,
  };

  const mockScreenProtectorCategory = {
    id: 'cat-sp-id',
    name: 'Screen Protector',
    allocationEnabled: true,
  };

  const mockDisabledCategory = {
    id: 'cat-cases-id',
    name: 'Cases',
    allocationEnabled: false,
  };

  const mockMattPrivacyProduct = {
    id: 'prod-matt-id',
    name: 'Matt Privacy Screen Protector',
    brand: 'Generic',
    productType: ProductType.ACCESSORY,
    trackingType: TrackingType.QUANTITY,
    categoryId: 'cat-sp-id',
    category: mockScreenProtectorCategory,
    isActive: true,
  };

  const mockDisabledCategoryProduct = {
    id: 'prod-case-id',
    name: 'Silicone Case',
    brand: 'Generic',
    productType: ProductType.ACCESSORY,
    trackingType: TrackingType.QUANTITY,
    categoryId: 'cat-cases-id',
    category: mockDisabledCategory,
    isActive: true,
  };

  const mockSerializedProduct = {
    id: 'prod-iphone-id',
    name: 'iPhone 15 Pro',
    brand: 'Apple',
    productType: ProductType.PHONE,
    trackingType: TrackingType.SERIALIZED,
    categoryId: 'cat-sp-id',
    category: mockScreenProtectorCategory,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalespersonStockService,
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
      ],
    }).compile();

    service = module.get<SalespersonStockService>(SalespersonStockService);
    reflector = module.get<Reflector>(Reflector);
    rolesGuard = new RolesGuard(reflector);
  });

  describe('1. Successful allocation', () => {
    it('should allocate 20 items from SHOP (60 -> 40) to Abel (0 -> 20)', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue(mockSalespersonAbel);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 60 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });

      mockTx.salespersonStock.findUnique.mockResolvedValue(null);
      mockTx.salespersonStock.create.mockResolvedValue({
        id: 'sp-stock-1',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 20,
      });

      mockTx.productAllocation.create.mockResolvedValue({
        id: 'alloc-1',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 20,
        note: 'First batch',
        allocatedById: mockAdminUser.id,
        createdAt: new Date('2026-09-14T10:00:00Z'),
      });

      const result = await service.allocateProduct(
        {
          productId: mockMattPrivacyProduct.id,
          salespersonId: mockSalespersonAbel.id,
          quantity: 20,
          note: 'First batch',
        },
        mockAdminUser.id,
      );

      expect(result.allocatedQuantity).toBe(20);
      expect(result.salespersonBalance).toBe(20);
      expect(result.shopQuantity).toBe(40);
      expect(mockTx.inventory.updateMany).toHaveBeenCalledWith({
        where: {
          productId: mockMattPrivacyProduct.id,
          location: Location.SHOP,
          quantity: { gte: 20 },
        },
        data: { quantity: { decrement: 20 } },
      });
      expect(mockTx.salespersonStock.create).toHaveBeenCalledWith({
        data: {
          salespersonId: mockSalespersonAbel.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
        },
      });
      expect(mockTx.productAllocation.create).toHaveBeenCalledWith({
        data: {
          salespersonId: mockSalespersonAbel.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 20,
          note: 'First batch',
          allocatedById: mockAdminUser.id,
        },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: mockMattPrivacyProduct.id,
          movementType: MovementType.ALLOCATION,
          fromLocation: Location.SHOP,
          toLocation: null,
          quantity: 20,
          createdById: mockAdminUser.id,
          note: 'First batch',
        },
      });
    });
  });

  describe('2. Repeated allocation', () => {
    it('should increment Abel balance from 20 -> 35 when allocating an additional 15 items', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue(mockSalespersonAbel);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 25 });

      mockTx.salespersonStock.findUnique.mockResolvedValue({
        id: 'sp-stock-1',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 20,
      });

      mockTx.salespersonStock.update.mockResolvedValue({
        id: 'sp-stock-1',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 35,
      });

      mockTx.productAllocation.create.mockResolvedValue({
        id: 'alloc-2',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 15,
        allocatedById: mockAdminUser.id,
        createdAt: new Date('2026-09-14T11:00:00Z'),
      });

      const result = await service.allocateProduct(
        {
          productId: mockMattPrivacyProduct.id,
          salespersonId: mockSalespersonAbel.id,
          quantity: 15,
        },
        mockAdminUser.id,
      );

      expect(result.allocatedQuantity).toBe(15);
      expect(result.salespersonBalance).toBe(35);
      expect(result.shopQuantity).toBe(25);
      expect(mockTx.salespersonStock.update).toHaveBeenCalledWith({
        where: { id: 'sp-stock-1' },
        data: { quantity: { increment: 15 } },
      });
    });
  });

  describe('3. Different salesperson', () => {
    it('should maintain separate balances for Abel (20) and Hana (10)', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue(mockSalespersonHana);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 25 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 15 });

      mockTx.salespersonStock.findUnique.mockResolvedValue(null);
      mockTx.salespersonStock.create.mockResolvedValue({
        id: 'sp-stock-2',
        salespersonId: mockSalespersonHana.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 10,
      });

      mockTx.productAllocation.create.mockResolvedValue({
        id: 'alloc-3',
        salespersonId: mockSalespersonHana.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 10,
        allocatedById: mockAdminUser.id,
        createdAt: new Date(),
      });

      const result = await service.allocateProduct(
        {
          productId: mockMattPrivacyProduct.id,
          salespersonId: mockSalespersonHana.id,
          quantity: 10,
        },
        mockAdminUser.id,
      );

      expect(result.salesperson.id).toBe(mockSalespersonHana.id);
      expect(result.salespersonBalance).toBe(10);
    });
  });

  describe('4. Insufficient shop stock', () => {
    it('should reject allocation when SHOP stock (10) < requested (15)', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue(mockSalespersonAbel);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 10 });

      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 15,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.inventory.updateMany).not.toHaveBeenCalled();
      expect(mockTx.salespersonStock.create).not.toHaveBeenCalled();
      expect(mockTx.productAllocation.create).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when atomic updateMany returns 0 affected rows (simulating concurrent overspending)', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue(mockSalespersonAbel);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 15 });
      mockTx.inventory.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 15,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.salespersonStock.create).not.toHaveBeenCalled();
      expect(mockTx.productAllocation.create).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('5. Allocation disabled for category', () => {
    it('should reject allocation if category allocationEnabled === false', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockDisabledCategoryProduct);

      await expect(
        service.allocateProduct(
          {
            productId: mockDisabledCategoryProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Serialized product', () => {
    it('should reject allocation if product trackingType === SERIALIZED', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockSerializedProduct);

      await expect(
        service.allocateProduct(
          {
            productId: mockSerializedProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 1,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('7. Inactive product', () => {
    it('should reject allocation if product isActive === false', async () => {
      const inactiveProduct = {
        ...mockMattPrivacyProduct,
        isActive: false,
      };
      mockPrismaService.product.findUnique.mockResolvedValue(inactiveProduct);

      await expect(
        service.allocateProduct(
          {
            productId: inactiveProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('8. Invalid quantity', () => {
    it('should reject 0, negative, and decimal quantities', async () => {
      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 0,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: -5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 2.5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('9. Nonexistent salesperson', () => {
    it('should throw NotFoundException if salespersonId is invalid', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue(null);

      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: 'invalid-salesperson-id',
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('10. Inactive salesperson', () => {
    it('should throw BadRequestException if salesperson is inactive', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockMattPrivacyProduct);
      mockPrismaService.salesperson.findUnique.mockResolvedValue({
        ...mockSalespersonAbel,
        isActive: false,
      });

      await expect(
        service.allocateProduct(
          {
            productId: mockMattPrivacyProduct.id,
            salespersonId: mockSalespersonAbel.id,
            quantity: 5,
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('11. Authorization & RolesGuard', () => {
    it('should allow ADMIN users for allocate endpoint', () => {
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

    it('should deny USER role for allocate endpoint', () => {
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

  describe('12. Salesperson Allocation Reversal', () => {
    const mockAllocation = {
      id: 'alloc-101',
      salespersonId: mockSalespersonAbel.id,
      productId: mockMattPrivacyProduct.id,
      quantity: 20,
      reversedQuantity: 0,
      salesperson: mockSalespersonAbel,
      product: mockMattPrivacyProduct,
      allocatedById: mockAdminUser.id,
      allocatedBy: mockAdminUser,
    };

    beforeEach(() => {
      mockTx.productAllocation.findUnique.mockReset();
      mockTx.$executeRaw.mockResolvedValue(1);
      mockTx.salespersonStock.updateMany.mockResolvedValue({ count: 1 });
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-shop-1', quantity: 40 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-shop-1', quantity: 45 });
      mockTx.productAllocationReversal.create.mockResolvedValue({
        id: 'rev-201',
        allocationId: 'alloc-101',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 5,
        reason: 'Correction of over-allocation',
        reversedById: mockAdminUser.id,
        createdAt: new Date('2026-09-16T12:00:00Z'),
      });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'mov-301' });
      mockTx.user.findUnique.mockResolvedValue(mockAdminUser);
    });

    it('should perform a successful partial reversal (5 of 20)', async () => {
      mockTx.productAllocation.findUnique
        .mockResolvedValueOnce(mockAllocation)
        .mockResolvedValueOnce({ ...mockAllocation, reversedQuantity: 5 });

      const result = await service.reverseAllocation(
        {
          allocationId: 'alloc-101',
          quantity: 5,
          reason: 'Correction of over-allocation',
        },
        mockAdminUser.id,
      );

      expect(result.id).toBe('rev-201');
      expect(result.reversedQuantity).toBe(5);
      expect(result.originalAllocationQuantity).toBe(20);
      expect(result.totalReversedQuantity).toBe(5);
      expect(result.remainingReversibleQuantity).toBe(15);

      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockTx.salespersonStock.updateMany).toHaveBeenCalledWith({
        where: {
          salespersonId: mockSalespersonAbel.id,
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
      expect(mockTx.productAllocationReversal.create).toHaveBeenCalledWith({
        data: {
          allocationId: 'alloc-101',
          salespersonId: mockSalespersonAbel.id,
          productId: mockMattPrivacyProduct.id,
          quantity: 5,
          reason: 'Correction of over-allocation',
          reversedById: mockAdminUser.id,
        },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: mockMattPrivacyProduct.id,
          movementType: MovementType.ALLOCATION_REVERSAL,
          fromLocation: null,
          toLocation: Location.SHOP,
          quantity: 5,
          createdById: mockAdminUser.id,
          note: 'Allocation Reversal: Correction of over-allocation',
        },
      });
    });

    it('should perform a successful full reversal (20 of 20)', async () => {
      mockTx.productAllocation.findUnique
        .mockResolvedValueOnce(mockAllocation)
        .mockResolvedValueOnce({ ...mockAllocation, reversedQuantity: 20 });
      mockTx.productAllocationReversal.create.mockResolvedValue({
        id: 'rev-202',
        allocationId: 'alloc-101',
        salespersonId: mockSalespersonAbel.id,
        productId: mockMattPrivacyProduct.id,
        quantity: 20,
        reason: 'Full allocation reversal',
        reversedById: mockAdminUser.id,
        createdAt: new Date('2026-09-16T12:00:00Z'),
      });

      const result = await service.reverseAllocation(
        {
          allocationId: 'alloc-101',
          quantity: 20,
          reason: 'Full allocation reversal',
        },
        mockAdminUser.id,
      );

      expect(result.reversedQuantity).toBe(20);
      expect(result.totalReversedQuantity).toBe(20);
      expect(result.remainingReversibleQuantity).toBe(0);
    });

    it('should support multiple partial reversals until remaining is 0', async () => {
      // First reversal of 5 already done, now reversing 10 more
      const partiallyReversedAlloc = { ...mockAllocation, reversedQuantity: 5 };
      mockTx.productAllocation.findUnique
        .mockResolvedValueOnce(partiallyReversedAlloc)
        .mockResolvedValueOnce({ ...mockAllocation, reversedQuantity: 15 });

      const result = await service.reverseAllocation(
        {
          allocationId: 'alloc-101',
          quantity: 10,
          reason: 'Second partial reversal',
        },
        mockAdminUser.id,
      );

      expect(result.totalReversedQuantity).toBe(15);
      expect(result.remainingReversibleQuantity).toBe(5);
    });

    it('should reject reversing more than remaining unreversed quantity', async () => {
      const partiallyReversedAlloc = { ...mockAllocation, reversedQuantity: 15 };
      mockTx.productAllocation.findUnique.mockResolvedValue(partiallyReversedAlloc);

      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: 10,
            reason: 'Excessive reversal',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversal if allocation is already fully reversed', async () => {
      const fullyReversedAlloc = { ...mockAllocation, reversedQuantity: 20 };
      mockTx.productAllocation.findUnique.mockResolvedValue(fullyReversedAlloc);

      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: 1,
            reason: 'Try reversing fully reversed',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversal if salesperson has insufficient stock to prevent negative balance', async () => {
      mockTx.productAllocation.findUnique.mockResolvedValue(mockAllocation);
      mockTx.salespersonStock.updateMany.mockResolvedValue({ count: 0 });
      mockTx.salespersonStock.findUnique.mockResolvedValue({ quantity: 2 });

      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: 10,
            reason: 'Salesperson holds only 2 items',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversal if atomic executeRaw returns 0 (concurrent over-reversal protection)', async () => {
      mockTx.productAllocation.findUnique.mockResolvedValue(mockAllocation);
      mockTx.$executeRaw.mockResolvedValue(0);

      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: 5,
            reason: 'Concurrent race test',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if SHOP inventory record does not exist', async () => {
      mockTx.productAllocation.findUnique.mockResolvedValue(mockAllocation);
      mockTx.inventory.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: 5,
            reason: 'Missing shop inventory',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if allocation ID does not exist', async () => {
      mockTx.productAllocation.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseAllocation(
          {
            allocationId: 'nonexistent-id',
            quantity: 5,
            reason: 'Nonexistent allocation test',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if reason is missing or shorter than 3 chars', async () => {
      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: 5,
            reason: '  ',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if quantity is non-positive or non-integer', async () => {
      await expect(
        service.reverseAllocation(
          {
            allocationId: 'alloc-101',
            quantity: -5,
            reason: 'Negative quantity test',
          },
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
