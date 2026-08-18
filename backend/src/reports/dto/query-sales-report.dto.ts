import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, TrackingType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class QuerySalesReportDto {
  @ApiPropertyOptional({
    example: '2026-08-17',
    description: 'Single date filter (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Start date for sales report (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-12',
    description: 'End date for sales report (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter sales by Product ID' })
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
}
