import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, ProductType, TrackingType } from '@prisma/client';
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

export class QueryStockReturnDto {
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

  @ApiPropertyOptional({ description: 'Filter stock returns by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    description: 'Filter returns by Product Type (e.g. PHONE, ACCESSORY)',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    enum: TrackingType,
    description: 'Filter returns by Tracking Type (QUANTITY, SERIALIZED)',
  })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter returns by destination location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({ description: 'Filter returns created by User ID' })
  @IsString()
  @IsOptional()
  createdById?: string;

  @ApiPropertyOptional({
    example: '2026-08-18',
    description: 'Single date filter (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Filter returns on or after this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-18',
    description: 'Filter returns on or before this date (ISO string or YYYY-MM-DD)',
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
