import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Location, MovementType, Prisma, ProductType, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryStockStatus,
  QueryInventoryDto,
} from './dto/query-inventory.dto';
import { QueryLowStockDto } from './dto/query-low-stock.dto';
import { QueryProductMovementDto } from './dto/query-product-movement.dto';
import { InventoryAlertStatus, QueryStockAlertDto } from './dto/query-stock-alert.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

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
    const activeFilter = query.isActive !== undefined ? query.isActive : true;

    const productWhere: Prisma.ProductWhereInput = {
      isActive: activeFilter,
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

    const products = await this.prisma.product.findMany({
      where: productWhere,
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
            location: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const targetStatus = query.stockStatus || query.status;

    const results: any[] = [];

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

      let stockStatus: InventoryStockStatus;
      if (totalQuantity === 0) {
        stockStatus = InventoryStockStatus.OUT_OF_STOCK;
      } else if (totalQuantity <= product.minimumStock) {
        stockStatus = InventoryStockStatus.LOW_STOCK;
      } else {
        stockStatus = InventoryStockStatus.IN_STOCK;
      }

      // Location filter evaluation
      if (query.location) {
        if (
          query.location === Location.WAREHOUSE &&
          warehouseQuantity <= 0
        ) {
          continue;
        }
        if (query.location === Location.SHOP && shopQuantity <= 0) {
          continue;
        }
      }

      // Stock status filter evaluation
      if (targetStatus && stockStatus !== targetStatus) {
        continue;
      }

      // Legacy lowStock boolean filter evaluation
      if (query.lowStock !== undefined) {
        const isLowStock = totalQuantity <= product.minimumStock;
        if (query.lowStock === true && !isLowStock) {
          continue;
        }
        if (query.lowStock === false && isLowStock) {
          continue;
        }
      }

      let unitSummary: {
        totalAvailable: number;
        warehouseAvailable: number;
        shopAvailable: number;
      } | null = null;

      if (product.trackingType === TrackingType.SERIALIZED) {
        let warehouseAvailable = 0;
        let shopAvailable = 0;

        for (const u of product.productUnits || []) {
          if (
            u.location === Location.WAREHOUSE &&
            u.status === UnitStatus.AVAILABLE
          ) {
            warehouseAvailable++;
          } else if (
            u.location === Location.SHOP &&
            u.status === UnitStatus.IN_SHOP
          ) {
            shopAvailable++;
          }
        }

        unitSummary = {
          totalAvailable: warehouseAvailable + shopAvailable,
          warehouseAvailable,
          shopAvailable,
        };
      }

      results.push({
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          productType: product.productType,
          trackingType: product.trackingType,
          sellingPrice: product.sellingPrice
            ? Number(product.sellingPrice)
            : 0,
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
        },
        unitSummary,
        stockStatus,
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

  async getProductMovementHistory(
    productId: string,
    query: QueryProductMovementDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        brand: true,
        productType: true,
        trackingType: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

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
      productId,
    };

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

    const [rawMovements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
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
        movementType: m.movementType,
        quantity: m.quantity,
        fromLocation: m.fromLocation,
        toLocation: m.toLocation,
        costPrice: m.costPrice ? Number(m.costPrice) : null,
        note: m.note,
        createdById: m.createdById,
        createdAt: m.createdAt.toISOString(),
        createdBy: {
          id: m.createdBy.id,
          name: m.createdBy.name,
          email: m.createdBy.email,
          role: m.createdBy.role,
        },
        stockBatch: m.stockBatch
          ? {
              id: m.stockBatch.id,
              reference: m.stockBatch.reference,
              note: m.stockBatch.note,
              createdAt: m.stockBatch.createdAt.toISOString(),
            }
          : null,
        units: product.trackingType === TrackingType.SERIALIZED ? units : [],
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        productType: product.productType,
        trackingType: product.trackingType,
      },
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getStockAlerts(query: QueryStockAlertDto) {
    const productWhere: Prisma.ProductWhereInput = {
      isActive: true, // Only active products
    };

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

    const products = await this.prisma.product.findMany({
      where: productWhere,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        inventory: true,
      },
    });

    const alerts: any[] = [];

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
      const minimumStock = product.minimumStock;

      let stockStatus: InventoryAlertStatus;
      let shortage = 0;

      if (totalQuantity === 0) {
        stockStatus = InventoryAlertStatus.OUT_OF_STOCK;
        shortage = minimumStock;
      } else if (totalQuantity <= minimumStock) {
        stockStatus = InventoryAlertStatus.LOW_STOCK;
        shortage = minimumStock - totalQuantity;
      } else {
        // IN_STOCK items are not included in alerts
        continue;
      }

      // Filter by status if specified
      if (query.status) {
        if (stockStatus !== query.status) {
          continue;
        }
      }

      // Filter by location if specified
      if (query.location) {
        if (query.location === Location.WAREHOUSE && warehouseQuantity <= 0) {
          continue;
        }
        if (query.location === Location.SHOP && shopQuantity <= 0) {
          continue;
        }
      }

      alerts.push({
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          productType: product.productType,
          trackingType: product.trackingType,
          minimumStock: product.minimumStock,
          sellingPrice: product.sellingPrice ? Number(product.sellingPrice) : 0,
          category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
              }
            : null,
        },
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
        minimumStock,
        stockStatus,
        shortage,
      });
    }

    // Urgency ordering: OUT_OF_STOCK first (largest shortage first, then name ASC), then LOW_STOCK (largest shortage first, then name ASC)
    alerts.sort((a, b) => {
      if (a.stockStatus !== b.stockStatus) {
        return a.stockStatus === InventoryAlertStatus.OUT_OF_STOCK ? -1 : 1;
      }
      if (a.shortage !== b.shortage) {
        return b.shortage - a.shortage;
      }
      return a.product.name.localeCompare(b.product.name);
    });

    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;

    const total = alerts.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;
    const data = alerts.slice(startIndex, startIndex + limit);

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

  async adjustInventory(dto: AdjustInventoryDto, userId: string) {
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
        `Product "${product.name}" is soft-deleted/inactive and cannot have inventory adjustments`,
      );
    }

    if (product.trackingType === TrackingType.SERIALIZED) {
      throw new BadRequestException(
        'Inventory adjustment endpoint is only for QUANTITY-tracked products. For SERIALIZED products, use damage/loss or stock movement endpoints.',
      );
    }

    const targetQuantity = dto.newQuantity !== undefined ? dto.newQuantity : (dto as any).targetQuantity;
    if (targetQuantity < 0) {
      throw new BadRequestException('newQuantity cannot be negative');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingInventory = await tx.inventory.findUnique({
        where: {
          productId_location: {
            productId: product.id,
            location: dto.location,
          },
        },
      });

      const currentQuantity = existingInventory ? existingInventory.quantity : 0;
      const difference = targetQuantity - currentQuantity;

      if (difference === 0) {
        throw new BadRequestException(
          `Inventory for product "${product.name}" at ${dto.location} is already at quantity ${targetQuantity}`,
        );
      }

      let updatedInventory;
      if (existingInventory) {
        updatedInventory = await tx.inventory.update({
          where: { id: existingInventory.id },
          data: { quantity: targetQuantity },
        });
      } else {
        updatedInventory = await tx.inventory.create({
          data: {
            productId: product.id,
            location: dto.location,
            quantity: targetQuantity,
          },
        });
      }

      let movementType: MovementType;
      if (difference > 0) {
        movementType = MovementType.STOCK_IN;
      } else {
        movementType = MovementType.DAMAGE;
      }

      const noteText = dto.note
        ? `Inventory Adjustment: ${dto.note}`
        : `Inventory Adjustment from ${currentQuantity} to ${targetQuantity}`;

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType,
          quantity: Math.abs(difference),
          fromLocation: difference < 0 ? dto.location : null,
          toLocation: difference > 0 ? dto.location : null,
          createdById: userId,
          note: noteText,
        },
      });

      return {
        message: 'Inventory quantity adjusted successfully',
        productId: product.id,
        location: dto.location,
        previousQuantity: currentQuantity,
        newQuantity: targetQuantity,
        difference,
        movement,
        inventory: updatedInventory,
      };
    });
  }
}
