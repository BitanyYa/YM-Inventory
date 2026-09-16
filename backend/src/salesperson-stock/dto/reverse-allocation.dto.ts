import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class ReverseAllocationDto {
  @ApiProperty({
    example: 'alloc-uuid-1234',
    description: 'ID of the product allocation to reverse',
  })
  @IsUUID()
  @IsNotEmpty()
  allocationId: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity of stock to reverse (must be positive integer)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 'Allocated too many items by mistake',
    description: 'Reason for performing the allocation reversal',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason: string;
}
