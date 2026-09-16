import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location, MovementType, Prisma, TrackingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AllocateProductDto } from './dto/allocate-product.dto';
import { QuerySalespersonStockDto } from './dto/query-salesperson-stock.dto';
import { QueryProductAllocationDto } from './dto/query-product-allocation.dto';
import { ReverseAllocationDto } from './dto/reverse-allocation.dto';

@Injectable()
export class SalespersonStockService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateProduct(dto: AllocateProductDto, allocatedById: string) {
    if (!dto.quantity || dto.quantity <= 0 || !Number.isInteger(dto.quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException(
        `Product "${product.name}" is inactive/soft-deleted and cannot be allocated`,
      );
    }

    if (!product.category || !product.category.allocationEnabled) {
      throw new BadRequestException(
        'Product allocation is not enabled for this category.',
      );
    }

    if (product.trackingType === TrackingType.SERIALIZED) {
      throw new BadRequestException(
        'Product allocation is only supported for QUANTITY tracked products',
      );
    }

    const salesperson = await this.prisma.salesperson.findUnique({
      where: { id: dto.salespersonId },
    });

    if (!salesperson) {
      throw new NotFoundException(
        `Salesperson with ID "${dto.salespersonId}" not found`,
      );
    }

    if (!salesperson.isActive) {
      throw new BadRequestException(
        `Salesperson "${salesperson.name}" is inactive and cannot receive stock allocations`,
      );
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { id: allocatedById },
    });

    return this.prisma.$transaction(async (tx) => {
      const shopInventory = await tx.inventory.findUnique({
        where: {
          productId_location: {
            productId: product.id,
            location: Location.SHOP,
          },
        },
      });

      if (!shopInventory || shopInventory.quantity < dto.quantity) {
        throw new BadRequestException(
          `Insufficient SHOP stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${shopInventory?.quantity || 0}`,
        );
      }

      // 1. Atomic conditional decrease of SHOP inventory
      const updateResult = await tx.inventory.updateMany({
        where: {
          productId: product.id,
          location: Location.SHOP,
          quantity: { gte: dto.quantity },
        },
        data: {
          quantity: { decrement: dto.quantity },
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          `Insufficient SHOP stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${shopInventory?.quantity || 0}`,
        );
      }

      const newShopQuantity = shopInventory.quantity - dto.quantity;

      const existingSalespersonStock = await tx.salespersonStock.findUnique({
        where: {
          salespersonId_productId: {
            salespersonId: salesperson.id,
            productId: product.id,
          },
        },
      });

      let updatedSalespersonStock;
      if (existingSalespersonStock) {
        updatedSalespersonStock = await tx.salespersonStock.update({
          where: { id: existingSalespersonStock.id },
          data: {
            quantity: { increment: dto.quantity },
          },
        });
      } else {
        updatedSalespersonStock = await tx.salespersonStock.create({
          data: {
            salespersonId: salesperson.id,
            productId: product.id,
            quantity: dto.quantity,
          },
        });
      }

      const allocation = await tx.productAllocation.create({
        data: {
          salespersonId: salesperson.id,
          productId: product.id,
          quantity: dto.quantity,
          note: dto.note ? dto.note.trim() : null,
          allocatedById,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType: MovementType.ALLOCATION,
          fromLocation: Location.SHOP,
          toLocation: null,
          quantity: dto.quantity,
          createdById: allocatedById,
          note: dto.note ? dto.note.trim() : null,
        },
      });

      return {
        id: allocation.id,
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          productType: product.productType,
        },
        salesperson: {
          id: salesperson.id,
          name: salesperson.name,
          phone: salesperson.phone,
        },
        allocatedQuantity: dto.quantity,
        salespersonBalance: updatedSalespersonStock.quantity,
        shopQuantity: newShopQuantity,
        note: allocation.note,
        allocatedBy: {
          id: adminUser?.id || allocatedById,
          name: adminUser?.name || 'Admin',
        },
        createdAt: allocation.createdAt.toISOString(),
      };
    });
  }

  async reverseAllocation(dto: ReverseAllocationDto, adminUserId: string) {
    const { allocationId, quantity, reason } = dto;

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('Reason must be a non-empty string with at least 3 characters');
    }

    const trimmedReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch original allocation
      const allocation = await tx.productAllocation.findUnique({
        where: { id: allocationId },
        include: {
          salesperson: { select: { id: true, name: true, phone: true } },
          product: { select: { id: true, name: true, brand: true, productType: true } },
          allocatedBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!allocation) {
        throw new NotFoundException(
          `Product allocation with ID "${allocationId}" not found`,
        );
      }

      if (!allocation.product) {
        throw new NotFoundException(
          `Product associated with allocation ID "${allocationId}" not found`,
        );
      }

      const remainingReversible = allocation.quantity - allocation.reversedQuantity;
      if (remainingReversible <= 0) {
        throw new BadRequestException(
          `Allocation "${allocationId}" is already fully reversed`,
        );
      }

      if (quantity > remainingReversible) {
        throw new BadRequestException(
          `Requested reversal quantity (${quantity}) exceeds remaining reversible quantity (${remainingReversible}) for allocation "${allocationId}"`,
        );
      }

      // 2. Concurrency-safe atomic reserve of reversal amount on ProductAllocation
      const allocUpdateCount = await tx.$executeRaw`
        UPDATE "ProductAllocation"
        SET "reversedQuantity" = "reversedQuantity" + ${quantity}
        WHERE "id" = ${allocationId} AND ("quantity" - "reversedQuantity") >= ${quantity}
      `;

      if (allocUpdateCount === 0) {
        throw new BadRequestException(
          `Requested reversal quantity (${quantity}) exceeds remaining reversible quantity for allocation "${allocationId}"`,
        );
      }

      // 3. Atomically reduce SalespersonStock
      const stockUpdateResult = await tx.salespersonStock.updateMany({
        where: {
          salespersonId: allocation.salespersonId,
          productId: allocation.productId,
          quantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      if (stockUpdateResult.count === 0) {
        const currentStock = await tx.salespersonStock.findUnique({
          where: {
            salespersonId_productId: {
              salespersonId: allocation.salespersonId,
              productId: allocation.productId,
            },
          },
        });
        throw new BadRequestException(
          `Salesperson "${allocation.salesperson.name}" does not currently have enough stock to reverse this amount. Requested: ${quantity}, Available: ${currentStock?.quantity || 0}`,
        );
      }

      // 4. Restore Main Shop Inventory
      const shopInventory = await tx.inventory.findUnique({
        where: {
          productId_location: {
            productId: allocation.productId,
            location: Location.SHOP,
          },
        },
      });

      if (!shopInventory) {
        throw new BadRequestException(
          `Main Shop inventory for product "${allocation.product.name}" does not exist. Reversal failed.`,
        );
      }

      await tx.inventory.update({
        where: {
          productId_location: {
            productId: allocation.productId,
            location: Location.SHOP,
          },
        },
        data: {
          quantity: { increment: quantity },
        },
      });

      // 5. Create ProductAllocationReversal record
      const reversal = await tx.productAllocationReversal.create({
        data: {
          allocationId: allocation.id,
          salespersonId: allocation.salespersonId,
          productId: allocation.productId,
          quantity,
          reason: trimmedReason,
          reversedById: adminUserId,
        },
      });

      // 6. Create StockMovement entry
      await tx.stockMovement.create({
        data: {
          productId: allocation.productId,
          movementType: MovementType.ALLOCATION_REVERSAL,
          fromLocation: null,
          toLocation: Location.SHOP,
          quantity,
          createdById: adminUserId,
          note: `Allocation Reversal: ${trimmedReason}`,
        },
      });

      // 7. Admin user info
      const adminUser = await tx.user.findUnique({
        where: { id: adminUserId },
        select: { id: true, name: true, email: true },
      });

      const totalReversedQuantity = allocation.reversedQuantity + quantity;
      const remainingReversibleQuantity = allocation.quantity - totalReversedQuantity;

      return {
        id: reversal.id,
        allocationId: allocation.id,
        salesperson: allocation.salesperson,
        product: allocation.product,
        reversedQuantity: quantity,
        originalAllocationQuantity: allocation.quantity,
        totalReversedQuantity,
        remainingReversibleQuantity,
        reason: reversal.reason,
        reversedBy: {
          id: adminUser?.id || adminUserId,
          name: adminUser?.name || 'Admin',
          email: adminUser?.email || '',
        },
        createdAt: reversal.createdAt.toISOString(),
      };
    });
  }

  async findAllStock(query: QuerySalespersonStockDto) {
    const where: Prisma.SalespersonStockWhereInput = {};

    if (query.salespersonId) {
      where.salespersonId = query.salespersonId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }

    const stocks = await this.prisma.salespersonStock.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        salesperson: {
          select: { id: true, name: true, phone: true, isActive: true },
        },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            productType: true,
            sellingPrice: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    return stocks.map((s) => ({
      id: s.id,
      salesperson: s.salesperson,
      product: {
        ...s.product,
        sellingPrice: Number(s.product.sellingPrice),
      },
      quantity: s.quantity,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async findStockBySalesperson(salespersonId: string) {
    const salesperson = await this.prisma.salesperson.findUnique({
      where: { id: salespersonId },
    });

    if (!salesperson) {
      throw new NotFoundException(
        `Salesperson with ID "${salespersonId}" not found`,
      );
    }

    const stocks = await this.prisma.salespersonStock.findMany({
      where: { salespersonId },
      orderBy: { updatedAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            productType: true,
            sellingPrice: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    return {
      salesperson: {
        id: salesperson.id,
        name: salesperson.name,
        phone: salesperson.phone,
        isActive: salesperson.isActive,
      },
      stocks: stocks.map((s) => ({
        id: s.id,
        product: {
          ...s.product,
          sellingPrice: Number(s.product.sellingPrice),
        },
        quantity: s.quantity,
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  }

  async findAllAllocations(query: QueryProductAllocationDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductAllocationWhereInput = {};

    if (query.salespersonId) {
      where.salespersonId = query.salespersonId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }

    const [allocations, total] = await Promise.all([
      this.prisma.productAllocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          salesperson: {
            select: { id: true, name: true, phone: true, isActive: true },
          },
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              category: { select: { id: true, name: true } },
            },
          },
          allocatedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          reversals: {
            select: {
              id: true,
              quantity: true,
              reason: true,
              createdAt: true,
              reversedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.productAllocation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: allocations.map((a) => ({
        id: a.id,
        salesperson: a.salesperson,
        product: a.product,
        quantity: a.quantity,
        reversedQuantity: a.reversedQuantity || 0,
        remainingQuantity: a.quantity - (a.reversedQuantity || 0),
        note: a.note,
        allocatedBy: a.allocatedBy,
        reversals: (a.reversals || []).map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
        createdAt: a.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
