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

export class ReturnStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID being returned from Shop to Warehouse',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Quantity to return (Required for QUANTITY tracked products, min 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: ['uuid-sold-unit-1'],
    description: 'Array of ProductUnit UUIDs to return (Required for SERIALIZED tracked products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  unitIds?: string[];

  @ApiPropertyOptional({
    example: 'Customer returned item due to change of mind',
    description: 'Optional note for this return',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
