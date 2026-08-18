import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, TrackingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryStockSaleDto {
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

  @ApiPropertyOptional({ description: 'Filter sales transactions by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    description: 'Filter sales by Product Type (e.g. PHONE, ACCESSORY)',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    enum: TrackingType,
    description: 'Filter sales by Tracking Type (QUANTITY, SERIALIZED)',
  })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({ description: 'Filter sales created by User ID' })
  @IsString()
  @IsOptional()
  createdById?: string;

  @ApiPropertyOptional({
    example: '2026-08-17',
    description: 'Single date filter (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Filter sales on or after this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-17',
    description: 'Filter sales on or before this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Search product by name or brand (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
