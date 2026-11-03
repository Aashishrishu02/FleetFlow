import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryWarehousesDto {
  @ApiPropertyOptional({ description: 'Filter by search keyword across name, code, city, country' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status ("true" or "false")' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}

