import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Location, MovementType } from '@prisma/client';
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

export class AdjustStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID to adjust (damage or loss)',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    enum: MovementType,
    example: MovementType.DAMAGE,
    description: 'Adjustment type: must be DAMAGE or LOSS',
  })
  @IsEnum(MovementType)
  @IsNotEmpty()
  movementType: MovementType;

  @ApiPropertyOptional({
    example: 2,
    description: 'Quantity to adjust (Required for QUANTITY tracked products, min 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: ['uuid-unit-1'],
    description: 'Array of ProductUnit UUIDs to adjust (Required for SERIALIZED tracked products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  unitIds?: string[];

  @ApiPropertyOptional({
    enum: Location,
    example: Location.WAREHOUSE,
    description: 'Location of stock being adjusted (Required for QUANTITY tracked products)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({
    example: 'Damaged during inspection',
    description: 'Optional note for this adjustment',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
