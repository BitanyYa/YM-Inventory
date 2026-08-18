import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: 'iPhone 15 Pro Max',
    description: 'Name of the product',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Apple',
    description: 'Brand of the product',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    example: 'uuid-category-id',
    description: 'Category ID relation',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    example: ProductType.PHONE,
    description: 'Product type enum',
  })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({
    example: 1299.99,
    description: 'Selling price (non-negative number)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  sellingPrice?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Minimum stock alert threshold (non-negative integer)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minimumStock?: number;

  @ApiPropertyOptional({
    example: 'Latest flagship Apple smartphone',
    description: 'Product description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/images/iphone.jpg',
    description: 'URL of the product image',
  })
  @IsString()
  @IsOptional()
  image?: string;
}
