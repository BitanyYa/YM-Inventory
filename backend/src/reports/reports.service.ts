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

  async getSalesReport(query: QuerySalesReportDto) {
    let parsedStart: Date | null = null;
    if (query.startDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.startDate.trim())) {
        parsedStart = new Date(`${query.startDate.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(query.startDate);
      }
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

    const totalSales = saleMovements.length;
    let totalQuantitySold = 0;
    let totalSalesValue = 0;

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        brand: string;
        productType: ProductType;
        trackingType: TrackingType;
        quantitySold: number;
        salesValue: number;
      }
    >();

    for (const movement of saleMovements) {
      const product = movement.product;
      const qty = movement.quantity;
      const price = product?.sellingPrice ? Number(product.sellingPrice) : 0;
      const movementSalesValue = qty * price;

      totalQuantitySold += qty;
      totalSalesValue += movementSalesValue;

      let pData = productMap.get(movement.productId);
      if (!pData) {
        pData = {
          productId: movement.productId,
          productName: product?.name || 'Unknown Product',
          brand: product?.brand || '',
          productType: product?.productType,
          trackingType: product?.trackingType,
          quantitySold: 0,
          salesValue: 0,
        };
        productMap.set(movement.productId, pData);
      }

      pData.quantitySold += qty;
      pData.salesValue += movementSalesValue;
    }

    const byProduct = Array.from(productMap.values()).map((p) => ({
      ...p,
      salesValue: Number(p.salesValue.toFixed(2)),
    }));

    byProduct.sort((a, b) => {
      if (b.quantitySold !== a.quantitySold) {
        return b.quantitySold - a.quantitySold;
      }
      return a.productName.localeCompare(b.productName);
    });

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      summary: {
        totalSales,
        totalQuantitySold,
        totalSalesValue: Number(totalSalesValue.toFixed(2)),
      },
      byProduct,
    };
  }

  async getProfitReport(query: QueryProfitReportDto) {
    let parsedStart: Date | null = null;
    if (query.startDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.startDate.trim())) {
        parsedStart = new Date(`${query.startDate.trim()}T00:00:00.000Z`);
      } else {
        parsedStart = new Date(query.startDate);
      }
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
          .filter((m) => m.product?.trackingType === TrackingType.QUANTITY)
          .map((m) => m.productId),
      ),
    );

    const stockInMap = new Map<string, number>();

    if (quantityProductIds.length > 0) {
      const stockInMovements = await this.prisma.stockMovement.findMany({
        where: {
          productId: { in: quantityProductIds },
          movementType: MovementType.STOCK_IN,
          costPrice: { not: null },
        },
        select: {
          productId: true,
          quantity: true,
          costPrice: true,
        },
      });

      const stockInAgg = new Map<string, { totalQty: number; totalCost: number }>();
      for (const sm of stockInMovements) {
        const cost = sm.costPrice ? Number(sm.costPrice) : 0;
        const qty = sm.quantity;
        let entry = stockInAgg.get(sm.productId);
        if (!entry) {
          entry = { totalQty: 0, totalCost: 0 };
          stockInAgg.set(sm.productId, entry);
        }
        entry.totalQty += qty;
        entry.totalCost += qty * cost;
      }

      for (const [pId, entry] of stockInAgg.entries()) {
        const avgCost = entry.totalQty > 0 ? entry.totalCost / entry.totalQty : 0;
        stockInMap.set(pId, avgCost);
      }
    }

    let totalRevenue = 0;
    let totalCost = 0;
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
        cost: number;
      }
    >();

    for (const movement of saleMovements) {
      const product = movement.product;
      const qty = movement.quantity;
      const sellingPrice = product?.sellingPrice ? Number(product.sellingPrice) : 0;
      const movementRevenue = qty * sellingPrice;

      let movementCost = 0;

      if (product?.trackingType === TrackingType.SERIALIZED) {
        for (const mu of movement.movementUnits) {
          if (mu.productUnit && mu.productUnit.purchasePrice) {
            movementCost += Number(mu.productUnit.purchasePrice);
          }
        }
      } else if (product?.trackingType === TrackingType.QUANTITY) {
        const avgUnitCost = stockInMap.get(movement.productId) || 0;
        movementCost = qty * avgUnitCost;
      }

      totalRevenue += movementRevenue;
      totalCost += movementCost;
      totalQuantitySold += qty;

      let pData = productMap.get(movement.productId);
      if (!pData) {
        pData = {
          productId: movement.productId,
          productName: product?.name || 'Unknown Product',
          brand: product?.brand || '',
          productType: product?.productType,
          trackingType: product?.trackingType,
          quantitySold: 0,
          revenue: 0,
          cost: 0,
        };
        productMap.set(movement.productId, pData);
      }

      pData.quantitySold += qty;
      pData.revenue += movementRevenue;
      pData.cost += movementCost;
    }

    const overallGrossProfit = Number((totalRevenue - totalCost).toFixed(2));
    const overallGrossMarginPercentage =
      totalRevenue > 0
        ? Number(((overallGrossProfit / totalRevenue) * 100).toFixed(2))
        : 0;

    const byProduct = Array.from(productMap.values()).map((p) => {
      const pRevenue = Number(p.revenue.toFixed(2));
      const pCost = Number(p.cost.toFixed(2));
      const pGrossProfit = Number((pRevenue - pCost).toFixed(2));
      const pGrossMarginPercentage =
        pRevenue > 0
          ? Number(((pGrossProfit / pRevenue) * 100).toFixed(2))
          : 0;

      return {
        productId: p.productId,
        productName: p.productName,
        brand: p.brand,
        productType: p.productType,
        trackingType: p.trackingType,
        quantitySold: p.quantitySold,
        revenue: pRevenue,
        cost: pCost,
        grossProfit: pGrossProfit,
        grossMarginPercentage: pGrossMarginPercentage,
      };
    });

    byProduct.sort((a, b) => {
      if (b.grossProfit !== a.grossProfit) {
        return b.grossProfit - a.grossProfit;
      }
      return a.productName.localeCompare(b.productName);
    });

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        grossProfit: overallGrossProfit,
        grossMarginPercentage: overallGrossMarginPercentage,
        totalQuantitySold,
      },
      byProduct,
    };
  }
}
