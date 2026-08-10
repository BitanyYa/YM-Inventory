import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location, MovementType, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiveStockDto } from './dto/receive-stock.dto';

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
}
