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
import { AlertTypeFilter, QueryInventoryAlertDto } from './dto/query-inventory-alert.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProcessedInventoryItems(
    productWhere: Prisma.ProductWhereInput = {},
  ) {
    const products = await this.prisma.product.findMany({
      where: productWhere,
      include: {
        category: true,
        inventory: true,
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

      const { inventory, ...productData } = product;

      return {
        product: productData,
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
        minimumStock: product.minimumStock,
        isLowStock,
        isOutOfStock,
        stockStatus,
        rawUnits: [],
        trackingType: product.trackingType,
      };
    });
  }

  async findInventory(query: QueryInventoryDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const productWhere: Prisma.ProductWhereInput = {};

    if (query.isActive !== undefined) {
      productWhere.isActive = query.isActive;
    }

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

    const targetStatus = query.stockStatus || query.status;

    if (query.location === Location.WAREHOUSE) {
      productWhere.inventory = {
        some: {
          location: Location.WAREHOUSE,
          quantity: { gt: 0 },
        },
      };
    } else if (query.location === Location.SHOP) {
      productWhere.inventory = {
        some: {
          location: Location.SHOP,
          quantity: { gt: 0 },
        },
      };
    }

    if (targetStatus === InventoryStockStatus.IN_STOCK) {
      productWhere.inventory = {
        some: {
          quantity: { gt: 0 },
          ...(query.location ? { location: query.location } : {}),
        },
      };
    } else if (targetStatus === InventoryStockStatus.OUT_OF_STOCK) {
      productWhere.OR = [
        { inventory: { none: {} } },
        { inventory: { every: { quantity: 0 } } },
      ];
    } else if (targetStatus === InventoryStockStatus.DAMAGED) {
      productWhere.OR = [
        { productUnits: { some: { status: UnitStatus.DAMAGED } } },
        { stockMovements: { some: { movementType: MovementType.DAMAGE } } },
      ];
    }

    const commonInclude = {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      inventory: {
        select: {
          location: true,
          quantity: true,
        },
      },
      productUnits: {
        where: {
          status: UnitStatus.DAMAGED,
        },
        select: {
          id: true,
        },
      },
      stockMovements: {
        where: { movementType: MovementType.DAMAGE },
        select: { quantity: true },
      },
    };

    const mapProduct = (product: any) => {
      const warehouseRecord = product.inventory?.find(
        (i: any) => i.location === Location.WAREHOUSE,
      );
      const shopRecord = product.inventory?.find(
        (i: any) => i.location === Location.SHOP,
      );

      const warehouseQuantity = warehouseRecord ? warehouseRecord.quantity : 0;
      const shopQuantity = shopRecord ? shopRecord.quantity : 0;
      const totalQuantity = warehouseQuantity + shopQuantity;

      const damagedUnits = (product.productUnits || []).length;
      const damagedMovements = (product.stockMovements || []).reduce(
        (acc: number, m: any) => acc + (m.quantity || 0),
        0,
      );
      const damagedQuantity =
        product.trackingType === TrackingType.SERIALIZED
          ? damagedUnits
          : damagedMovements;

      let stockStatus: InventoryStockStatus;
      if (totalQuantity === 0) {
        stockStatus = InventoryStockStatus.OUT_OF_STOCK;
      } else if (totalQuantity <= product.minimumStock) {
        stockStatus = InventoryStockStatus.LOW_STOCK;
      } else {
        stockStatus = InventoryStockStatus.IN_STOCK;
      }

      let unitSummary: {
        totalAvailable: number;
        warehouseAvailable: number;
        shopAvailable: number;
      } | null = null;

      if (product.trackingType === TrackingType.SERIALIZED) {
        unitSummary = {
          totalAvailable: warehouseQuantity + shopQuantity,
          warehouseAvailable: warehouseQuantity,
          shopAvailable: shopQuantity,
        };
      }

      return {
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
          damagedQuantity,
        },
        unitSummary,
        stockStatus,
      };
    };

    // Fast-path: When status is not LOW_STOCK and lowStock boolean is not requested,
    // all filtering is performed directly in PostgreSQL!
    if (targetStatus !== InventoryStockStatus.LOW_STOCK && query.lowStock === undefined) {
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: productWhere,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: commonInclude,
        }),
        this.prisma.product.count({ where: productWhere }),
      ]);

      const data = products.map(mapProduct);
      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

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

    // In-memory post-filtering only when dynamic minimumStock comparison is needed
    const products = await this.prisma.product.findMany({
      where: {
        ...productWhere,
        inventory: { some: { quantity: { gt: 0 } } },
      },
      include: commonInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const mapped = products.map(mapProduct);
    const filtered = mapped.filter((p) => {
      if (targetStatus === InventoryStockStatus.LOW_STOCK) {
        return p.stockStatus === InventoryStockStatus.LOW_STOCK;
      }
      if (query.lowStock !== undefined) {
        const isLow = p.inventory.totalQuantity <= p.product.minimumStock;
        return query.lowStock ? isLow : !isLow;
      }
      return true;
    });

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const data = filtered.slice(skip, skip + limit);

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
    const [whAgg, shopAgg, damagedUnitsCount, damagedMovementsCount, products] = await Promise.all([
      this.prisma.inventory.aggregate({
        where: { location: Location.WAREHOUSE },
        _sum: { quantity: true },
      }),
      this.prisma.inventory.aggregate({
        where: { location: Location.SHOP },
        _sum: { quantity: true },
      }),
      this.prisma.productUnit.count({
        where: { status: UnitStatus.DAMAGED },
      }),
      this.prisma.stockMovement.aggregate({
        where: { movementType: MovementType.DAMAGE },
        _sum: { quantity: true },
      }),
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          brand: true,
          productType: true,
          trackingType: true,
          minimumStock: true,
          inventory: {
            select: {
              location: true,
              quantity: true,
            },
          },
        },
      }),
    ]);

    const warehouseUnits = whAgg._sum.quantity || 0;
    const shopUnits = shopAgg._sum.quantity || 0;
    const totalUnits = warehouseUnits + shopUnits;
    const damagedUnits =
      damagedUnitsCount + (damagedMovementsCount._sum.quantity || 0);

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

    for (const p of products) {
      const wh = p.inventory?.find((i) => i.location === Location.WAREHOUSE)?.quantity || 0;
      const sh = p.inventory?.find((i) => i.location === Location.SHOP)?.quantity || 0;
      const tot = wh + sh;

      if (tot === 0) {
        outOfStockProducts++;
        lowStockItems.push({
          productId: p.id,
          name: p.name,
          brand: p.brand,
          productType: p.productType,
          trackingType: p.trackingType,
          warehouseQuantity: wh,
          shopQuantity: sh,
          totalQuantity: tot,
          minimumStock: p.minimumStock,
          stockStatus: InventoryStockStatus.OUT_OF_STOCK,
        });
      } else if (tot <= p.minimumStock) {
        lowStockProducts++;
        lowStockItems.push({
          productId: p.id,
          name: p.name,
          brand: p.brand,
          productType: p.productType,
          trackingType: p.trackingType,
          warehouseQuantity: wh,
          shopQuantity: sh,
          totalQuantity: tot,
          minimumStock: p.minimumStock,
          stockStatus: InventoryStockStatus.LOW_STOCK,
        });
      }

      if (p.productType && byProductType[p.productType] !== undefined) {
        byProductType[p.productType]++;
      }
      if (p.trackingType && byTrackingType[p.trackingType] !== undefined) {
        byTrackingType[p.trackingType]++;
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
      totalProducts: products.length,
      totalUnits,
      warehouseUnits,
      shopUnits,
      lowStockProducts,
      outOfStockProducts,
      damagedUnits,
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

  async getInventoryAlerts(query: QueryInventoryAlertDto) {
    if (query.alertType === AlertTypeFilter.IN_STOCK) {
      throw new BadRequestException(
        'alertType cannot be IN_STOCK for stock alerts',
      );
    }

    const productWhere: Prisma.ProductWhereInput = {
      isActive: true, // Only active products
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
      },
      orderBy: {
        name: 'asc',
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

      let warehouseQuantity = warehouseRecord ? warehouseRecord.quantity : 0;
      let shopQuantity = shopRecord ? shopRecord.quantity : 0;

      if (query.location === Location.WAREHOUSE) {
        shopQuantity = 0;
      } else if (query.location === Location.SHOP) {
        warehouseQuantity = 0;
      }

      const totalQuantity = warehouseQuantity + shopQuantity;
      const minimumStock = product.minimumStock;

      let stockStatus: InventoryStockStatus;
      let shortage = 0;

      if (totalQuantity === 0) {
        stockStatus = InventoryStockStatus.OUT_OF_STOCK;
        shortage = minimumStock;
      } else if (totalQuantity <= minimumStock) {
        stockStatus = InventoryStockStatus.LOW_STOCK;
        shortage = Math.max(0, minimumStock - totalQuantity);
      } else {
        // IN_STOCK product - not an alert
        continue;
      }

      // Filter by alertType if specified
      if (query.alertType) {
        if (
          query.alertType === AlertTypeFilter.LOW_STOCK &&
          stockStatus !== InventoryStockStatus.LOW_STOCK
        ) {
          continue;
        }
        if (
          query.alertType === AlertTypeFilter.OUT_OF_STOCK &&
          stockStatus !== InventoryStockStatus.OUT_OF_STOCK
        ) {
          continue;
        }
      }

      let unitSummary: {
        totalAvailable: number;
        warehouseAvailable: number;
        shopAvailable: number;
      } | null = null;

      if (product.trackingType === TrackingType.SERIALIZED) {
        unitSummary = {
          totalAvailable: totalQuantity,
          warehouseAvailable: warehouseQuantity,
          shopAvailable: shopQuantity,
        };
      }

      alerts.push({
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
        shortage,
      });
    }

    // Urgency sorting: OUT_OF_STOCK first, then LOW_STOCK. Within same status, highest shortage first, then name ASC.
    alerts.sort((a, b) => {
      if (a.stockStatus !== b.stockStatus) {
        return a.stockStatus === InventoryStockStatus.OUT_OF_STOCK ? -1 : 1;
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
}
