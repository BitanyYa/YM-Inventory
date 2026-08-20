import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, ProductType, TrackingType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class QueryStockSummaryDto {
  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter dashboard summary by Location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({
    enum: ProductType,
    description: 'Filter dashboard summary by Product Type (e.g. PHONE, ACCESSORY)',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    enum: TrackingType,
    description: 'Filter dashboard summary by Tracking Type (QUANTITY, SERIALIZED)',
  })
  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'Filter movements on or after this date string (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-20',
    description:
      'Filter movements on or before this date string (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
