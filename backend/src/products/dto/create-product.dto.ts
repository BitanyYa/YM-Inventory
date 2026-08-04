import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, TrackingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'iPhone 15 Pro Max',
    description: 'Name of the product',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Apple',
    description: 'Brand of the product',
  })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({
    example: 'uuid-category-id',
    description: 'Category ID relation',
  })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    enum: ProductType,
    example: ProductType.PHONE,
    description: 'Product type enum',
  })
  @IsEnum(ProductType)
  @IsNotEmpty()
  productType: ProductType;

  @ApiProperty({
    enum: TrackingType,
    example: TrackingType.SERIALIZED,
    description: 'Tracking type enum (SERIALIZED or QUANTITY)',
  })
  @IsEnum(TrackingType)
  @IsNotEmpty()
  trackingType: TrackingType;

  @ApiProperty({
    example: 1299.99,
    description: 'Selling price (positive number)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Minimum stock alert threshold (non-negative integer)',
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minimumStock?: number;

  @ApiPropertyOptional({
    example: 'Latest flagship Apple smartphone with A17 Pro chip',
    description: 'Product description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/images/iphone15promax.jpg',
    description: 'URL of the product image',
  })
  @IsString()
  @IsOptional()
  image?: string;
}
