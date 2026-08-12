import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly reportsService: ReportsService,
  ) {}

  async getDashboard() {
    const todayStr = new Date().toISOString().split('T')[0];

    const [inventorySummary, lowStockItems, inventoryValueReport] =
      await Promise.all([
        this.inventoryService.getSummary(),
        this.inventoryService.getLowStock({ outOfStock: false }),
        this.reportsService.getInventoryValueReport(),
      ]);

    const [todaySalesReport, todayProfitReport] = await Promise.all([
      this.reportsService.getSalesReport({
        startDate: todayStr,
        endDate: todayStr,
      }),
      this.reportsService.getProfitReport({
        startDate: todayStr,
        endDate: todayStr,
      }),
    ]);

    const formattedLowStock = lowStockItems.slice(0, 5).map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      brand: item.product.brand,
      productType: item.product.productType,
      trackingType: item.product.trackingType,
      warehouseQuantity: item.warehouseQuantity,
      shopQuantity: item.shopQuantity,
      totalQuantity: item.totalQuantity,
      minimumStock: item.product.minimumStock,
      isOutOfStock: item.totalQuantity === 0,
    }));

    const rawRecentMovements = await this.prisma.stockMovement.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const recentMovements = rawRecentMovements.map((m) => ({
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
      },
      createdBy: {
        id: m.createdBy.id,
        name: m.createdBy.name,
      },
    }));

    const topSellingProducts = todaySalesReport.byProduct.slice(0, 5).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      brand: p.brand,
      productType: p.productType,
      trackingType: p.trackingType,
      quantitySold: p.quantitySold,
      revenue: p.salesValue,
    }));

    return {
      inventory: {
        totalProducts: inventorySummary.totalProducts,
        totalInventoryUnits: inventorySummary.totalUnits,
        warehouseUnits: inventorySummary.warehouseUnits,
        shopUnits: inventorySummary.shopUnits,
        lowStockProducts: inventorySummary.lowStockProducts,
        outOfStockProducts: inventorySummary.outOfStockProducts,
      },
      inventoryValue: {
        totalInventoryValue: inventoryValueReport.summary.totalInventoryValue,
        warehouseValue: inventoryValueReport.summary.warehouseValue,
        shopValue: inventoryValueReport.summary.shopValue,
      },
      today: {
        sales: {
          totalSales: todaySalesReport.summary.totalSales,
          totalQuantitySold: todaySalesReport.summary.totalQuantitySold,
          totalRevenue: todaySalesReport.summary.totalSalesValue,
        },
        profit: {
          totalCost: todayProfitReport.summary.totalCost,
          grossProfit: todayProfitReport.summary.grossProfit,
          grossMarginPercentage: todayProfitReport.summary.grossMarginPercentage,
        },
      },
      lowStock: formattedLowStock,
      recentMovements,
      topSellingProducts,
    };
  }
}
