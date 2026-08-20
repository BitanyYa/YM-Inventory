import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const trimmedName = dto.name.trim();

    const existing = await this.prisma.category.findUnique({
      where: { name: trimmedName },
    });

    if (existing) {
      throw new BadRequestException(
        `Category with name "${trimmedName}" already exists`,
      );
    }

    const category = await this.prisma.category.create({
      data: {
        name: trimmedName,
        description: dto.description ? dto.description.trim() : null,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      productCount: category._count.products,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      productCount: c._count.products,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      productCount: category._count.products,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    const dataToUpdate: any = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();

      if (trimmedName !== category.name) {
        const existingName = await this.prisma.category.findUnique({
          where: { name: trimmedName },
        });

        if (existingName) {
          throw new BadRequestException(
            `Category with name "${trimmedName}" already exists`,
          );
        }
      }

      dataToUpdate.name = trimmedName;
    }

    if (dto.description !== undefined) {
      dataToUpdate.description = dto.description
        ? dto.description.trim()
        : null;
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: dataToUpdate,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      productCount: updated._count.products,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        'Cannot delete category because it has products assigned to it',
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return {
      message: 'Category deleted successfully',
    };
  }
}
