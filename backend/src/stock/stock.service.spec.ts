import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Location, MovementType, TrackingType, UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('Physical Inventory Reconciliation Backend Tests', () => {
  let stockService: StockService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockTx = {
    inventory: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    stockBatch: {
      create: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    productUnit: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    stockMovementUnit: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    inventory: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
      ],
    }).compile();

    stockService = module.get<StockService>(StockService);
    reflector = module.get<Reflector>(Reflector);
    rolesGuard = new RolesGuard(reflector);
  });

  describe('Reconciliation Core Logic', () => {
    const mockQuantityProduct = {
      id: 'prod-qty-1',
      name: 'iPhone Charger Cable',
      trackingType: TrackingType.QUANTITY,
      isActive: true,
    };

    // Test 1: Quantity product: 20 -> physical count 18 (difference = -2)
    it('1. Quantity product: 20 -> physical count 18 should decrease inventory by 2 and create ADJUSTMENT movement', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockQuantityProduct);
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-1', quantity: 20 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-1', quantity: 18 });
      mockTx.stockMovement.create.mockResolvedValue({
        id: 'mov-1',
        movementType: MovementType.ADJUSTMENT,
        quantity: 2,
      });

      const result = await stockService.reconcileStock(
        {
          productId: 'prod-qty-1',
          location: Location.WAREHOUSE,
          actualCount: 18,
          note: 'Routine audit count',
        },
        'user-admin-1',
      );

      expect(result.reconciled).toBe(true);
      expect(result.previousQuantity).toBe(20);
      expect(result.actualCount).toBe(18);
      expect(result.difference).toBe(-2);
      expect(mockTx.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 18 },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-qty-1',
            movementType: MovementType.ADJUSTMENT,
            quantity: 2,
            fromLocation: Location.WAREHOUSE,
            toLocation: null,
            createdById: 'user-admin-1',
          }),
        }),
      );
    });

    // Test 2: Quantity product: 20 -> physical count 23 (difference = +3)
    it('2. Quantity product: 20 -> physical count 23 should increase inventory by 3 and create ADJUSTMENT movement', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockQuantityProduct);
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-1', quantity: 20 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-1', quantity: 23 });
      mockTx.stockMovement.create.mockResolvedValue({
        id: 'mov-2',
        movementType: MovementType.ADJUSTMENT,
        quantity: 3,
      });

      const result = await stockService.reconcileStock(
        {
          productId: 'prod-qty-1',
          location: Location.SHOP,
          physicalCount: 23,
          note: 'Found extra stock during audit',
        },
        'user-admin-1',
      );

      expect(result.reconciled).toBe(true);
      expect(result.previousQuantity).toBe(20);
      expect(result.actualCount).toBe(23);
      expect(result.difference).toBe(3);
      expect(mockTx.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 23 },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-qty-1',
            movementType: MovementType.ADJUSTMENT,
            quantity: 3,
            fromLocation: null,
            toLocation: Location.SHOP,
          }),
        }),
      );
    });

    // Test 3: Quantity product: 20 -> physical count 20 (zero difference)
    it('3. Quantity product: 20 -> physical count 20 should result in zero difference and no DB mutation', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockQuantityProduct);
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-1', quantity: 20 });

      const result = await stockService.reconcileStock(
        {
          productId: 'prod-qty-1',
          location: Location.WAREHOUSE,
          actualCount: 20,
        },
        'user-admin-1',
      );

      expect(result.reconciled).toBe(false);
      expect(result.difference).toBe(0);
      expect(result.previousQuantity).toBe(20);
      expect(result.actualCount).toBe(20);
      expect(mockTx.inventory.update).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    // Test 4: Invalid negative physical count
    it('4. Negative physical count (-5) should throw BadRequestException', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockQuantityProduct);

      await expect(
        stockService.reconcileStock(
          {
            productId: 'prod-qty-1',
            location: Location.WAREHOUSE,
            actualCount: -5,
          },
          'user-admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // Test 5: Nonexistent product
    it('5. Nonexistent product should throw NotFoundException', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        stockService.reconcileStock(
          {
            productId: 'nonexistent-id',
            location: Location.WAREHOUSE,
            actualCount: 10,
          },
          'user-admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Authorization & Roles', () => {
    const createMockContext = (role?: UserRole) => {
      const handler = () => {};
      return {
        getHandler: () => handler,
        getClass: () => StockController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: role ? { id: 'u-1', role } : undefined,
          }),
        }),
      } as any;
    };

    // Test 6: USER attempting reconciliation -> 403 Forbidden
    it('6. USER role attempting reconciliation should throw ForbiddenException (403)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.PRIMARY_ADMIN]);
      const mockCtx = createMockContext(UserRole.USER);

      expect(() => rolesGuard.canActivate(mockCtx)).toThrow(ForbiddenException);
    });

    // Test 7: ADMIN reconciliation succeeds
    it('7. ADMIN role reconciliation should pass authorization guard', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.PRIMARY_ADMIN]);
      const mockCtx = createMockContext(UserRole.ADMIN);

      expect(rolesGuard.canActivate(mockCtx)).toBe(true);
    });

    // Test 8: PRIMARY_ADMIN reconciliation succeeds
    it('8. PRIMARY_ADMIN role reconciliation should pass authorization guard', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.PRIMARY_ADMIN]);
      const mockCtx = createMockContext(UserRole.PRIMARY_ADMIN);

      expect(rolesGuard.canActivate(mockCtx)).toBe(true);
    });
  });

  describe('Movement Creation & Integrity', () => {
    // Test 9: Verify an ADJUSTMENT movement is created
    it('9. Verify an ADJUSTMENT movement is created with correct metadata and note', async () => {
      const mockProd = {
        id: 'prod-qty-2',
        name: 'Screen Protector',
        trackingType: TrackingType.QUANTITY,
        isActive: true,
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProd);
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-2', quantity: 50 });
      mockTx.inventory.update.mockResolvedValue({ id: 'inv-2', quantity: 45 });
      mockTx.stockMovement.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'mov-adj-9', ...data }),
      );

      const res = await stockService.reconcileStock(
        {
          productId: 'prod-qty-2',
          location: Location.WAREHOUSE,
          actualCount: 45,
          note: 'Annual physical inventory audit',
        },
        'admin-user-id',
      );

      expect(res.movement.movementType).toBe(MovementType.ADJUSTMENT);
      expect(res.movement.quantity).toBe(5);
      expect(res.movement.fromLocation).toBe(Location.WAREHOUSE);
      expect(res.movement.createdById).toBe('admin-user-id');
      expect(res.movement.note).toBe('Annual physical inventory audit (Reconciled from 50 to 45, diff: -5)');
    });

    // Test 10: Verify existing stock operations remain unaffected
    it('10. Existing receiveStock logic remains functional and unaffected', async () => {
      const mockProd = {
        id: 'prod-qty-3',
        name: 'USB Adapter',
        trackingType: TrackingType.QUANTITY,
        isActive: true,
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProd);
      mockTx.stockBatch.create.mockResolvedValue({ id: 'batch-1' });
      mockTx.inventory.findUnique.mockResolvedValue(null);
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-3', quantity: 100 });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'mov-recv-10', movementType: MovementType.STOCK_IN });

      const res = await stockService.receiveStock(
        {
          productId: 'prod-qty-3',
          quantity: 100,
          purchasePrice: 5.5,
          note: 'Supplier shipment',
        },
        'admin-user-id',
      );

      expect(res).toBeDefined();
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-qty-3' },
      });
    });
  });
});
