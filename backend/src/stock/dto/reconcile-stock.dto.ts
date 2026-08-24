import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Location } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ReconcileStockDto {
  @ApiProperty({
    example: 'uuid-product-id',
    description: 'Product ID being audited for physical inventory reconciliation',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    enum: Location,
    example: Location.WAREHOUSE,
    description: 'Target location audited (WAREHOUSE or SHOP)',
  })
  @IsEnum(Location)
  @IsNotEmpty()
  location: Location;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Actual physical count found during audit (Required for QUANTITY products, min 0)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  actualCount?: number;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Alias for actualCount (physical count found during audit)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  physicalCount?: number;

  @ApiPropertyOptional({
    example: ['uuid-unit-1', 'uuid-unit-2'],
    description:
      'Array of ProductUnit UUIDs physically verified as present during audit (Required for SERIALIZED products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  verifiedUnitIds?: string[];

  @ApiPropertyOptional({
    example: 'Monthly stock count audit discrepancy correction',
    description:
      'Optional reason or note for this physical inventory reconciliation',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
