import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, TrackingType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum StockStatusFilter {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class QueryProductDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (minimum 1)',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page (minimum 1, maximum 100)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Search string matching product name or brand (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    example: ProductType.PHONE,
    description: 'Filter by Product Type',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    enum: TrackingType,
    example: TrackingType.SERIALIZED,
    description: 'Filter by Tracking Type (SERIALIZED or QUANTITY)',
  })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({
    example: 'uuid-category-id',
    description: 'Filter by Category ID',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status (if omitted, returns both active and inactive)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: StockStatusFilter,
    example: StockStatusFilter.LOW_STOCK,
    description: 'Filter by stock status (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)',
  })
  @IsEnum(StockStatusFilter)
  @IsOptional()
  stockStatus?: StockStatusFilter;
}
