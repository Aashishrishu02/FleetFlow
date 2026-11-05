import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingServiceType } from '../../generated/prisma/enums.js';

export class CalculateQuoteDto {
  @ApiProperty({ example: 'Chicago, IL (ORD Hub)', description: 'Origin' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'Dallas, TX (DFW Hub)', description: 'Destination' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: 450.0, description: 'Weight in kg' })
  @IsNumber()
  @Min(0.1)
  weightKg: number;

  @ApiProperty({ example: 1480.0, description: 'Distance in km' })
  @IsNumber()
  @Min(1)
  distanceKm: number;

  @ApiProperty({ enum: PricingServiceType, default: PricingServiceType.STANDARD_ROAD })
  @IsEnum(PricingServiceType)
  serviceType: PricingServiceType;

  @ApiPropertyOptional({ example: 20.0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}

