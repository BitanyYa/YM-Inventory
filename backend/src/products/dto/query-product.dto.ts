import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, TrackingType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryProductDto {
  @ApiPropertyOptional({ description: 'Filter by Category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductType, description: 'Filter by Product Type' })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({ enum: TrackingType, description: 'Filter by Tracking Type' })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({ description: 'Filter by active status (default: true)', default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
