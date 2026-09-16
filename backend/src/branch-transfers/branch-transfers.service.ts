import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Location, MovementType, Prisma, TrackingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchTransferDto } from './dto/create-branch-transfer.dto';
import { QueryBranchInventoryDto } from './dto/query-branch-inventory.dto';
import { QueryBranchTransferDto } from './dto/query-branch-transfer.dto';
import { ReverseBranchTransferDto } from './dto/reverse-branch-transfer.dto';

const INITIAL_BRANCHES = ['Atlas', 'Aberus', 'Garad'];

@Injectable()
export class BranchTransfersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialBranches();
  }

  /**
   * Seeds default branches (Atlas, Aberus, Garad) safely and idempotently.
   */
  async seedInitialBranches() {
    for (const name of INITIAL_BRANCHES) {
      await this.prisma.branch.upsert({
        where: { name },
        update: {},
        create: { name, isActive: true },
      });
    }
  }

  /**
   * Returns list of active branches.
   */
  async getBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Transfer product quantity from Main Shop (Location.SHOP) to a target Branch.
   * Transactional and atomic operation.
   */
  async transferToBranch(dto: CreateBranchTransferDto, transferredById: string) {
    if (!dto.quantity || dto.quantity <= 0 || !Number.isInteger(dto.quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${dto.branchId}" not found`);
    }

    if (!branch.isActive) {
      throw new BadRequestException(
        `Branch "${branch.name}" is inactive and cannot receive transfers`,
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException(
        `Product "${product.name}" is inactive and cannot be transferred`,
      );
    }

    if (product.trackingType === TrackingType.SERIALIZED) {
      throw new BadRequestException(
        'Branch transfers are only supported for QUANTITY tracked products in this version',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: transferredById },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${transferredById}" not found`);
    }

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
          `Insufficient Main Shop stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${shopInventory?.quantity || 0}`,
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
          `Insufficient Main Shop stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${shopInventory?.quantity || 0}`,
        );
      }

      const newShopQuantity = shopInventory.quantity - dto.quantity;

      // 2. Create or update BranchInventory
      const branchInventory = await tx.branchInventory.upsert({
        where: {
          branchId_productId: {
            branchId: branch.id,
            productId: product.id,
          },
        },
        update: {
          quantity: { increment: dto.quantity },
        },
        create: {
          branchId: branch.id,
          productId: product.id,
          quantity: dto.quantity,
        },
      });

      // 3. Create immutable BranchTransfer record
      const branchTransfer = await tx.branchTransfer.create({
        data: {
          branchId: branch.id,
          productId: product.id,
          quantity: dto.quantity,
          note: dto.note || null,
          transferredById: user.id,
        },
        include: {
          branch: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, brand: true } },
          transferredBy: { select: { id: true, name: true, email: true } },
        },
      });

      // 4. Create StockMovement audit record (fromLocation: SHOP, toLocation: null)
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType: MovementType.BRANCH_TRANSFER,
          fromLocation: Location.SHOP,
          toLocation: null,
          quantity: dto.quantity,
          createdById: user.id,
          note: dto.note || null,
        },
      });

      return {
        transfer: branchTransfer,
        branchInventory,
        shopInventoryQuantity: newShopQuantity,
      };
    });
  }

  /**
   * Reverse stock from a Branch back to Main Shop (Location.SHOP).
   * Transactional and atomic operation.
   */
  async reverseBranchTransfer(
    dto: ReverseBranchTransferDto,
    adminUserId: string,
  ) {
    const { branchTransferId, quantity, reason } = dto;

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException(
        'Reason must be a non-empty string with at least 3 characters',
      );
    }

    const trimmedReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch original BranchTransfer
      const branchTransfer = await tx.branchTransfer.findUnique({
        where: { id: branchTransferId },
        include: {
          branch: { select: { id: true, name: true, isActive: true } },
          product: { select: { id: true, name: true, brand: true, productType: true } },
          transferredBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!branchTransfer) {
        throw new NotFoundException(
          `Branch transfer with ID "${branchTransferId}" not found`,
        );
      }

      if (!branchTransfer.product) {
        throw new NotFoundException(
          `Product associated with branch transfer ID "${branchTransferId}" not found`,
        );
      }

      const remainingReversible = branchTransfer.quantity - branchTransfer.reversedQuantity;
      if (remainingReversible <= 0) {
        throw new BadRequestException(
          `Branch transfer "${branchTransferId}" is already fully reversed`,
        );
      }

      if (quantity > remainingReversible) {
        throw new BadRequestException(
          `Requested reversal quantity (${quantity}) exceeds remaining reversible quantity (${remainingReversible}) for branch transfer "${branchTransferId}"`,
        );
      }

      // 2. Concurrency-safe atomic reserve of reversal amount on BranchTransfer
      const transferUpdateCount = await tx.$executeRaw`
        UPDATE "BranchTransfer"
        SET "reversedQuantity" = "reversedQuantity" + ${quantity}
        WHERE "id" = ${branchTransferId} AND ("quantity" - "reversedQuantity") >= ${quantity}
      `;

      if (transferUpdateCount === 0) {
        throw new BadRequestException(
          `Requested reversal quantity (${quantity}) exceeds remaining reversible quantity for branch transfer "${branchTransferId}"`,
        );
      }

      // 3. Atomically reduce BranchInventory
      // Note: Inactive branch can still be reversed if it holds sufficient stock.
      const branchInventoryUpdate = await tx.branchInventory.updateMany({
        where: {
          branchId: branchTransfer.branchId,
          productId: branchTransfer.productId,
          quantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      if (branchInventoryUpdate.count === 0) {
        const currentBranchStock = await tx.branchInventory.findUnique({
          where: {
            branchId_productId: {
              branchId: branchTransfer.branchId,
              productId: branchTransfer.productId,
            },
          },
        });
        throw new BadRequestException(
          `Branch "${branchTransfer.branch.name}" does not currently have enough stock to reverse this amount. Requested: ${quantity}, Available: ${currentBranchStock?.quantity || 0}`,
        );
      }

      // 4. Restore Main Shop Inventory
      const shopInventory = await tx.inventory.findUnique({
        where: {
          productId_location: {
            productId: branchTransfer.productId,
            location: Location.SHOP,
          },
        },
      });

      if (!shopInventory) {
        throw new BadRequestException(
          `Main Shop inventory for product "${branchTransfer.product.name}" does not exist. Reversal failed.`,
        );
      }

      await tx.inventory.update({
        where: {
          productId_location: {
            productId: branchTransfer.productId,
            location: Location.SHOP,
          },
        },
        data: {
          quantity: { increment: quantity },
        },
      });

      // 5. Create BranchTransferReversal record
      const reversal = await tx.branchTransferReversal.create({
        data: {
          branchTransferId: branchTransfer.id,
          branchId: branchTransfer.branchId,
          productId: branchTransfer.productId,
          quantity,
          reason: trimmedReason,
          reversedById: adminUserId,
        },
      });

      // 6. Create StockMovement entry
      await tx.stockMovement.create({
        data: {
          productId: branchTransfer.productId,
          movementType: MovementType.BRANCH_TRANSFER_REVERSAL,
          fromLocation: null,
          toLocation: Location.SHOP,
          quantity,
          createdById: adminUserId,
          note: `Branch Transfer Reversal: ${trimmedReason}`,
        },
      });

      // 7. Admin user info
      const adminUser = await tx.user.findUnique({
        where: { id: adminUserId },
        select: { id: true, name: true, email: true },
      });

      const totalReversedQuantity = branchTransfer.reversedQuantity + quantity;
      const remainingReversibleQuantity = branchTransfer.quantity - totalReversedQuantity;

      return {
        id: reversal.id,
        branchTransferId: branchTransfer.id,
        branch: branchTransfer.branch,
        product: branchTransfer.product,
        reversedQuantity: quantity,
        originalTransferQuantity: branchTransfer.quantity,
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

  /**
   * Retrieves current stock across branches with optional filtering.
   */
  async getBranchInventory(query: QueryBranchInventoryDto) {
    const where: Prisma.BranchInventoryWhereInput = {};

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    return this.prisma.branchInventory.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, isActive: true },
        },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            productType: true,
            trackingType: true,
          },
        },
      },
      orderBy: [
        { branch: { name: 'asc' } },
        { product: { name: 'asc' } },
      ],
    });
  }

  /**
   * Retrieves paginated branch transfer history records, newest first.
   */
  async getBranchTransfers(query: QueryBranchTransferDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BranchTransferWhereInput = {};

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    const [data, total] = await Promise.all([
      this.prisma.branchTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: { id: true, name: true, isActive: true },
          },
          product: {
            select: { id: true, name: true, brand: true, productType: true },
          },
          transferredBy: {
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
      this.prisma.branchTransfer.count({ where }),
    ]);

    return {
      data: data.map((t) => ({
        ...t,
        reversedQuantity: t.reversedQuantity || 0,
        remainingQuantity: t.quantity - (t.reversedQuantity || 0),
        reversals: (t.reversals || []).map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
