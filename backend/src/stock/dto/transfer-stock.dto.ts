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

export class TransferStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID to transfer from Warehouse to Shop',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Quantity to transfer (Required for QUANTITY tracked products, min 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: ['uuid-unit-1', 'uuid-unit-2'],
    description: 'Array of ProductUnit UUIDs to transfer (Required for SERIALIZED tracked products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  unitIds?: string[];

  @ApiPropertyOptional({
    example: 'Transferring stock for shop display',
    description: 'Optional note for this transfer',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
