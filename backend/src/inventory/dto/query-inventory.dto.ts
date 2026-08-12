import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, ProductType, TrackingType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryInventoryDto {
  @ApiPropertyOptional({ description: 'Filter by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by Category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductType, description: 'Filter by Product Type' })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({ enum: TrackingType, description: 'Filter by Tracking Type (QUANTITY, SERIALIZED)' })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({ enum: Location, description: 'Filter products by Location (WAREHOUSE, SHOP)' })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({ description: 'Filter low stock products (totalQuantity <= minimumStock)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  lowStock?: boolean;
}
