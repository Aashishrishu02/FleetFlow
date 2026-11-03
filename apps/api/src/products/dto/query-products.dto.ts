import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryProductsDto {
  @ApiPropertyOptional({ description: 'Search keyword across name and SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status ("true" or "false")' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}

