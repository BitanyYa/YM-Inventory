import { ApiPropertyOptional } from '@nestjs/swagger';
import { Location, UnitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryProductUnitDto {
  @ApiPropertyOptional({ description: 'Filter by IMEI' })
  @IsString()
  @IsOptional()
  imei?: string;

  @ApiPropertyOptional({ description: 'Filter by Serial Number' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by Product ID' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    enum: Location,
    description: 'Filter by Unit Location (WAREHOUSE, SHOP)',
  })
  @IsEnum(Location)
  @IsOptional()
  location?: Location;

  @ApiPropertyOptional({
    enum: UnitStatus,
    description: 'Filter by Unit Status (AVAILABLE, IN_SHOP, SOLD, RETURNED, DAMAGED)',
  })
  @IsEnum(UnitStatus)
  @IsOptional()
  status?: UnitStatus;
}
