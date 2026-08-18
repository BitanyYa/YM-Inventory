import { BadRequestException, Injectable } from '@nestjs/common';
import { Location, MovementType, ProductType, Prisma, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';
import { QuerySalesReportDto } from './dto/query-sales-report.dto';
import { QueryProfitReportDto } from './dto/query-profit-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStockMovementsReport(query: QueryStockReportDto) {
    const rawStart = query.startDate || query.date;
    const rawEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (rawStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim())) {
        parsedStart = new Date(`${rawStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(rawStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (rawEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawEnd.trim())) {
        parsedEnd = new Date(`${rawEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(rawEnd);
        if (
          !rawEnd.includes('T') &&
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

      if (!productMap.has(movement.productId)) {
        productMap.set(movement.productId, {
          productId: movement.productId,
          productName: movement.product.name,
          movementTotals: initMovementMap(),
          totalMovements: 0,
          totalQuantity: 0,
        });
      }

      const pData = productMap.get(movement.productId)!;
      pData.movementTotals[type] = (pData.movementTotals[type] || 0) + qty;
      pData.totalMovements += 1;
      pData.totalQuantity += qty;
    }

    const byProduct = Array.from(productMap.values());

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      overallTotals: {
        byType: overallTotals,
        totalMovements,
        totalQuantity,
      },
      byProduct,
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
            location: {
              in: [Location.WAREHOUSE, Location.SHOP],
            },
          },
        },
      },
    });

    let totalInventoryValue = 0;
    let warehouseValue = 0;
    let shopValue = 0;

    const byProduct: Array<{
      productId: string;
      productName: string;
      trackingType: TrackingType;
      warehouseQuantity: number;
      shopQuantity: number;
      totalQuantity: number;
      unitCost: number;
      inventoryValue: number;
    }> = [];

    for (const product of products) {
      let warehouseQuantity = 0;
      let shopQuantity = 0;
      let totalQuantity = 0;
      let inventoryValue = 0;
      let unitCost = 0;
      let productWarehouseVal = 0;
      let productShopVal = 0;

      if (product.trackingType === TrackingType.SERIALIZED) {
        for (const unit of product.productUnits) {
          const cost = unit.purchasePrice ? Number(unit.purchasePrice) : 0;
          totalQuantity += 1;
          inventoryValue += cost;

          if (unit.location === Location.WAREHOUSE) {
            warehouseQuantity += 1;
            productWarehouseVal += cost;
          } else if (unit.location === Location.SHOP) {
            shopQuantity += 1;
            productShopVal += cost;
          }
        }

        unitCost =
          totalQuantity > 0
            ? Number((inventoryValue / totalQuantity).toFixed(2))
            : 0;
      } else if (product.trackingType === TrackingType.QUANTITY) {
        const whInventory = product.inventory.find(
          (inv) => inv.location === Location.WAREHOUSE,
        );
        const shopInventory = product.inventory.find(
          (inv) => inv.location === Location.SHOP,
        );

        warehouseQuantity = whInventory ? whInventory.quantity : 0;
        shopQuantity = shopInventory ? shopInventory.quantity : 0;
        totalQuantity = warehouseQuantity + shopQuantity;

        if (totalQuantity > 0) {
          const latestStockIn = await this.prisma.stockMovement.findFirst({
            where: {
              productId: product.id,
              movementType: MovementType.STOCK_IN,
              costPrice: {
                not: null,
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          if (latestStockIn && latestStockIn.costPrice) {
            unitCost = Number(latestStockIn.costPrice);
          } else {
            unitCost = 0;
          }

          inventoryValue = totalQuantity * unitCost;
          productWarehouseVal = warehouseQuantity * unitCost;
          productShopVal = shopQuantity * unitCost;
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

  async getSalesReport(query: QuerySalesReportDto) {
    const rawStart = query.startDate || query.date;
    const rawEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (rawStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim())) {
        parsedStart = new Date(`${rawStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(rawStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (rawEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawEnd.trim())) {
        parsedEnd = new Date(`${rawEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(rawEnd);
        if (
          !rawEnd.includes('T') &&
          parsedEnd.getHours() === 0 &&
          parsedEnd.getMinutes() === 0 &&
          parsedEnd.getSeconds() === 0
        ) {
          parsedEnd.setHours(23, 59, 59, 999);
        }
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

    if (query.productType || query.trackingType) {
      where.product = {};
      if (query.productType) {
        where.product.productType = query.productType;
      }
      if (query.trackingType) {
        where.product.trackingType = query.trackingType;
      }
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

    const saleMovements = await this.prisma.stockMovement.findMany({
      where,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let totalSalesCount = saleMovements.length;
    let totalQuantitySold = 0;
    let totalRevenue = 0;

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        brand: string;
        productType: ProductType;
        trackingType: TrackingType;
        sellingPrice: number;
        salesCount: number;
        quantitySold: number;
        totalRevenue: number;
      }
    >();

    for (const movement of saleMovements) {
      const qty = movement.quantity;
      const unitPrice = movement.product.sellingPrice
        ? Number(movement.product.sellingPrice)
        : 0;
      const revenue = qty * unitPrice;

      totalQuantitySold += qty;
      totalRevenue += revenue;

      if (!productMap.has(movement.productId)) {
        productMap.set(movement.productId, {
          productId: movement.productId,
          productName: movement.product.name,
          brand: movement.product.brand,
          productType: movement.product.productType,
          trackingType: movement.product.trackingType,
          sellingPrice: unitPrice,
          salesCount: 0,
          quantitySold: 0,
          totalRevenue: 0,
        });
      }

      const pData = productMap.get(movement.productId)!;
      pData.salesCount += 1;
      pData.quantitySold += qty;
      pData.totalRevenue = Number((pData.totalRevenue + revenue).toFixed(2));
    }

    const byProduct = Array.from(productMap.values());

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      summary: {
        totalSalesCount,
        totalQuantitySold,
        totalRevenue: Number(totalRevenue.toFixed(2)),
      },
      byProduct,
    };
  }

  async getProfitReport(query: QueryProfitReportDto) {
    const rawStart = query.startDate || query.date;
    const rawEnd = query.endDate || query.date;

    let parsedStart: Date | null = null;
    if (rawStart) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim())) {
        parsedStart = new Date(`${rawStart.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(rawStart);
      }
    }

    let parsedEnd: Date | null = null;
    if (rawEnd) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawEnd.trim())) {
        parsedEnd = new Date(`${rawEnd.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(rawEnd);
        if (
          !rawEnd.includes('T') &&
          parsedEnd.getHours() === 0 &&
          parsedEnd.getMinutes() === 0 &&
          parsedEnd.getSeconds() === 0
        ) {
          parsedEnd.setHours(23, 59, 59, 999);
        }
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

    if (query.productType || query.trackingType) {
      where.product = {};
      if (query.productType) {
        where.product.productType = query.productType;
      }
      if (query.trackingType) {
        where.product.trackingType = query.trackingType;
      }
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

    const saleMovements = await this.prisma.stockMovement.findMany({
      where,
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
        movementUnits: {
          include: {
            productUnit: {
              select: {
                id: true,
                purchasePrice: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const quantityProductIds = Array.from(
      new Set(
        saleMovements
          .filter((m) => m.product.trackingType === TrackingType.QUANTITY)
          .map((m) => m.productId),
      ),
    );

    const quantityUnitCostMap = new Map<string, number>();

    for (const pid of quantityProductIds) {
      const latestStockIn = await this.prisma.stockMovement.findFirst({
        where: {
          productId: pid,
          movementType: MovementType.STOCK_IN,
          costPrice: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (latestStockIn && latestStockIn.costPrice) {
        quantityUnitCostMap.set(pid, Number(latestStockIn.costPrice));
      } else {
        quantityUnitCostMap.set(pid, 0);
      }
    }

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalQuantitySold = 0;

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        brand: string;
        productType: ProductType;
        trackingType: TrackingType;
        quantitySold: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
        grossMarginPercentage: number;
      }
    >();

    for (const movement of saleMovements) {
      const qty = movement.quantity;
      const sellingPrice = movement.product.sellingPrice
        ? Number(movement.product.sellingPrice)
        : 0;
      const movementRevenue = qty * sellingPrice;

      let movementCogs = 0;

      if (movement.product.trackingType === TrackingType.SERIALIZED) {
        for (const mu of movement.movementUnits) {
          const uCost = mu.productUnit.purchasePrice
            ? Number(mu.productUnit.purchasePrice)
            : 0;
          movementCogs += uCost;
        }
      } else if (movement.product.trackingType === TrackingType.QUANTITY) {
        const unitCost = quantityUnitCostMap.get(movement.productId) || 0;
        movementCogs = qty * unitCost;
      }

      totalQuantitySold += qty;
      totalRevenue += movementRevenue;
      totalCogs += movementCogs;

      if (!productMap.has(movement.productId)) {
        productMap.set(movement.productId, {
          productId: movement.productId,
          productName: movement.product.name,
          brand: movement.product.brand,
          productType: movement.product.productType,
          trackingType: movement.product.trackingType,
          quantitySold: 0,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          grossMarginPercentage: 0,
        });
      }

      const pData = productMap.get(movement.productId)!;
      pData.quantitySold += qty;
      pData.revenue += movementRevenue;
      pData.cogs += movementCogs;
    }

    const byProduct = Array.from(productMap.values()).map((p) => {
      const grossProfit = p.revenue - p.cogs;
      const grossMarginPercentage =
        p.revenue > 0 ? (grossProfit / p.revenue) * 100 : 0;

      return {
        ...p,
        revenue: Number(p.revenue.toFixed(2)),
        cogs: Number(p.cogs.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        grossMarginPercentage: Number(grossMarginPercentage.toFixed(2)),
      };
    });

    const totalGrossProfit = totalRevenue - totalCogs;
    const overallGrossMarginPercentage =
      totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      summary: {
        totalQuantitySold,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCogs: Number(totalCogs.toFixed(2)),
        totalGrossProfit: Number(totalGrossProfit.toFixed(2)),
        grossMarginPercentage: Number(overallGrossMarginPercentage.toFixed(2)),
      },
      byProduct,
    };
  }
}
