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

export class DamageStockDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Quantity to mark as damaged (Required for QUANTITY products)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: ['unit-uuid-1'],
    description: 'ProductUnit IDs to mark as damaged (Required for SERIALIZED products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  unitIds?: string[];

  @ApiProperty({
    enum: Location,
    description: 'Location where stock was damaged (WAREHOUSE or SHOP)',
  })
  @IsEnum(Location)
  @IsNotEmpty()
  location: Location;

  @ApiPropertyOptional({ description: 'Optional note explaining damage details' })
  @IsString()
  @IsOptional()
  note?: string;
}
