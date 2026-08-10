import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SellStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID to sell from Shop',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Quantity to sell (Required for QUANTITY tracked products, min 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: ['uuid-unit-1', 'uuid-unit-2'],
    description: 'Array of ProductUnit UUIDs to sell (Required for SERIALIZED tracked products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  unitIds?: string[];

  @ApiPropertyOptional({
    example: 'Sold to customer John Doe',
    description: 'Optional note for this sale',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
