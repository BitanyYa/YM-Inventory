import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, MovementType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryStockMovementDto {
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

  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Filter movements created on or after this ISO date string',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-31T23:59:59.999Z',
    description: 'Filter movements created on or before this ISO date string',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
