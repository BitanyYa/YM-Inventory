import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, ProductType, TrackingType } from '@prisma/client';
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

export enum InventoryStockStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class QueryInventoryDto {
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
    enum: InventoryStockStatus,
    description: 'Filter by Stock Status (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)',
  })
  @IsEnum(InventoryStockStatus)
  @IsOptional()
  stockStatus?: InventoryStockStatus;

  @ApiPropertyOptional({
    enum: InventoryStockStatus,
    description: 'Filter by Stock Status (alias for stockStatus)',
  })
  @IsEnum(InventoryStockStatus)
  @IsOptional()
  status?: InventoryStockStatus;

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
    description: 'Filter products by Location (WAREHOUSE, SHOP)',
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

  @ApiPropertyOptional({
    description: 'Filter low stock products (totalQuantity <= minimumStock)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({
    description: 'Filter active/inactive products (default true)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
