import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ReceiveStockUnitDto {
  @ApiProperty({
    example: '356789012345678',
    description: 'Unique IMEI of the product unit',
  })
  @IsString()
  @IsNotEmpty()
  imei: string;

  @ApiPropertyOptional({
    example: 'SN123456789',
    description: 'Serial number of the product unit',
  })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({
    example: 256,
    description: 'Storage capacity in GB (e.g. 128, 256, 512)',
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  storage?: number;

  @ApiPropertyOptional({
    example: 'Space Black',
    description: 'Color of the product unit',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({
    example: 950.0,
    description: 'Purchase price for this specific unit',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  purchasePrice: number;
}
