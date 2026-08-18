import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, MovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QueryProductMovementDto {
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
    enum: MovementType,
    description:
      'Filter movements by Movement Type (STOCK_IN, TRANSFER, SALE, RETURN, DAMAGE, LOSS)',
  })
  @IsEnum(MovementType)
  @IsOptional()
  movementType?: MovementType;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter movements by source location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  fromLocation?: Location;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter movements by destination location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  toLocation?: Location;

  @ApiPropertyOptional({
    example: '2026-08-18',
    description: 'Single date filter (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'Filter movements on or after this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-18',
    description:
      'Filter movements on or before this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
