import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, MovementType } from '@prisma/client';
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

export class QueryStockMovementDto {
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
    description: 'Filter movements created on or after this date string',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-31T23:59:59.999Z',
    description: 'Filter movements created on or before this date string',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
