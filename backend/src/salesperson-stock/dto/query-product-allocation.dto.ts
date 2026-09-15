import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryProductAllocationDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (default 1)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page limit (default 20, max 100)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter allocation history by salesperson User ID' })
  @IsString()
  @IsOptional()
  salespersonId?: string;

  @ApiPropertyOptional({ description: 'Filter allocation history by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;
}
