import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Location } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TransferStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID to transfer stock',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    enum: Location,
    example: Location.WAREHOUSE,
    description: 'Source location (default: WAREHOUSE)',
  })
  @IsEnum(Location)
  @IsOptional()
  fromLocation?: Location;

  @ApiPropertyOptional({
    enum: Location,
    example: Location.SHOP,
    description: 'Destination location (default: SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  toLocation?: Location;

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
