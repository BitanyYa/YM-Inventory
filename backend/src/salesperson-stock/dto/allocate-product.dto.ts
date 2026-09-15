import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AllocateProductDto {
  @ApiProperty({
    example: 'prod-uuid-1234',
    description: 'ID of the product to allocate',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: 'user-uuid-salesperson-1',
    description: 'ID of the salesperson user receiving the allocation',
  })
  @IsString()
  @IsNotEmpty()
  salespersonId: string;

  @ApiProperty({
    example: 20,
    description: 'Quantity of stock to allocate (must be positive integer)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    example: 'First batch for morning shift',
    description: 'Optional allocation note or comment',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
