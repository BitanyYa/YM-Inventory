import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSalespersonDto {
  @ApiPropertyOptional({
    example: 'Abel Tesfaye',
    description: 'Updated name of the salesperson',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({
    example: '0911223344',
    description: 'Updated phone number of the salesperson',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : value,
  )
  phone?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Active status of the salesperson',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
