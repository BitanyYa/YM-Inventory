import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    example: 'Smartphones & Accessories',
    description: 'Updated name of the category',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated category description',
    description: 'Updated optional description of the category',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
