import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location, MovementType, Prisma, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { SellStockDto } from './dto/sell-stock.dto';
import { ReturnStockDto } from './dto/return-stock.dto';
import { QueryStockMovementDto } from './dto/query-stock-movement.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryStockTransferDto } from './dto/query-stock-transfer.dto';
import { QueryStockReceiptDto } from './dto/query-stock-receipt.dto';
import { QueryStockSaleDto } from './dto/query-stock-sale.dto';
import { QueryStockReturnDto } from './dto/query-stock-return.dto';
import { QueryMovementSummaryDto } from './dto/query-movement-summary.dto';
import { DamageStockDto } from './dto/damage-stock.dto';
import { LossStockDto } from './dto/loss-stock.dto';
import { QueryStockInDto } from './dto/query-stock-in.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async receiveStock(dto: ReceiveStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.reference) {
        const existingBatch = await tx.stockBatch.findFirst({
          where: { reference: dto.reference },
        });

        if (existingBatch) {
          throw new ConflictException(
            `Stock batch reference "${dto.reference}" already exists`,
          );
        }
      }

      const batch = await tx.stockBatch.create({
        data: {
          reference: dto.reference || null,
          note: dto.note || null,
          createdById: userId,
        },
      });

      let updatedInventory;
      let quantityReceived = 0;

      if (product.trackingType === TrackingType.QUANTITY) {
        if (!dto.quantity || dto.quantity <= 0) {
          throw new BadRequestException(
            'Quantity is required and must be greater than 0 for QUANTITY tracked products',
          );
        }
        if (!dto.purchasePrice || dto.purchasePrice <= 0) {
          throw new BadRequestException(
            'Purchase price is required and must be greater than 0 for QUANTITY tracked products',
          );
        }

        quantityReceived = dto.quantity;

        const existingInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.WAREHOUSE,
            },
          },
        });

        if (existingInventory) {
          updatedInventory = await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: { increment: dto.quantity },
            },
          });
        } else {
          updatedInventory = await tx.inventory.create({
            data: {
              productId: product.id,
              location: Location.WAREHOUSE,
              quantity: dto.quantity,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.STOCK_IN,
            quantity: dto.quantity,
            toLocation: Location.WAREHOUSE,
            costPrice: dto.purchasePrice,
            stockBatchId: batch.id,
            createdById: userId,
            note: dto.note || null,
          },
        });
      } else if (product.trackingType === TrackingType.SERIALIZED) {
        if (!dto.units || dto.units.length === 0) {
          throw new BadRequestException(
            'Units array is required and must contain at least one item for SERIALIZED products',
          );
        }

        quantityReceived = dto.units.length;

        const imeiSet = new Set<string>();
        for (const unit of dto.units) {
          if (!unit.imei) {
            throw new BadRequestException('IMEI is required for every unit');
          }
          if (!unit.purchasePrice || unit.purchasePrice <= 0) {
            throw new BadRequestException(
              `Purchase price must be greater than 0 for unit with IMEI "${unit.imei}"`,
            );
          }
          if (imeiSet.has(unit.imei)) {
            throw new ConflictException(
              `Duplicate IMEI "${unit.imei}" found in the request payload`,
            );
          }
          imeiSet.add(unit.imei);
        }

        for (const unit of dto.units) {
          const existingUnit = await tx.productUnit.findUnique({
            where: { imei: unit.imei },
          });

          if (existingUnit) {
            throw new ConflictException(
              `Unit with IMEI "${unit.imei}" already exists in the system`,
            );
          }

          await tx.productUnit.create({
            data: {
              productId: product.id,
              imei: unit.imei,
              serialNumber: unit.serialNumber || null,
              storage: unit.storage || null,
              color: unit.color || null,
              purchasePrice: unit.purchasePrice,
              location: Location.WAREHOUSE,
              status: UnitStatus.AVAILABLE,
            },
          });
        }

        const existingInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.WAREHOUSE,
            },
          },
        });

        if (existingInventory) {
          updatedInventory = await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: { increment: dto.units.length },
            },
          });
        } else {
          updatedInventory = await tx.inventory.create({
            data: {
              productId: product.id,
              location: Location.WAREHOUSE,
              quantity: dto.units.length,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.STOCK_IN,
            quantity: dto.units.length,
            toLocation: Location.WAREHOUSE,
            stockBatchId: batch.id,
            createdById: userId,
            note: dto.note || null,
          },
        });
      }

      return {
        batch,
        inventory: updatedInventory,
        quantityReceived,
      };
    });
  }

  async transferStock(dto: TransferStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      let updatedWarehouseInventory;
      let updatedShopInventory;
      let quantityTransferred = 0;
      let transferredUnits: any[] = [];

      if (product.trackingType === TrackingType.QUANTITY) {
        if (!dto.quantity || dto.quantity <= 0) {
          throw new BadRequestException(
            'quantity is required and must be greater than 0 for QUANTITY products',
          );
        }

        quantityTransferred = dto.quantity;

        const warehouseInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.WAREHOUSE,
            },
          },
        });

        if (!warehouseInventory || warehouseInventory.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient warehouse stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${warehouseInventory?.quantity || 0}`,
          );
        }

        updatedWarehouseInventory = await tx.inventory.update({
          where: { id: warehouseInventory.id },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });

        const shopInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.SHOP,
            },
          },
        });

        if (shopInventory) {
          updatedShopInventory = await tx.inventory.update({
            where: { id: shopInventory.id },
            data: {
              quantity: { increment: dto.quantity },
            },
          });
        } else {
          updatedShopInventory = await tx.inventory.create({
            data: {
              productId: product.id,
              location: Location.SHOP,
              quantity: dto.quantity,
            },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.TRANSFER,
            quantity: dto.quantity,
            fromLocation: Location.WAREHOUSE,
            toLocation: Location.SHOP,
            createdById: userId,
            note: dto.note || null,
          },
        });

        return {
          movement,
          warehouseInventory: updatedWarehouseInventory,
          shopInventory: updatedShopInventory,
          quantityTransferred,
          transferredUnits: [],
        };
      } else if (product.trackingType === TrackingType.SERIALIZED) {
        if (!dto.unitIds || dto.unitIds.length === 0) {
          throw new BadRequestException(
            'unitIds array is required and cannot be empty for SERIALIZED products',
          );
        }

        if (new Set(dto.unitIds).size !== dto.unitIds.length) {
          throw new BadRequestException('Duplicate unit IDs found in request');
        }

        quantityTransferred = dto.unitIds.length;

        const units = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
        });

        if (units.length !== dto.unitIds.length) {
          throw new NotFoundException(
            'One or more requested product units were not found',
          );
        }

        for (const unit of units) {
          if (unit.productId !== product.id) {
            throw new BadRequestException(
              `Product unit "${unit.id}" does not belong to product "${product.name}"`,
            );
          }
          if (unit.location !== Location.WAREHOUSE) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not currently located in WAREHOUSE (location: ${unit.location})`,
            );
          }
          if (unit.status !== UnitStatus.AVAILABLE) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not currently AVAILABLE (status: ${unit.status})`,
            );
          }
        }

        const warehouseInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.WAREHOUSE,
            },
          },
        });

        if (!warehouseInventory || warehouseInventory.quantity < dto.unitIds.length) {
          throw new BadRequestException(
            `Insufficient warehouse stock quantity for product "${product.name}". Requested: ${dto.unitIds.length}, Available: ${warehouseInventory?.quantity || 0}`,
          );
        }

        await tx.productUnit.updateMany({
          where: {
            id: { in: dto.unitIds },
          },
          data: {
            location: Location.SHOP,
            status: UnitStatus.IN_SHOP,
          },
        });

        updatedWarehouseInventory = await tx.inventory.update({
          where: { id: warehouseInventory.id },
          data: {
            quantity: { decrement: dto.unitIds.length },
          },
        });

        const shopInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.SHOP,
            },
          },
        });

        if (shopInventory) {
          updatedShopInventory = await tx.inventory.update({
            where: { id: shopInventory.id },
            data: {
              quantity: { increment: dto.unitIds.length },
            },
          });
        } else {
          updatedShopInventory = await tx.inventory.create({
            data: {
              productId: product.id,
              location: Location.SHOP,
              quantity: dto.unitIds.length,
            },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.TRANSFER,
            quantity: dto.unitIds.length,
            fromLocation: Location.WAREHOUSE,
            toLocation: Location.SHOP,
            createdById: userId,
            note: dto.note || null,
          },
        });

        for (const unitId of dto.unitIds) {
          await tx.stockMovementUnit.create({
            data: {
              stockMovementId: movement.id,
              productUnitId: unitId,
            },
          });
        }

        transferredUnits = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
          select: {
            id: true,
            imei: true,
            storage: true,
            color: true,
            location: true,
            status: true,
          },
        });

        return {
          movement,
          warehouseInventory: updatedWarehouseInventory,
          shopInventory: updatedShopInventory,
          quantityTransferred,
          transferredUnits,
        };
      }
    });
  }

  async sellStock(dto: SellStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      let updatedShopInventory;
      let quantitySold = 0;
      let soldUnits: any[] = [];

      if (product.trackingType === TrackingType.QUANTITY) {
        if (!dto.quantity || dto.quantity <= 0) {
          throw new BadRequestException(
            'quantity is required and must be greater than 0 for QUANTITY products',
          );
        }

        quantitySold = dto.quantity;

        const updateInventoryResult = await tx.inventory.updateMany({
          where: {
            productId: product.id,
            location: Location.SHOP,
            quantity: { gte: dto.quantity },
          },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });

        if (updateInventoryResult.count === 0) {
          const shopInventory = await tx.inventory.findUnique({
            where: {
              productId_location: {
                productId: product.id,
                location: Location.SHOP,
              },
            },
          });

          throw new BadRequestException(
            `Insufficient shop stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${shopInventory?.quantity || 0}`,
          );
        }

        updatedShopInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.SHOP,
            },
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.SALE,
            quantity: dto.quantity,
            fromLocation: Location.SHOP,
            toLocation: Location.SHOP,
            createdById: userId,
            note: dto.note || null,
          },
        });

        return {
          movement,
          shopInventory: updatedShopInventory,
          quantitySold,
          soldUnits: [],
        };
      } else if (product.trackingType === TrackingType.SERIALIZED) {
        if (!dto.unitIds || dto.unitIds.length === 0) {
          throw new BadRequestException(
            'unitIds array is required and cannot be empty for SERIALIZED products',
          );
        }

        if (new Set(dto.unitIds).size !== dto.unitIds.length) {
          throw new BadRequestException('Duplicate unit IDs found in request');
        }

        quantitySold = dto.unitIds.length;

        const units = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
        });

        if (units.length !== dto.unitIds.length) {
          throw new NotFoundException(
            'One or more requested product units were not found',
          );
        }

        for (const unit of units) {
          if (unit.productId !== product.id) {
            throw new BadRequestException(
              `Product unit "${unit.id}" does not belong to product "${product.name}"`,
            );
          }
          if (unit.location !== Location.SHOP) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not currently located in SHOP (location: ${unit.location})`,
            );
          }
          if (unit.status !== UnitStatus.IN_SHOP) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not currently IN_SHOP (status: ${unit.status})`,
            );
          }
        }

        const updateUnitsResult = await tx.productUnit.updateMany({
          where: {
            id: { in: dto.unitIds },
            location: Location.SHOP,
            status: UnitStatus.IN_SHOP,
          },
          data: {
            location: Location.SHOP,
            status: UnitStatus.SOLD,
          },
        });

        if (updateUnitsResult.count !== dto.unitIds.length) {
          throw new BadRequestException(
            'One or more selected units are no longer available in the shop',
          );
        }

        const updateInventoryResult = await tx.inventory.updateMany({
          where: {
            productId: product.id,
            location: Location.SHOP,
            quantity: { gte: dto.unitIds.length },
          },
          data: {
            quantity: { decrement: dto.unitIds.length },
          },
        });

        if (updateInventoryResult.count === 0) {
          throw new BadRequestException(
            `Insufficient shop stock quantity for product "${product.name}".`,
          );
        }

        updatedShopInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: Location.SHOP,
            },
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.SALE,
            quantity: dto.unitIds.length,
            fromLocation: Location.SHOP,
            toLocation: Location.SHOP,
            createdById: userId,
            note: dto.note || null,
          },
        });

        for (const unitId of dto.unitIds) {
          await tx.stockMovementUnit.create({
            data: {
              stockMovementId: movement.id,
              productUnitId: unitId,
            },
          });
        }

        soldUnits = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
          select: {
            id: true,
            imei: true,
            serialNumber: true,
            purchasePrice: true,
            location: true,
            status: true,
          },
        });

        return {
          movement,
          shopInventory: updatedShopInventory,
          quantitySold,
          soldUnits,
        };
      }
    });
  }

  async returnStock(dto: ReturnStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException(
        `Product "${product.name}" is soft-deleted/inactive and cannot accept stock returns`,
      );
    }

    const destinationLocation = dto.location || dto.toLocation;

    if (!destinationLocation) {
      throw new BadRequestException(
        'location is required for stock return (WAREHOUSE or SHOP)',
      );
    }

    if (
      destinationLocation !== Location.WAREHOUSE &&
      destinationLocation !== Location.SHOP
    ) {
      throw new BadRequestException(
        'location must be either WAREHOUSE or SHOP',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let updatedDestinationInventory;
      let quantityReturned = 0;
      let returnedUnits: any[] = [];

      if (product.trackingType === TrackingType.QUANTITY) {
        if (!dto.quantity || dto.quantity <= 0) {
          throw new BadRequestException(
            'quantity is required and must be greater than 0 for QUANTITY products',
          );
        }

        quantityReturned = dto.quantity;

        const existingInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: destinationLocation,
            },
          },
        });

        if (existingInventory) {
          updatedDestinationInventory = await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: { increment: dto.quantity },
            },
          });
        } else {
          updatedDestinationInventory = await tx.inventory.create({
            data: {
              productId: product.id,
              location: destinationLocation,
              quantity: dto.quantity,
            },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.RETURN,
            fromLocation: null,
            toLocation: destinationLocation,
            quantity: dto.quantity,
            createdById: userId,
            note: dto.note || null,
          },
        });

        return {
          message: 'Stock returned successfully',
          movementId: movement.id,
          productId: product.id,
          trackingType: product.trackingType,
          quantityReturned,
          location: destinationLocation,
          movement,
          product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            trackingType: product.trackingType,
          },
          inventory: updatedDestinationInventory,
          toLocation: destinationLocation,
          returnedUnits: [],
        };
      } else if (product.trackingType === TrackingType.SERIALIZED) {
        if (!dto.unitIds || dto.unitIds.length === 0) {
          throw new BadRequestException(
            'unitIds array is required and cannot be empty for SERIALIZED products',
          );
        }

        if (new Set(dto.unitIds).size !== dto.unitIds.length) {
          throw new BadRequestException('Duplicate unit IDs found in request');
        }

        quantityReturned = dto.unitIds.length;

        const units = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
        });

        if (units.length !== dto.unitIds.length) {
          throw new BadRequestException(
            'One or more requested product units were not found',
          );
        }

        for (const unit of units) {
          if (unit.productId !== product.id) {
            throw new BadRequestException(
              `Product unit "${unit.id}" does not belong to product "${product.name}"`,
            );
          }
          if (unit.status !== UnitStatus.SOLD) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not currently SOLD (status: ${unit.status}). Only SOLD units can be returned.`,
            );
          }
        }

        const targetStatus =
          destinationLocation === Location.WAREHOUSE
            ? UnitStatus.AVAILABLE
            : UnitStatus.IN_SHOP;

        const updateUnitsResult = await tx.productUnit.updateMany({
          where: {
            id: { in: dto.unitIds },
            status: UnitStatus.SOLD,
          },
          data: {
            location: destinationLocation,
            status: targetStatus,
          },
        });

        if (updateUnitsResult.count !== dto.unitIds.length) {
          throw new BadRequestException(
            'One or more selected units are no longer in SOLD status',
          );
        }

        const existingInventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: destinationLocation,
            },
          },
        });

        if (existingInventory) {
          updatedDestinationInventory = await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: { increment: dto.unitIds.length },
            },
          });
        } else {
          updatedDestinationInventory = await tx.inventory.create({
            data: {
              productId: product.id,
              location: destinationLocation,
              quantity: dto.unitIds.length,
            },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: MovementType.RETURN,
            fromLocation: null,
            toLocation: destinationLocation,
            quantity: dto.unitIds.length,
            createdById: userId,
            note: dto.note || null,
          },
        });

        for (const unitId of dto.unitIds) {
          await tx.stockMovementUnit.create({
            data: {
              stockMovementId: movement.id,
              productUnitId: unitId,
            },
          });
        }

        returnedUnits = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
          select: {
            id: true,
            imei: true,
            serialNumber: true,
            storage: true,
            color: true,
            purchasePrice: true,
            location: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return {
          message: 'Stock returned successfully',
          movementId: movement.id,
          productId: product.id,
          trackingType: product.trackingType,
          quantityReturned,
          location: destinationLocation,
          movement,
          product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            trackingType: product.trackingType,
          },
          inventory: updatedDestinationInventory,
          toLocation: destinationLocation,
          returnedUnits,
        };
      }
    });
  }

  async damageStock(dto: DamageStockDto, userId: string) {
    return this.processAdjustment(MovementType.DAMAGE, dto, userId);
  }

  async lossStock(dto: LossStockDto, userId: string) {
    return this.processAdjustment(MovementType.LOSS, dto, userId);
  }

  private async processAdjustment(
    movementType: MovementType,
    dto: DamageStockDto | LossStockDto,
    userId: string,
  ) {
    if (
      dto.location !== Location.WAREHOUSE &&
      dto.location !== Location.SHOP
    ) {
      throw new BadRequestException('location must be either WAREHOUSE or SHOP');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException(
        `Product "${product.name}" is inactive/soft-deleted and cannot be damaged or marked as lost`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (product.trackingType === TrackingType.QUANTITY) {
        if (!dto.quantity || dto.quantity < 1) {
          throw new BadRequestException(
            'quantity is required and must be at least 1 for QUANTITY products',
          );
        }

        const inventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: dto.location,
            },
          },
        });

        if (!inventory || inventory.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient ${dto.location} stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${inventory?.quantity || 0}`,
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType,
            quantity: dto.quantity,
            fromLocation: dto.location,
            toLocation: null,
            createdById: userId,
            note: dto.note || null,
          },
        });

        return {
          movementId: movement.id,
          movementType: movement.movementType,
          productId: product.id,
          quantityAffected: dto.quantity,
          location: dto.location,
          note: dto.note || null,
          units: [],
        };
      } else if (product.trackingType === TrackingType.SERIALIZED) {
        if (!dto.unitIds || dto.unitIds.length === 0) {
          throw new BadRequestException(
            'unitIds array is required and cannot be empty for SERIALIZED products',
          );
        }

        if (new Set(dto.unitIds).size !== dto.unitIds.length) {
          throw new BadRequestException('Duplicate unit IDs found in request');
        }

        const units = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
        });

        if (units.length !== dto.unitIds.length) {
          throw new BadRequestException(
            'One or more requested product units were not found',
          );
        }

        for (const unit of units) {
          if (unit.productId !== product.id) {
            throw new BadRequestException(
              `Product unit "${unit.id}" does not belong to product "${product.name}"`,
            );
          }
          if (unit.location !== dto.location) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not located at ${dto.location} (current location: ${unit.location})`,
            );
          }

          const isValidStatus =
            (dto.location === Location.WAREHOUSE && unit.status === UnitStatus.AVAILABLE) ||
            (dto.location === Location.SHOP && unit.status === UnitStatus.IN_SHOP);

          if (!isValidStatus) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not in active sellable status (current status: ${unit.status}). Only AVAILABLE units in WAREHOUSE or IN_SHOP units in SHOP can be recorded as damage/loss.`,
            );
          }
        }

        const inventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: dto.location,
            },
          },
        });

        if (!inventory || inventory.quantity < dto.unitIds.length) {
          throw new BadRequestException(
            `Insufficient ${dto.location} stock quantity for product "${product.name}".`,
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { decrement: dto.unitIds.length },
          },
        });

        await tx.productUnit.updateMany({
          where: {
            id: { in: dto.unitIds },
          },
          data: {
            status: UnitStatus.DAMAGED,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType,
            quantity: dto.unitIds.length,
            fromLocation: dto.location,
            toLocation: null,
            createdById: userId,
            note: dto.note || null,
          },
        });

        for (const unitId of dto.unitIds) {
          await tx.stockMovementUnit.create({
            data: {
              stockMovementId: movement.id,
              productUnitId: unitId,
            },
          });
        }

        const affectedUnits = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
          select: {
            id: true,
            imei: true,
            serialNumber: true,
            storage: true,
            color: true,
            purchasePrice: true,
            location: true,
            status: true,
          },
        });

        return {
          movementId: movement.id,
          movementType: movement.movementType,
          productId: product.id,
          quantityAffected: dto.unitIds.length,
          location: dto.location,
          note: dto.note || null,
          units: affectedUnits.map((u) => ({
            ...u,
            purchasePrice: u.purchasePrice ? Number(u.purchasePrice) : null,
          })),
        };
      }
    });
  }

  async adjustStock(dto: AdjustStockDto, userId: string) {
    if (
      dto.movementType !== MovementType.DAMAGE &&
      dto.movementType !== MovementType.LOSS
    ) {
      throw new BadRequestException(
        'movementType must be either DAMAGE or LOSS',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID "${dto.productId}" not found`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (product.trackingType === TrackingType.QUANTITY) {
        if (!dto.quantity || dto.quantity <= 0) {
          throw new BadRequestException(
            'quantity is required and must be greater than 0 for QUANTITY products',
          );
        }
        if (!dto.location) {
          throw new BadRequestException(
            'location is required for QUANTITY product adjustments',
          );
        }

        const inventory = await tx.inventory.findUnique({
          where: {
            productId_location: {
              productId: product.id,
              location: dto.location,
            },
          },
        });

        if (!inventory || inventory.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient ${dto.location} stock for product "${product.name}". Requested: ${dto.quantity}, Available: ${inventory?.quantity || 0}`,
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: dto.movementType,
            quantity: dto.quantity,
            fromLocation: dto.location,
            toLocation: null,
            createdById: userId,
            note: dto.note || null,
          },
        });

        return {
          movement,
          quantityAdjusted: dto.quantity,
          affectedUnits: [],
        };
      } else if (product.trackingType === TrackingType.SERIALIZED) {
        if (!dto.unitIds || dto.unitIds.length === 0) {
          throw new BadRequestException(
            'unitIds array is required and cannot be empty for SERIALIZED products',
          );
        }

        if (new Set(dto.unitIds).size !== dto.unitIds.length) {
          throw new BadRequestException('Duplicate unit IDs found in request');
        }

        const units = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
        });

        if (units.length !== dto.unitIds.length) {
          throw new NotFoundException(
            'One or more requested product units were not found',
          );
        }

        for (const unit of units) {
          if (unit.productId !== product.id) {
            throw new BadRequestException(
              `Product unit "${unit.id}" does not belong to product "${product.name}"`,
            );
          }

          const isWarehouseAvailable =
            unit.location === Location.WAREHOUSE &&
            unit.status === UnitStatus.AVAILABLE;
          const isShopInShop =
            unit.location === Location.SHOP &&
            unit.status === UnitStatus.IN_SHOP;

          if (!isWarehouseAvailable && !isShopInShop) {
            throw new BadRequestException(
              `Product unit "${unit.id}" is not currently active sellable inventory (location: ${unit.location}, status: ${unit.status})`,
            );
          }
        }

        const targetStatus = UnitStatus.DAMAGED;

        const warehouseUnits = units.filter(
          (u) => u.location === Location.WAREHOUSE,
        );
        const shopUnits = units.filter((u) => u.location === Location.SHOP);

        if (warehouseUnits.length > 0) {
          const whInventory = await tx.inventory.findUnique({
            where: {
              productId_location: {
                productId: product.id,
                location: Location.WAREHOUSE,
              },
            },
          });

          if (!whInventory || whInventory.quantity < warehouseUnits.length) {
            throw new BadRequestException(
              `Insufficient WAREHOUSE stock quantity for product "${product.name}".`,
            );
          }

          await tx.inventory.update({
            where: { id: whInventory.id },
            data: {
              quantity: { decrement: warehouseUnits.length },
            },
          });
        }

        if (shopUnits.length > 0) {
          const shopInventory = await tx.inventory.findUnique({
            where: {
              productId_location: {
                productId: product.id,
                location: Location.SHOP,
              },
            },
          });

          if (!shopInventory || shopInventory.quantity < shopUnits.length) {
            throw new BadRequestException(
              `Insufficient SHOP stock quantity for product "${product.name}".`,
            );
          }

          await tx.inventory.update({
            where: { id: shopInventory.id },
            data: {
              quantity: { decrement: shopUnits.length },
            },
          });
        }

        await tx.productUnit.updateMany({
          where: {
            id: { in: dto.unitIds },
          },
          data: {
            status: targetStatus,
          },
        });

        const createdMovements: any[] = [];

        if (warehouseUnits.length > 0) {
          const whMovement = await tx.stockMovement.create({
            data: {
              productId: product.id,
              movementType: dto.movementType,
              quantity: warehouseUnits.length,
              fromLocation: Location.WAREHOUSE,
              toLocation: null,
              createdById: userId,
              note: dto.note || null,
            },
          });

          for (const u of warehouseUnits) {
            await tx.stockMovementUnit.create({
              data: {
                stockMovementId: whMovement.id,
                productUnitId: u.id,
              },
            });
          }

          createdMovements.push(whMovement);
        }

        if (shopUnits.length > 0) {
          const shopMovement = await tx.stockMovement.create({
            data: {
              productId: product.id,
              movementType: dto.movementType,
              quantity: shopUnits.length,
              fromLocation: Location.SHOP,
              toLocation: null,
              createdById: userId,
              note: dto.note || null,
            },
          });

          for (const u of shopUnits) {
            await tx.stockMovementUnit.create({
              data: {
                stockMovementId: shopMovement.id,
                productUnitId: u.id,
              },
            });
          }

          createdMovements.push(shopMovement);
        }

        const affectedUnits = await tx.productUnit.findMany({
          where: {
            id: { in: dto.unitIds },
          },
          select: {
            id: true,
            imei: true,
            serialNumber: true,
            storage: true,
            color: true,
            purchasePrice: true,
            location: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return {
          movement: createdMovements[0],
          movements: createdMovements,
          quantityAdjusted: dto.unitIds.length,
          affectedUnits,
        };
      }
    });
  }

  async getMovementSummary(query: QueryMovementSummaryDto) {
    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {};

    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [movements, recentMovementsRaw] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        select: {
          id: true,
          movementType: true,
          quantity: true,
          toLocation: true,
          productId: true,
        },
      }),
      this.prisma.stockMovement.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          movementType: true,
          quantity: true,
          fromLocation: true,
          toLocation: true,
          note: true,
          createdAt: true,
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
      }),
    ]);

    const totalMovements = movements.length;
    let totalUnitsMoved = 0;

    const byMovementType: Record<MovementType, number> = {
      [MovementType.STOCK_IN]: 0,
      [MovementType.TRANSFER]: 0,
      [MovementType.SALE]: 0,
      [MovementType.RETURN]: 0,
      [MovementType.DAMAGE]: 0,
      [MovementType.LOSS]: 0,
    };

    const quantityByMovementType: Record<MovementType, number> = {
      [MovementType.STOCK_IN]: 0,
      [MovementType.TRANSFER]: 0,
      [MovementType.SALE]: 0,
      [MovementType.RETURN]: 0,
      [MovementType.DAMAGE]: 0,
      [MovementType.LOSS]: 0,
    };

    const byLocation: Record<Location, number> = {
      [Location.WAREHOUSE]: 0,
      [Location.SHOP]: 0,
    };

    const productMap = new Map<string, number>();

    for (const m of movements) {
      const qty = m.quantity;
      totalUnitsMoved += qty;

      if (byMovementType[m.movementType] !== undefined) {
        byMovementType[m.movementType] += 1;
      }
      if (quantityByMovementType[m.movementType] !== undefined) {
        quantityByMovementType[m.movementType] += qty;
      }
      if (m.toLocation && byLocation[m.toLocation] !== undefined) {
        byLocation[m.toLocation] += qty;
      }

      productMap.set(m.productId, (productMap.get(m.productId) || 0) + qty);
    }

    const sortedProductEntries = Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topProductIds = sortedProductEntries.map(([id]) => id);

    const products = await this.prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, brand: true },
    });

    const productInfoMap = new Map(products.map((p) => [p.id, p]));

    const topProducts = sortedProductEntries.map(([pid, qty]) => {
      const p = productInfoMap.get(pid);
      return {
        productId: pid,
        productName: p ? p.name : 'Unknown Product',
        brand: p ? p.brand : 'Unknown Brand',
        totalQuantityMoved: qty,
      };
    });

    const recentMovements = recentMovementsRaw.map((m) => ({
      id: m.id,
      movementType: m.movementType,
      quantity: m.quantity,
      fromLocation: m.fromLocation,
      toLocation: m.toLocation,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
      product: {
        id: m.product.id,
        name: m.product.name,
        brand: m.product.brand,
        productType: m.product.productType,
        trackingType: m.product.trackingType,
      },
    }));

    return {
      totalMovements,
      totalUnitsMoved,
      byMovementType,
      quantityByMovementType,
      byLocation,
      recentMovements,
      topProducts,
      dateRange: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
    };
  }

  async findMovements(query: QueryStockMovementDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.movementType) {
      where.movementType = query.movementType;
    }
    if (query.fromLocation) {
      where.fromLocation = query.fromLocation;
    }
    if (query.toLocation) {
      where.toLocation = query.toLocation;
    }
    if (query.createdById) {
      where.createdById = query.createdById;
    }

    const productConditions: Prisma.ProductWhereInput = {};
    if (query.productType) {
      productConditions.productType = query.productType;
    }
    if (query.trackingType) {
      productConditions.trackingType = query.trackingType;
    }
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      productConditions.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(productConditions).length > 0) {
      where.product = productConditions;
    }

    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [rawMovements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              trackingType: true,
              sellingPrice: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          movementUnits: {
            include: {
              productUnit: {
                select: {
                  id: true,
                  imei: true,
                  serialNumber: true,
                  storage: true,
                  color: true,
                  purchasePrice: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const data = rawMovements.map((m) => {
      const units = m.movementUnits.map((mu) => ({
        id: mu.productUnit.id,
        imei: mu.productUnit.imei,
        serialNumber: mu.productUnit.serialNumber,
        storage: mu.productUnit.storage,
        color: mu.productUnit.color,
        purchasePrice: mu.productUnit.purchasePrice
          ? Number(mu.productUnit.purchasePrice)
          : null,
        location: mu.productUnit.location,
        status: mu.productUnit.status,
      }));

      return {
        id: m.id,
        productId: m.productId,
        movementType: m.movementType,
        fromLocation: m.fromLocation,
        toLocation: m.toLocation,
        quantity: m.quantity,
        costPrice: m.costPrice ? Number(m.costPrice) : null,
        note: m.note,
        createdById: m.createdById,
        createdAt: m.createdAt.toISOString(),
        product: {
          id: m.product.id,
          name: m.product.name,
          brand: m.product.brand,
          productType: m.product.productType,
          trackingType: m.product.trackingType,
          sellingPrice: m.product.sellingPrice
            ? Number(m.product.sellingPrice)
            : 0,
        },
        createdBy: {
          id: m.createdBy.id,
          name: m.createdBy.name,
          email: m.createdBy.email,
          role: m.createdBy.role,
        },
        units: m.product.trackingType === TrackingType.SERIALIZED ? units : [],
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findMovementById(id: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            productType: true,
            trackingType: true,
            sellingPrice: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        stockBatch: {
          select: {
            id: true,
            reference: true,
            note: true,
            createdById: true,
            createdAt: true,
          },
        },
        movementUnits: {
          include: {
            productUnit: {
              select: {
                id: true,
                imei: true,
                serialNumber: true,
                storage: true,
                color: true,
                purchasePrice: true,
                location: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException(`Movement with ID "${id}" not found`);
    }

    const units =
      movement.product.trackingType === TrackingType.SERIALIZED
        ? movement.movementUnits.map((mu) => ({
            id: mu.productUnit.id,
            imei: mu.productUnit.imei,
            serialNumber: mu.productUnit.serialNumber,
            storage: mu.productUnit.storage,
            color: mu.productUnit.color,
            purchasePrice: mu.productUnit.purchasePrice
              ? Number(mu.productUnit.purchasePrice)
              : null,
            location: mu.productUnit.location,
            status: mu.productUnit.status,
          }))
        : [];

    return {
      id: movement.id,
      movementType: movement.movementType,
      quantity: movement.quantity,
      fromLocation: movement.fromLocation,
      toLocation: movement.toLocation,
      costPrice: movement.costPrice ? Number(movement.costPrice) : null,
      note: movement.note,
      createdById: movement.createdById,
      createdAt: movement.createdAt.toISOString(),
      product: {
        id: movement.product.id,
        name: movement.product.name,
        brand: movement.product.brand,
        productType: movement.product.productType,
        trackingType: movement.product.trackingType,
        sellingPrice: movement.product.sellingPrice
          ? Number(movement.product.sellingPrice)
          : 0,
      },
      createdBy: {
        id: movement.createdBy.id,
        name: movement.createdBy.name,
        email: movement.createdBy.email,
        role: movement.createdBy.role,
      },
      units,
      stockBatch: movement.stockBatch
        ? {
            id: movement.stockBatch.id,
            reference: movement.stockBatch.reference,
            note: movement.stockBatch.note,
            createdById: movement.stockBatch.createdById,
            createdAt: movement.stockBatch.createdAt.toISOString(),
          }
        : null,
    };
  }

  async getMovementById(id: string) {
    return this.findMovementById(id);
  }

  async findTransfers(query: QueryStockTransferDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {
      movementType: MovementType.TRANSFER,
    };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.fromLocation) {
      where.fromLocation = query.fromLocation;
    }
    if (query.toLocation) {
      where.toLocation = query.toLocation;
    }
    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [rawTransfers, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              trackingType: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          movementUnits: {
            include: {
              productUnit: {
                select: {
                  id: true,
                  imei: true,
                  serialNumber: true,
                  storage: true,
                  color: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const data = rawTransfers.map((t) => {
      const units = t.movementUnits.map((mu) => ({
        id: mu.productUnit.id,
        imei: mu.productUnit.imei,
        serialNumber: mu.productUnit.serialNumber,
        storage: mu.productUnit.storage,
        color: mu.productUnit.color,
        location: mu.productUnit.location,
        status: mu.productUnit.status,
      }));

      return {
        id: t.id,
        productId: t.productId,
        movementType: t.movementType,
        fromLocation: t.fromLocation,
        toLocation: t.toLocation,
        quantity: t.quantity,
        costPrice: t.costPrice ? Number(t.costPrice) : null,
        note: t.note,
        createdById: t.createdById,
        createdAt: t.createdAt.toISOString(),
        product: {
          id: t.product.id,
          name: t.product.name,
          brand: t.product.brand,
          productType: t.product.productType,
          trackingType: t.product.trackingType,
        },
        createdBy: {
          id: t.createdBy.id,
          name: t.createdBy.name,
          email: t.createdBy.email,
          role: t.createdBy.role,
        },
        units,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findReceipts(query: QueryStockReceiptDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {
      movementType: MovementType.STOCK_IN,
    };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.location) {
      where.toLocation = query.location;
    }
    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [rawReceipts, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              trackingType: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          stockBatch: {
            select: {
              id: true,
              reference: true,
              note: true,
              createdById: true,
              createdAt: true,
            },
          },
          movementUnits: {
            include: {
              productUnit: {
                select: {
                  id: true,
                  imei: true,
                  serialNumber: true,
                  storage: true,
                  color: true,
                  purchasePrice: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const data = rawReceipts.map((r) => {
      const units = r.movementUnits.map((mu) => ({
        id: mu.productUnit.id,
        imei: mu.productUnit.imei,
        serialNumber: mu.productUnit.serialNumber,
        storage: mu.productUnit.storage,
        color: mu.productUnit.color,
        purchasePrice: mu.productUnit.purchasePrice
          ? Number(mu.productUnit.purchasePrice)
          : null,
        location: mu.productUnit.location,
        status: mu.productUnit.status,
      }));

      return {
        id: r.id,
        productId: r.productId,
        movementType: r.movementType,
        fromLocation: r.fromLocation,
        toLocation: r.toLocation,
        quantity: r.quantity,
        costPrice: r.costPrice ? Number(r.costPrice) : null,
        note: r.note,
        createdById: r.createdById,
        createdAt: r.createdAt.toISOString(),
        product: {
          id: r.product.id,
          name: r.product.name,
          brand: r.product.brand,
          productType: r.product.productType,
          trackingType: r.product.trackingType,
        },
        createdBy: {
          id: r.createdBy.id,
          name: r.createdBy.name,
          email: r.createdBy.email,
          role: r.createdBy.role,
        },
        stockBatch: r.stockBatch
          ? {
              id: r.stockBatch.id,
              reference: r.stockBatch.reference,
              note: r.stockBatch.note,
              createdById: r.stockBatch.createdById,
              createdAt: r.stockBatch.createdAt.toISOString(),
            }
          : null,
        units,
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findSales(query: QueryStockSaleDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {
      movementType: MovementType.SALE,
    };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.createdById) {
      where.createdById = query.createdById;
    }
    if (query.location) {
      where.OR = [
        { fromLocation: query.location },
        { toLocation: query.location },
      ];
    }

    const productConditions: Prisma.ProductWhereInput = {};
    if (query.productType) {
      productConditions.productType = query.productType;
    }
    if (query.trackingType) {
      productConditions.trackingType = query.trackingType;
    }
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      productConditions.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(productConditions).length > 0) {
      where.product = productConditions;
    }

    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [rawSales, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              trackingType: true,
              sellingPrice: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          movementUnits: {
            include: {
              productUnit: {
                select: {
                  id: true,
                  imei: true,
                  serialNumber: true,
                  storage: true,
                  color: true,
                  purchasePrice: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const data = rawSales.map((s) => {
      const sellingPriceNum = s.product.sellingPrice
        ? Number(s.product.sellingPrice)
        : 0;
      const revenue = Number((s.quantity * sellingPriceNum).toFixed(2));

      const units = s.movementUnits.map((mu) => ({
        id: mu.productUnit.id,
        imei: mu.productUnit.imei,
        serialNumber: mu.productUnit.serialNumber,
        storage: mu.productUnit.storage,
        color: mu.productUnit.color,
        purchasePrice: mu.productUnit.purchasePrice
          ? Number(mu.productUnit.purchasePrice)
          : null,
        location: mu.productUnit.location,
        status: mu.productUnit.status,
      }));

      return {
        id: s.id,
        movementType: s.movementType,
        quantity: s.quantity,
        fromLocation: s.fromLocation,
        toLocation: s.toLocation,
        costPrice: s.costPrice ? Number(s.costPrice) : null,
        note: s.note,
        createdById: s.createdById,
        createdAt: s.createdAt.toISOString(),
        product: {
          id: s.product.id,
          name: s.product.name,
          brand: s.product.brand,
          productType: s.product.productType,
          trackingType: s.product.trackingType,
          sellingPrice: sellingPriceNum,
        },
        createdBy: {
          id: s.createdBy.id,
          name: s.createdBy.name,
          email: s.createdBy.email,
          role: s.createdBy.role,
        },
        units: s.product.trackingType === TrackingType.SERIALIZED ? units : [],
        revenue,
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findReturns(query: QueryStockReturnDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {
      movementType: MovementType.RETURN,
    };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.location) {
      where.toLocation = query.location;
    }
    if (query.createdById) {
      where.createdById = query.createdById;
    }

    const productConditions: Prisma.ProductWhereInput = {};
    if (query.productType) {
      productConditions.productType = query.productType;
    }
    if (query.trackingType) {
      productConditions.trackingType = query.trackingType;
    }
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      productConditions.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(productConditions).length > 0) {
      where.product = productConditions;
    }

    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [rawReturns, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              trackingType: true,
              sellingPrice: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          movementUnits: {
            include: {
              productUnit: {
                select: {
                  id: true,
                  imei: true,
                  serialNumber: true,
                  storage: true,
                  color: true,
                  purchasePrice: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const data = rawReturns.map((r) => {
      const sellingPriceNum = r.product.sellingPrice
        ? Number(r.product.sellingPrice)
        : 0;

      const units = r.movementUnits.map((mu) => ({
        id: mu.productUnit.id,
        imei: mu.productUnit.imei,
        serialNumber: mu.productUnit.serialNumber,
        storage: mu.productUnit.storage,
        color: mu.productUnit.color,
        purchasePrice: mu.productUnit.purchasePrice
          ? Number(mu.productUnit.purchasePrice)
          : null,
        location: mu.productUnit.location,
        status: mu.productUnit.status,
      }));

      return {
        id: r.id,
        movementType: r.movementType,
        quantity: r.quantity,
        fromLocation: r.fromLocation,
        toLocation: r.toLocation,
        costPrice: r.costPrice ? Number(r.costPrice) : null,
        note: r.note,
        createdById: r.createdById,
        createdAt: r.createdAt.toISOString(),
        product: {
          id: r.product.id,
          name: r.product.name,
          brand: r.product.brand,
          productType: r.product.productType,
          trackingType: r.product.trackingType,
          sellingPrice: sellingPriceNum,
        },
        createdBy: {
          id: r.createdBy.id,
          name: r.createdBy.name,
          email: r.createdBy.email,
          role: r.createdBy.role,
        },
        units: r.product.trackingType === TrackingType.SERIALIZED ? units : [],
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findStockIns(query: QueryStockInDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const effectiveStart = query.startDate || query.date;
    const effectiveEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (effectiveStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart.trim())) {
        parsedStart = new Date(`${effectiveStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(effectiveStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (effectiveEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEnd.trim())) {
        parsedEnd = new Date(`${effectiveEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(effectiveEnd);
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const where: Prisma.StockMovementWhereInput = {
      movementType: MovementType.STOCK_IN,
    };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.location) {
      where.toLocation = query.location;
    }
    if (query.createdById) {
      where.createdById = query.createdById;
    }

    const productConditions: Prisma.ProductWhereInput = {};
    if (query.productType) {
      productConditions.productType = query.productType;
    }
    if (query.trackingType) {
      productConditions.trackingType = query.trackingType;
    }
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      productConditions.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(productConditions).length > 0) {
      where.product = productConditions;
    }

    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const [rawStockIns, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              productType: true,
              trackingType: true,
              sellingPrice: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          movementUnits: {
            include: {
              productUnit: {
                select: {
                  id: true,
                  imei: true,
                  serialNumber: true,
                  storage: true,
                  color: true,
                  purchasePrice: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const data = rawStockIns.map((s) => {
      const sellingPriceNum = s.product.sellingPrice
        ? Number(s.product.sellingPrice)
        : 0;

      const units = s.movementUnits.map((mu) => ({
        id: mu.productUnit.id,
        imei: mu.productUnit.imei,
        serialNumber: mu.productUnit.serialNumber,
        storage: mu.productUnit.storage,
        color: mu.productUnit.color,
        purchasePrice: mu.productUnit.purchasePrice
          ? Number(mu.productUnit.purchasePrice)
          : null,
        location: mu.productUnit.location,
        status: mu.productUnit.status,
      }));

      return {
        id: s.id,
        movementType: s.movementType,
        quantity: s.quantity,
        fromLocation: s.fromLocation,
        toLocation: s.toLocation,
        costPrice: s.costPrice ? Number(s.costPrice) : null,
        note: s.note,
        createdById: s.createdById,
        createdAt: s.createdAt.toISOString(),
        product: {
          id: s.product.id,
          name: s.product.name,
          brand: s.product.brand,
          productType: s.product.productType,
          trackingType: s.product.trackingType,
          sellingPrice: sellingPriceNum,
        },
        createdBy: {
          id: s.createdBy.id,
          name: s.createdBy.name,
          email: s.createdBy.email,
          role: s.createdBy.role,
        },
        units: s.product.trackingType === TrackingType.SERIALIZED ? units : [],
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
