import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryBranchInventoryDto {
  @ApiPropertyOptional({ description: 'Filter branch stock by Branch ID' })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter branch stock by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;
}
