import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalespersonDto } from './dto/create-salesperson.dto';
import { UpdateSalespersonDto } from './dto/update-salesperson.dto';
import { QuerySalespersonDto } from './dto/query-salesperson.dto';

@Injectable()
export class SalespeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSalespersonDto) {
    const trimmedName = dto.name ? dto.name.trim() : '';
    if (!trimmedName) {
      throw new BadRequestException('Salesperson name is required');
    }

    const trimmedPhone =
      dto.phone && dto.phone.trim() ? dto.phone.trim() : null;

    return this.prisma.salesperson.create({
      data: {
        name: trimmedName,
        phone: trimmedPhone,
      },
    });
  }

  async findAll(query?: QuerySalespersonDto) {
    const where: Prisma.SalespersonWhereInput = {};

    if (!query?.includeInactive) {
      where.isActive = true;
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.salesperson.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const salesperson = await this.prisma.salesperson.findUnique({
      where: { id },
    });

    if (!salesperson) {
      throw new NotFoundException(`Salesperson with ID "${id}" not found`);
    }

    return salesperson;
  }

  async update(id: string, dto: UpdateSalespersonDto) {
    await this.findOne(id);

    const data: Prisma.SalespersonUpdateInput = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Salesperson name cannot be empty');
      }
      data.name = trimmedName;
    }

    if (dto.phone !== undefined) {
      data.phone = dto.phone && dto.phone.trim() ? dto.phone.trim() : null;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return this.prisma.salesperson.update({
      where: { id },
      data,
    });
  }
}
