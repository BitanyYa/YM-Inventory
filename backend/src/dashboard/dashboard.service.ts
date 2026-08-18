import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class DashboardService {
  constructor(private readonly reportsService: ReportsService) {}

  async getDashboard() {
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      inventorySummary,
      inventoryValueReport,
      todaySalesReport,
      todayProfitReport,
      lowStockReport,
      recentMovementsReport,
    ] = await Promise.all([
      this.reportsService['prisma'].product.findMany({ where: { isActive: true } }),
      this.reportsService.getInventoryValueReport(),
      this.reportsService.getSalesReport({ startDate: todayStr, endDate: todayStr }),
      this.reportsService.getProfitReport({ startDate: todayStr, endDate: todayStr }),
      this.reportsService['prisma'].product.findMany({
        where: { isActive: true },
        include: { inventory: true },
      }),
      this.reportsService.getStockMovementsReport({}),
    ]);

    let totalProducts = inventorySummary.length;
    let totalUnits = 0;
    let warehouseUnits = 0;
    let shopUnits = 0;
    let lowStockProductsCount = 0;
    let outOfStockProductsCount = 0;

    const lowStockList: any[] = [];

    for (const p of lowStockReport) {
      const wh = p.inventory.find((i) => i.location === 'WAREHOUSE')?.quantity || 0;
      const sh = p.inventory.find((i) => i.location === 'SHOP')?.quantity || 0;
      const tot = wh + sh;

      totalUnits += tot;
      warehouseUnits += wh;
      shopUnits += sh;

      if (tot === 0) {
        outOfStockProductsCount++;
      } else if (tot <= p.minimumStock) {
        lowStockProductsCount++;
      }

      if (tot <= p.minimumStock) {
        lowStockList.push({
          productId: p.id,
          productName: p.name,
          brand: p.brand,
          trackingType: p.trackingType,
          minimumStock: p.minimumStock,
          warehouseQuantity: wh,
          shopQuantity: sh,
          totalQuantity: tot,
        });
      }
    }

    const recentMovements = recentMovementsReport.byProduct.slice(0, 10);

    const topSellingProducts = todaySalesReport.byProduct.slice(0, 5).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      brand: p.brand,
      productType: p.productType,
      trackingType: p.trackingType,
      quantitySold: p.quantitySold,
      revenue: p.totalRevenue,
    }));

    return {
      inventory: {
        totalProducts,
        totalInventoryUnits: totalUnits,
        warehouseUnits,
        shopUnits,
        lowStockProducts: lowStockProductsCount,
        outOfStockProducts: outOfStockProductsCount,
      },
      inventoryValue: {
        totalInventoryValue: inventoryValueReport.summary.totalInventoryValue,
        warehouseValue: inventoryValueReport.summary.warehouseValue,
        shopValue: inventoryValueReport.summary.shopValue,
      },
      today: {
        sales: {
          totalSales: todaySalesReport.summary.totalSalesCount,
          totalQuantitySold: todaySalesReport.summary.totalQuantitySold,
          totalRevenue: todaySalesReport.summary.totalRevenue,
        },
        profit: {
          totalCost: todayProfitReport.summary.totalCogs,
          grossProfit: todayProfitReport.summary.totalGrossProfit,
          grossMarginPercentage: todayProfitReport.summary.grossMarginPercentage,
        },
      },
      lowStock: lowStockList,
      recentMovements,
      topSellingProducts,
    };
  }
}
