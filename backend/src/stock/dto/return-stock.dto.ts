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

export class ReturnStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID being returned',
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
    enum: Location,
    example: Location.WAREHOUSE,
    description: 'Destination location where returned stock will be restored (WAREHOUSE or SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({
    enum: Location,
    example: Location.WAREHOUSE,
    description: 'Alias for location (WAREHOUSE or SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  toLocation?: Location;

  @ApiPropertyOptional({
    example: 'Customer returned item due to change of mind',
    description: 'Optional note for this return',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
