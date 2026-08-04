import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Smartphones',
    description: 'Unique name of the category',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Mobile phones including iOS and Android devices',
    description: 'Optional description of the category',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
