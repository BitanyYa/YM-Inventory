import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateProductStatusDto {
  @ApiProperty({
    example: false,
    description: 'Active status flag (true = active, false = soft-deleted/inactive)',
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
