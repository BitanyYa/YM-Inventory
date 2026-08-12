import { Injectable } from '@nestjs/common';
import { Location, Prisma, TrackingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryLowStockDto } from './dto/query-low-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProcessedInventoryItems(
    productWhere: Prisma.ProductWhereInput = {},
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        ...productWhere,
        isActive: true, // Only process active products
      },
      include: {
        category: true,
        inventory: true,
        productUnits: {
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
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return products.map((product) => {
      const warehouseRecord = product.inventory.find(
        (i) => i.location === Location.WAREHOUSE,
      );
      const shopRecord = product.inventory.find(
        (i) => i.location === Location.SHOP,
      );

      const warehouseQuantity = warehouseRecord ? warehouseRecord.quantity : 0;
      const shopQuantity = shopRecord ? shopRecord.quantity : 0;
      const totalQuantity = warehouseQuantity + shopQuantity;
      const isLowStock = totalQuantity <= product.minimumStock;
      const isOutOfStock = totalQuantity === 0;

      const { inventory, productUnits, ...productData } = product;

      return {
        product: productData,
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
        isLowStock,
        isOutOfStock,
        rawUnits: productUnits || [],
        trackingType: product.trackingType,
      };
    });
  }

  async findInventory(query: QueryInventoryDto) {
    const productWhere: Prisma.ProductWhereInput = {};

    if (query.productId) {
      productWhere.id = query.productId;
    }
    if (query.categoryId) {
      productWhere.categoryId = query.categoryId;
    }
    if (query.productType) {
      productWhere.productType = query.productType;
    }
    if (query.trackingType) {
      productWhere.trackingType = query.trackingType;
    }

    const items = await this.getProcessedInventoryItems(productWhere);

    const results: any[] = [];

    for (const item of items) {
      // Location filter evaluation
      if (query.location) {
        if (
          query.location === Location.WAREHOUSE &&
          item.warehouseQuantity <= 0
        ) {
          continue;
        }
        if (query.location === Location.SHOP && item.shopQuantity <= 0) {
          continue;
        }
      }

      // Low stock filter evaluation
      if (query.lowStock !== undefined) {
        if (query.lowStock === true && !item.isLowStock) {
          continue;
        }
        if (query.lowStock === false && item.isLowStock) {
          continue;
        }
      }

      // Filter product units based on location if specified
      let units = item.rawUnits;
      if (query.location) {
        units = units.filter((unit) => unit.location === query.location);
      }

      results.push({
        product: item.product,
        warehouseQuantity: item.warehouseQuantity,
        shopQuantity: item.shopQuantity,
        totalQuantity: item.totalQuantity,
        isLowStock: item.isLowStock,
        units: item.trackingType === TrackingType.SERIALIZED ? units : [],
      });
    }

    return results;
  }

  async getSummary() {
    const items = await this.getProcessedInventoryItems();

    let totalUnits = 0;
    let warehouseUnits = 0;
    let shopUnits = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;

    for (const item of items) {
      warehouseUnits += item.warehouseQuantity;
      shopUnits += item.shopQuantity;
      totalUnits += item.totalQuantity;

      if (item.isLowStock) {
        lowStockProducts++;
      }
      if (item.isOutOfStock) {
        outOfStockProducts++;
      }
    }

    return {
      totalProducts: items.length,
      totalUnits,
      warehouseUnits,
      shopUnits,
      lowStockProducts,
      outOfStockProducts,
    };
  }

  async getLowStock(query: QueryLowStockDto) {
    const items = await this.getProcessedInventoryItems();

    const filteredItems = items.filter((item) => {
      if (query.outOfStock === true) {
        return item.isOutOfStock;
      }
      return item.isLowStock;
    });

    // Sort low stock results: totalQuantity ASC, then product name ASC
    filteredItems.sort((a, b) => {
      if (a.totalQuantity !== b.totalQuantity) {
        return a.totalQuantity - b.totalQuantity;
      }
      return a.product.name.localeCompare(b.product.name);
    });

    return filteredItems.map((item) => ({
      product: item.product,
      warehouseQuantity: item.warehouseQuantity,
      shopQuantity: item.shopQuantity,
      totalQuantity: item.totalQuantity,
      isLowStock: item.isLowStock,
      units: item.trackingType === TrackingType.SERIALIZED ? item.rawUnits : [],
    }));
  }
}
