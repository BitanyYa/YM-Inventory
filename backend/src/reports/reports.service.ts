import { Injectable } from '@nestjs/common';
import { Location, MovementType, Prisma, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStockMovementsReport(query: QueryStockReportDto) {
    let parsedStart: Date | null = null;
    if (query.startDate) {
      parsedStart = new Date(query.startDate);
    }

    let parsedEnd: Date | null = null;
    if (query.endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.endDate.trim())) {
        parsedEnd = new Date(`${query.endDate.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(query.endDate);
        if (
          !query.endDate.includes('T') &&
          parsedEnd.getHours() === 0 &&
          parsedEnd.getMinutes() === 0 &&
          parsedEnd.getSeconds() === 0
        ) {
          parsedEnd.setHours(23, 59, 59, 999);
        }
      }
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
    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const allMovementTypes = Object.values(MovementType);

    const initMovementMap = () => {
      const map: Record<string, number> = {};
      for (const type of allMovementTypes) {
        map[type] = 0;
      }
      return map;
    };

    const overallTotals = initMovementMap();
    let totalMovements = 0;
    let totalQuantity = 0;

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        movementTotals: Record<string, number>;
        totalMovements: number;
        totalQuantity: number;
      }
    >();

    for (const movement of movements) {
      const type = movement.movementType;
      const qty = movement.quantity;

      overallTotals[type] = (overallTotals[type] || 0) + qty;
      totalMovements += 1;
      totalQuantity += qty;

      let pData = productMap.get(movement.productId);
      if (!pData) {
        pData = {
          productId: movement.productId,
          productName: movement.product?.name || 'Unknown Product',
          movementTotals: initMovementMap(),
          totalMovements: 0,
          totalQuantity: 0,
        };
        productMap.set(movement.productId, pData);
      }

      pData.movementTotals[type] = (pData.movementTotals[type] || 0) + qty;
      pData.totalMovements += 1;
      pData.totalQuantity += qty;
    }

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      summary: {
        movementTotals: overallTotals,
        totalMovements,
        totalQuantity,
      },
      byProduct: Array.from(productMap.values()).sort((a, b) =>
        a.productName.localeCompare(b.productName),
      ),
    };
  }

  async getInventoryValueReport() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        inventory: true,
        productUnits: {
          where: {
            status: {
              in: [UnitStatus.AVAILABLE, UnitStatus.IN_SHOP],
            },
          },
          select: {
            id: true,
            purchasePrice: true,
            location: true,
            status: true,
          },
        },
        stockMovements: {
          where: {
            movementType: MovementType.STOCK_IN,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            quantity: true,
            costPrice: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    let totalInventoryValue = 0;
    let warehouseValue = 0;
    let shopValue = 0;

    const byProduct: any[] = [];

    for (const product of products) {
      const warehouseRecord = product.inventory.find(
        (i) => i.location === Location.WAREHOUSE,
      );
      const shopRecord = product.inventory.find(
        (i) => i.location === Location.SHOP,
      );

      const warehouseQuantity = warehouseRecord ? warehouseRecord.quantity : 0;
      const shopQuantity = shopRecord ? shopRecord.quantity : 0;
      const totalQuantity = warehouseQuantity + shopQuantity;

      let inventoryValue = 0;
      let unitCost: number | null = null;
      let productWarehouseVal = 0;
      let productShopVal = 0;

      if (product.trackingType === TrackingType.SERIALIZED) {
        const warehouseUnits = product.productUnits.filter(
          (u) => u.location === Location.WAREHOUSE && u.status === UnitStatus.AVAILABLE,
        );
        const shopUnits = product.productUnits.filter(
          (u) => u.location === Location.SHOP && u.status === UnitStatus.IN_SHOP,
        );

        productWarehouseVal = warehouseUnits.reduce(
          (acc, u) => acc + (u.purchasePrice ? Number(u.purchasePrice) : 0),
          0,
        );
        productShopVal = shopUnits.reduce(
          (acc, u) => acc + (u.purchasePrice ? Number(u.purchasePrice) : 0),
          0,
        );

        inventoryValue = Number((productWarehouseVal + productShopVal).toFixed(2));
        unitCost = totalQuantity > 0 ? Number((inventoryValue / totalQuantity).toFixed(2)) : null;
      } else if (product.trackingType === TrackingType.QUANTITY) {
        if (totalQuantity > 0) {
          let qtyNeeded = totalQuantity;
          let calculatedVal = 0;
          let lastCostPrice = 0;

          for (const sm of product.stockMovements) {
            if (qtyNeeded <= 0) break;
            const cost = sm.costPrice ? Number(sm.costPrice) : 0;
            if (cost > 0) {
              lastCostPrice = cost;
            }
            const takeQty = Math.min(qtyNeeded, sm.quantity);
            calculatedVal += takeQty * cost;
            qtyNeeded -= takeQty;
          }

          if (qtyNeeded > 0 && lastCostPrice > 0) {
            calculatedVal += qtyNeeded * lastCostPrice;
          }

          inventoryValue = Number(calculatedVal.toFixed(2));
          unitCost = Number((inventoryValue / totalQuantity).toFixed(2));

          productWarehouseVal = Number(
            (warehouseQuantity * (inventoryValue / totalQuantity)).toFixed(2),
          );
          productShopVal = Number((inventoryValue - productWarehouseVal).toFixed(2));
        } else {
          inventoryValue = 0;
          unitCost = 0;
          productWarehouseVal = 0;
          productShopVal = 0;
        }
      }

      totalInventoryValue += inventoryValue;
      warehouseValue += productWarehouseVal;
      shopValue += productShopVal;

      byProduct.push({
        productId: product.id,
        productName: product.name,
        trackingType: product.trackingType,
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
        unitCost,
        inventoryValue,
      });
    }

    return {
      summary: {
        totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
        warehouseValue: Number(warehouseValue.toFixed(2)),
        shopValue: Number(shopValue.toFixed(2)),
      },
      byProduct,
    };
  }
}
