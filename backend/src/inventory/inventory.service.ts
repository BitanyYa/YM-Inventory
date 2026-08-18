import { Injectable, NotFoundException } from '@nestjs/common';
import { Location, Prisma, ProductType, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryStockStatus,
  QueryInventoryDto,
} from './dto/query-inventory.dto';
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

      let stockStatus: InventoryStockStatus;
      if (totalQuantity === 0) {
        stockStatus = InventoryStockStatus.OUT_OF_STOCK;
      } else if (totalQuantity <= product.minimumStock) {
        stockStatus = InventoryStockStatus.LOW_STOCK;
      } else {
        stockStatus = InventoryStockStatus.IN_STOCK;
      }

      // Filter active sellable units for serialized products
      const activeUnits = (product.productUnits || []).filter(
        (u) =>
          (u.location === Location.WAREHOUSE &&
            u.status === UnitStatus.AVAILABLE) ||
          (u.location === Location.SHOP && u.status === UnitStatus.IN_SHOP),
      );

      const { inventory, productUnits, ...productData } = product;

      return {
        product: productData,
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
        minimumStock: product.minimumStock,
        isLowStock,
        isOutOfStock,
        stockStatus,
        rawUnits: activeUnits,
        trackingType: product.trackingType,
      };
    });
  }

  async findInventory(query: QueryInventoryDto) {
    const productWhere: Prisma.ProductWhereInput = {
      isActive: true,
    };

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
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      productWhere.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
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

      // Stock status filter evaluation
      if (query.status) {
        if (item.stockStatus !== query.status) {
          continue;
        }
      }

      // Legacy lowStock boolean filter evaluation
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
        minimumStock: item.minimumStock,
        isLowStock: item.isLowStock,
        isOutOfStock: item.isOutOfStock,
        stockStatus: item.stockStatus,
        units: item.trackingType === TrackingType.SERIALIZED ? units : [],
      });
    }

    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;

    const total = results.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;
    const data = results.slice(startIndex, startIndex + limit);

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

  async getSummary() {
    const items = await this.getProcessedInventoryItems();

    let totalUnits = 0;
    let warehouseUnits = 0;
    let shopUnits = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;

    const byProductType: Record<ProductType, number> = {
      [ProductType.PHONE]: 0,
      [ProductType.ACCESSORY]: 0,
      [ProductType.TABLET]: 0,
      [ProductType.LAPTOP]: 0,
      [ProductType.SMART_WATCH]: 0,
      [ProductType.OTHER]: 0,
    };

    const byTrackingType: Record<TrackingType, number> = {
      [TrackingType.SERIALIZED]: 0,
      [TrackingType.QUANTITY]: 0,
    };

    const lowStockItems: any[] = [];

    for (const item of items) {
      warehouseUnits += item.warehouseQuantity;
      shopUnits += item.shopQuantity;
      totalUnits += item.totalQuantity;

      if (item.stockStatus === InventoryStockStatus.OUT_OF_STOCK) {
        outOfStockProducts++;
        lowStockItems.push({
          productId: item.product.id,
          name: item.product.name,
          brand: item.product.brand,
          productType: item.product.productType,
          trackingType: item.product.trackingType,
          warehouseQuantity: item.warehouseQuantity,
          shopQuantity: item.shopQuantity,
          totalQuantity: item.totalQuantity,
          minimumStock: item.minimumStock,
          stockStatus: InventoryStockStatus.OUT_OF_STOCK,
        });
      } else if (item.stockStatus === InventoryStockStatus.LOW_STOCK) {
        lowStockProducts++;
        lowStockItems.push({
          productId: item.product.id,
          name: item.product.name,
          brand: item.product.brand,
          productType: item.product.productType,
          trackingType: item.product.trackingType,
          warehouseQuantity: item.warehouseQuantity,
          shopQuantity: item.shopQuantity,
          totalQuantity: item.totalQuantity,
          minimumStock: item.minimumStock,
          stockStatus: InventoryStockStatus.LOW_STOCK,
        });
      }

      if (
        item.product.productType &&
        byProductType[item.product.productType as ProductType] !== undefined
      ) {
        byProductType[item.product.productType as ProductType]++;
      }
      if (
        item.product.trackingType &&
        byTrackingType[item.product.trackingType as TrackingType] !== undefined
      ) {
        byTrackingType[item.product.trackingType as TrackingType]++;
      }
    }

    // Sort lowStockItems: OUT_OF_STOCK first (ordered by name ASC), then LOW_STOCK by totalQuantity ASC (then name ASC)
    lowStockItems.sort((a, b) => {
      if (a.stockStatus !== b.stockStatus) {
        return a.stockStatus === InventoryStockStatus.OUT_OF_STOCK ? -1 : 1;
      }
      if (a.totalQuantity !== b.totalQuantity) {
        return a.totalQuantity - b.totalQuantity;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      totalProducts: items.length,
      totalUnits,
      warehouseUnits,
      shopUnits,
      lowStockProducts,
      outOfStockProducts,
      byProductType,
      byTrackingType,
      byLocation: {
        [Location.WAREHOUSE]: warehouseUnits,
        [Location.SHOP]: shopUnits,
      },
      lowStockItems,
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
      minimumStock: item.minimumStock,
      isLowStock: item.isLowStock,
      isOutOfStock: item.isOutOfStock,
      stockStatus: item.stockStatus,
      units: item.trackingType === TrackingType.SERIALIZED ? item.rawUnits : [],
    }));
  }

  async getProductInventoryDetail(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        inventory: true,
        productUnits: {
          where: {
            OR: [
              {
                location: Location.WAREHOUSE,
                status: UnitStatus.AVAILABLE,
              },
              {
                location: Location.SHOP,
                status: UnitStatus.IN_SHOP,
              },
            ],
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
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    const warehouseRecord = product.inventory.find(
      (i) => i.location === Location.WAREHOUSE,
    );
    const shopRecord = product.inventory.find(
      (i) => i.location === Location.SHOP,
    );

    const warehouseQuantity = warehouseRecord ? warehouseRecord.quantity : 0;
    const shopQuantity = shopRecord ? shopRecord.quantity : 0;
    const totalQuantity = warehouseQuantity + shopQuantity;

    let stockStatus: InventoryStockStatus;
    if (totalQuantity === 0) {
      stockStatus = InventoryStockStatus.OUT_OF_STOCK;
    } else if (totalQuantity <= product.minimumStock) {
      stockStatus = InventoryStockStatus.LOW_STOCK;
    } else {
      stockStatus = InventoryStockStatus.IN_STOCK;
    }

    let units: any[] = [];
    let warehouseAvailable = 0;
    let shopAvailable = 0;
    let totalAvailable = 0;

    if (product.trackingType === TrackingType.SERIALIZED) {
      units = (product.productUnits || []).map((u) => {
        if (u.location === Location.WAREHOUSE && u.status === UnitStatus.AVAILABLE) {
          warehouseAvailable++;
        } else if (u.location === Location.SHOP && u.status === UnitStatus.IN_SHOP) {
          shopAvailable++;
        }

        return {
          id: u.id,
          imei: u.imei,
          serialNumber: u.serialNumber,
          storage: u.storage,
          color: u.color,
          purchasePrice: u.purchasePrice ? Number(u.purchasePrice) : null,
          location: u.location,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        };
      });

      totalAvailable = warehouseAvailable + shopAvailable;
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        productType: product.productType,
        trackingType: product.trackingType,
        sellingPrice: product.sellingPrice ? Number(product.sellingPrice) : 0,
        minimumStock: product.minimumStock,
        isActive: product.isActive,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
            }
          : null,
      },
      inventory: {
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
        minimumStock: product.minimumStock,
        stockStatus,
      },
      unitSummary: {
        warehouseAvailable,
        shopAvailable,
        totalAvailable,
      },
      units,
    };
  }
}
