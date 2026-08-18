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

export enum InventoryAlertStatus {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class QueryStockAlertDto {
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
    enum: InventoryAlertStatus,
    description: 'Filter stock alerts by status (LOW_STOCK, OUT_OF_STOCK)',
  })
  @IsEnum(InventoryAlertStatus)
  @IsOptional()
  status?: InventoryAlertStatus;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Search product by name or brand (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    description: 'Filter alerts by Product Type (e.g. PHONE, ACCESSORY)',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    enum: TrackingType,
    description: 'Filter alerts by Tracking Type (QUANTITY, SERIALIZED)',
  })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({
    enum: Location,
    description:
      'Filter alerts by Location (WAREHOUSE = warehouseQuantity > 0, SHOP = shopQuantity > 0)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({ description: 'Filter alerts by Category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;
}
