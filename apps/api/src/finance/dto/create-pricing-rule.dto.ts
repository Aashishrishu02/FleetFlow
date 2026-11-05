import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingServiceType } from '../../generated/prisma/enums.js';

export class CreatePricingRuleDto {
  @ApiProperty({ example: 'TRF-FTL-MIDWEST', description: 'Unique rule name' })
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @ApiProperty({ enum: PricingServiceType, default: PricingServiceType.STANDARD_ROAD })
  @IsEnum(PricingServiceType)
  serviceType: PricingServiceType;

  @ApiPropertyOptional({ example: 80.00, default: 80.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseCharge?: number;

  @ApiPropertyOptional({ example: 1.20, default: 1.20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perKmRate?: number;

  @ApiPropertyOptional({ example: 0.50, default: 0.50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perKgRate?: number;

  @ApiPropertyOptional({ example: 15.00, default: 15.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelSurchargePct?: number;

  @ApiPropertyOptional({ example: 10.00, default: 10.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  handlingFee?: number;

  @ApiPropertyOptional({ example: 2.00, default: 2.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  insurancePct?: number;
}

