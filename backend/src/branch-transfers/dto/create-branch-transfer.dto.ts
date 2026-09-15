import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateBranchTransferDto {
  @ApiProperty({
    example: 'branch-uuid-1234',
    description: 'ID of the target branch (Atlas, Aberus, or Garad)',
  })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({
    example: 'prod-uuid-1234',
    description: 'ID of the product to transfer from Main Shop to Branch',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: 20,
    description: 'Quantity of stock to transfer (must be positive integer)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    example: 'Initial branch stock',
    description: 'Optional transfer note or comment',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
