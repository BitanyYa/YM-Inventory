import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrackingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
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

    return this.prisma.product.create({
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
  }

  async findAll(query: QueryProductDto) {
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
    } else {
      where.isActive = true;
    }

    return this.prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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

    return this.prisma.productUnit.findMany({
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
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return product;
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

    return unit;
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

    return this.prisma.productUnit.findMany({
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

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        category: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: {
        category: true,
      },
    });
  }
}
