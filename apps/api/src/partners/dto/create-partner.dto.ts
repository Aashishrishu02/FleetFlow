import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnerType } from '../../generated/prisma/enums.js';

export class CreatePartnerDto {
  @ApiProperty({ example: 'Apex Logistics Corp', description: 'Partner carrier name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'APXL', description: 'Unique carrier code or SCAC' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ enum: PartnerType, default: PartnerType.CARRIER_3PL })
  @IsOptional()
  @IsEnum(PartnerType)
  partnerType?: PartnerType;

  @ApiPropertyOptional({ example: 'REGIONAL_ROAD_FREIGHT' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiProperty({ example: 'dispatch@apexlogistics.com' })
  @IsEmail()
  contactEmail: string;

  @ApiPropertyOptional({ example: '+1-800-555-0199' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: ['North America', 'Midwest', 'Delhi'], description: 'Serviceable regions' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceableRegions?: string[];

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveShipments?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  activeCapacity?: number;

  @ApiPropertyOptional({ example: 1.85 })
  @IsOptional()
  @IsNumber()
  contractedRatePerKm?: number;
}

