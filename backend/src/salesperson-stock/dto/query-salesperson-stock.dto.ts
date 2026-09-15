import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QuerySalespersonStockDto {
  @ApiPropertyOptional({ description: 'Filter balances by salesperson User ID' })
  @IsString()
  @IsOptional()
  salespersonId?: string;

  @ApiPropertyOptional({ description: 'Filter balances by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;
}
