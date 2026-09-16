import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class ReverseBranchTransferDto {
  @ApiProperty({
    example: 'transfer-uuid-1234',
    description: 'ID of the branch transfer to reverse',
  })
  @IsUUID()
  @IsNotEmpty()
  branchTransferId: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity of stock to reverse back to Main Shop (must be positive integer)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 'Transferred too many units to Aberus branch by mistake',
    description: 'Reason for performing the branch transfer reversal',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason: string;
}
