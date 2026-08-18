import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location } from '@prisma/client';
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

export class QueryStockReceiptDto {
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

  @ApiPropertyOptional({ description: 'Filter stock-in receipts by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter stock-in receipts by receiving destination location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({
    example: '2026-08-17',
    description: 'Single date filter (ISO string or YYYY-MM-DD). Filter receipts on that specific date.',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Filter receipts on or after this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-17',
    description: 'Filter receipts on or before this date (ISO string or YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
