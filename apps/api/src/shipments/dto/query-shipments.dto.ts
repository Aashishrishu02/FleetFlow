import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '../../generated/prisma/enums.js';

export class QueryShipmentsDto {
  @ApiPropertyOptional({ enum: ShipmentStatus, description: 'Filter by shipment status' })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Search by tracking number, origin, or destination' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

