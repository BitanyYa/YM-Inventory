import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, MovementType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryStockReportDto {
  @ApiPropertyOptional({
    example: '2026-08-17',
    description: 'Single date filter (ISO date or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Start date for report range (ISO date or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-12',
    description: 'End date for report range (ISO date or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    enum: MovementType,
    description: 'Filter by Movement Type (STOCK_IN, TRANSFER, SALE, RETURN, DAMAGE, LOSS)',
  })
  @IsEnum(MovementType)
  @IsOptional()
  movementType?: MovementType;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter by source location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  fromLocation?: Location;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter by destination location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  toLocation?: Location;
}
