import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReceiveStockUnitDto } from './receive-stock-unit.dto';

export class ReceiveStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID being received into inventory',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Quantity received (Required for QUANTITY tracked products)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: 15.5,
    description: 'Purchase price per unit (Required for QUANTITY tracked products)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  purchasePrice?: number;

  @ApiPropertyOptional({
    example: 'BATCH-2026-001',
    description: 'Optional unique batch reference number',
  })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    example: 'Initial shipment from supplier',
    description: 'Optional note or description for this stock reception',
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    type: [ReceiveStockUnitDto],
    description: 'Array of units with serial numbers/IMEIs (Required for SERIALIZED tracked products)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockUnitDto)
  @IsOptional()
  units?: ReceiveStockUnitDto[];
}
