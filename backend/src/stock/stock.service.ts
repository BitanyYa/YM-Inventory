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

        // Check for duplicate IMEIs in the incoming payload
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

        // Check for existing IMEIs in the database
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
            storage: true,
            color: true,
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

    const destinationLocation = dto.toLocation || Location.WAREHOUSE;

    if (
      destinationLocation !== Location.WAREHOUSE &&
      destinationLocation !== Location.SHOP
    ) {
      throw new BadRequestException(
        'toLocation must be either WAREHOUSE or SHOP',
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
            fromLocation: Location.SHOP,
            toLocation: destinationLocation,
            quantity: dto.quantity,
            createdById: userId,
            note: dto.note || null,
          },
        });

        return {
          movement,
          product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            trackingType: product.trackingType,
          },
          inventory: updatedDestinationInventory,
          toLocation: destinationLocation,
          quantityReturned,
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
            fromLocation: Location.SHOP,
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
          movement,
          product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            trackingType: product.trackingType,
          },
          inventory: updatedDestinationInventory,
          toLocation: destinationLocation,
          quantityReturned,
          returnedUnits,
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

  async findMovements(query: QueryStockMovementDto) {
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
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    return this.prisma.stockMovement.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        product: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        stockBatch: true,
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
    });
  }
}
