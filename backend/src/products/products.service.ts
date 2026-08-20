import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Location, Prisma, TrackingType, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { QueryProductDto, StockStatusFilter } from './dto/query-product.dto';
import { QueryProductUnitDto } from './dto/query-product-unit.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        brand: dto.brand,
        productType: dto.productType,
        trackingType: dto.trackingType,
        categoryId: dto.categoryId,
        sellingPrice: dto.sellingPrice,
        minimumStock: dto.minimumStock ?? 0,
        description: dto.description,
        image: dto.image,
      },
      include: {
        category: true,
      },
    });

    return {
      ...product,
      sellingPrice: Number(product.sellingPrice),
    };
  }

  async findAll(query: QueryProductDto) {
    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit =
      query.limit && query.limit >= 1 && query.limit <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.productType) {
      where.productType = query.productType;
    }
    if (query.trackingType) {
      where.trackingType = query.trackingType;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const mapProduct = (p: any) => {
      const warehouseRecord = (p.inventory || []).find(
        (i: any) => i.location === Location.WAREHOUSE,
      );
      const shopRecord = (p.inventory || []).find(
        (i: any) => i.location === Location.SHOP,
      );

      const warehouseQuantity = warehouseRecord ? warehouseRecord.quantity : 0;
      const shopQuantity = shopRecord ? shopRecord.quantity : 0;
      const totalQuantity = warehouseQuantity + shopQuantity;

      let stockStatus: StockStatusFilter;
      if (totalQuantity === 0) {
        stockStatus = StockStatusFilter.OUT_OF_STOCK;
      } else if (totalQuantity <= p.minimumStock) {
        stockStatus = StockStatusFilter.LOW_STOCK;
      } else {
        stockStatus = StockStatusFilter.IN_STOCK;
      }

      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        productType: p.productType,
        trackingType: p.trackingType,
        sellingPrice: p.sellingPrice ? Number(p.sellingPrice) : 0,
        minimumStock: p.minimumStock,
        isActive: p.isActive,
        description: p.description,
        image: p.image,
        category: p.category
          ? {
              id: p.category.id,
              name: p.category.name,
            }
          : null,
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
        inventory: {
          warehouseQuantity,
          shopQuantity,
          totalQuantity,
        },
        stockStatus,
      };
    };

    if (query.stockStatus) {
      const allMatchingProducts = await this.prisma.product.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
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

      const mapped = allMatchingProducts.map(mapProduct);
      const filtered = mapped.filter(
        (p) => p.stockStatus === query.stockStatus,
      );

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
    } else {
      const [rawProducts, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            inventory: true,
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      const data = rawProducts.map(mapProduct);
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
  }

  async findAllUnits(query: QueryProductUnitDto) {
    const where: Prisma.ProductUnitWhereInput = {};

    if (query.imei) {
      where.imei = query.imei;
    }
    if (query.serialNumber) {
      where.serialNumber = query.serialNumber;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.location) {
      where.location = query.location;
    }
    if (query.status) {
      where.status = query.status;
    }

    const units = await this.prisma.productUnit.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
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
    });

    return units.map((u) => ({
      ...u,
      purchasePrice: u.purchasePrice ? Number(u.purchasePrice) : null,
      product: {
        ...u.product,
        sellingPrice: u.product.sellingPrice ? Number(u.product.sellingPrice) : 0,
      },
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        inventory: true,
        productUnits: {
          select: {
            id: true,
            location: true,
            status: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
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

    let warehouseAvailable = 0;
    let shopAvailable = 0;

    if (product.trackingType === TrackingType.SERIALIZED) {
      for (const u of product.productUnits || []) {
        if (u.location === Location.WAREHOUSE && u.status === UnitStatus.AVAILABLE) {
          warehouseAvailable++;
        } else if (u.location === Location.SHOP && u.status === UnitStatus.IN_SHOP) {
          shopAvailable++;
        }
      }
    }

    const availableUnits = warehouseAvailable + shopAvailable;

    let stockStatus: StockStatusFilter;
    if (totalQuantity === 0) {
      stockStatus = StockStatusFilter.OUT_OF_STOCK;
    } else if (totalQuantity <= product.minimumStock) {
      stockStatus = StockStatusFilter.LOW_STOCK;
    } else {
      stockStatus = StockStatusFilter.IN_STOCK;
    }

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      productType: product.productType,
      trackingType: product.trackingType,
      sellingPrice: product.sellingPrice ? Number(product.sellingPrice) : 0,
      minimumStock: product.minimumStock,
      isActive: product.isActive,
      description: product.description,
      image: product.image,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
          }
        : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      inventory: {
        warehouseQuantity,
        shopQuantity,
        totalQuantity,
      },
      stockStatus,
      unitSummary: {
        availableUnits,
        warehouseAvailable,
        shopAvailable,
      },
    };
  }

  async findUnit(unitId: string) {
    const unit = await this.prisma.productUnit.findUnique({
      where: { id: unitId },
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
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            productType: true,
            trackingType: true,
            sellingPrice: true,
            minimumStock: true,
            isActive: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Product unit with ID "${unitId}" not found`);
    }

    return {
      ...unit,
      purchasePrice: unit.purchasePrice ? Number(unit.purchasePrice) : null,
      product: {
        ...unit.product,
        sellingPrice: unit.product.sellingPrice
          ? Number(unit.product.sellingPrice)
          : 0,
      },
    };
  }

  async findUnitHistory(unitId: string) {
    const unit = await this.prisma.productUnit.findUnique({
      where: { id: unitId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            productType: true,
            trackingType: true,
            sellingPrice: true,
            minimumStock: true,
            isActive: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Product unit with ID "${unitId}" not found`);
    }

    const movementUnits = await this.prisma.stockMovementUnit.findMany({
      where: { productUnitId: unitId },
      include: {
        stockMovement: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: {
        stockMovement: {
          createdAt: 'asc',
        },
      },
    });

    const history = movementUnits.map((mu) => {
      const sm = mu.stockMovement;
      return {
        movementId: sm.id,
        movementType: sm.movementType,
        quantity: sm.quantity,
        fromLocation: sm.fromLocation,
        toLocation: sm.toLocation,
        costPrice: sm.costPrice ? Number(sm.costPrice) : null,
        note: sm.note,
        createdAt: sm.createdAt.toISOString(),
        createdBy: {
          id: sm.createdBy.id,
          name: sm.createdBy.name,
          email: sm.createdBy.email,
          role: sm.createdBy.role,
        },
      };
    });

    const totalMovements = history.length;
    const firstMovementAt = totalMovements > 0 ? history[0].createdAt : null;
    const lastMovementAt =
      totalMovements > 0 ? history[totalMovements - 1].createdAt : null;

    return {
      unit: {
        id: unit.id,
        imei: unit.imei,
        serialNumber: unit.serialNumber,
        storage: unit.storage,
        color: unit.color,
        purchasePrice: unit.purchasePrice ? Number(unit.purchasePrice) : null,
        location: unit.location,
        status: unit.status,
        createdAt: unit.createdAt.toISOString(),
        updatedAt: unit.updatedAt.toISOString(),
        product: {
          id: unit.product.id,
          name: unit.product.name,
          brand: unit.product.brand,
          productType: unit.product.productType,
          trackingType: unit.product.trackingType,
          sellingPrice: unit.product.sellingPrice
            ? Number(unit.product.sellingPrice)
            : 0,
          minimumStock: unit.product.minimumStock,
          isActive: unit.product.isActive,
        },
      },
      summary: {
        totalMovements,
        firstMovementAt,
        lastMovementAt,
      },
      history,
    };
  }

  async findUnits(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    if (product.trackingType !== TrackingType.SERIALIZED) {
      throw new BadRequestException(
        `Product "${product.name}" is QUANTITY-tracked. Product units are only applicable to SERIALIZED products.`,
      );
    }

    const units = await this.prisma.productUnit.findMany({
      where: { productId },
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
        createdAt: 'asc',
      },
    });

    return units.map((u) => ({
      ...u,
      purchasePrice: u.purchasePrice ? Number(u.purchasePrice) : null,
    }));
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
      }
    }

    const { trackingType, ...updateData }: any = dto;

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      ...updated,
      sellingPrice: updated.sellingPrice ? Number(updated.sellingPrice) : 0,
    };
  }

  async updateStatus(id: string, dto: UpdateProductStatusDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    if (product.isActive === dto.isActive) {
      return {
        ...product,
        sellingPrice: product.sellingPrice ? Number(product.sellingPrice) : 0,
      };
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: dto.isActive },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      ...updated,
      sellingPrice: updated.sellingPrice ? Number(updated.sellingPrice) : 0,
    };
  }

  async remove(id: string) {
    return this.updateStatus(id, { isActive: false });
  }
}
