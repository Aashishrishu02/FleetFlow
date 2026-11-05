import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '../../generated/prisma/enums.js';

export class CreateVehicleDto {
  @ApiPropertyOptional({ example: 'TRK-9041-US', description: 'License plate or vehicle number' })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: 'IL-TX-8821', description: 'License plate' })
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @ApiPropertyOptional({ enum: VehicleType, example: VehicleType.TRAILER_53FT })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 20000, description: 'Max weight capacity in kg' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxWeightCapacityKg?: number;

  @ApiPropertyOptional({ example: 18000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacityKg?: number;

  @ApiPropertyOptional({ example: 85, description: 'Volume capacity in cubic meters' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxVolumeCubicMeters?: number;

  @ApiPropertyOptional({ example: 'ORD Mega-Center (Chicago)' })
  @IsOptional()
  @IsString()
  currentLocation?: string;
}

