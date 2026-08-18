import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Location } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    enum: Location,
    description: 'Target location for inventory adjustment (WAREHOUSE or SHOP)',
  })
  @IsEnum(Location)
  @IsNotEmpty()
  location: Location;

  @ApiProperty({
    example: 18,
    description: 'New physical count inventory quantity (must be >= 0)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  newQuantity: number;

  @ApiPropertyOptional({ description: 'Optional note describing adjustment rationale' })
  @IsString()
  @IsOptional()
  note?: string;
}
