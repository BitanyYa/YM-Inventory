import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, ProductType, TrackingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum AlertTypeFilter {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  IN_STOCK = 'IN_STOCK',
}

export class QueryInventoryAlertDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (default 1, min 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page limit (default 20, min 1, max 100)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: AlertTypeFilter,
    description: 'Filter by alert type (LOW_STOCK or OUT_OF_STOCK)',
  })
  @IsEnum(AlertTypeFilter)
  @IsOptional()
  alertType?: AlertTypeFilter;

  @ApiPropertyOptional({ description: 'Filter by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by Category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    description: 'Filter by Product Type (e.g. PHONE, ACCESSORY)',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    enum: TrackingType,
    description: 'Filter by Tracking Type (QUANTITY, SERIALIZED)',
  })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter by Location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Search product by name or brand (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
