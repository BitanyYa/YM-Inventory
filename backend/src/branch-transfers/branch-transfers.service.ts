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
            select: { id: true, name: true },
          },
          product: {
            select: { id: true, name: true, brand: true, productType: true },
          },
          transferredBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.branchTransfer.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
