import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestockDecision } from '../../generated/prisma/enums.js';

export class InspectedItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, description: 'Quantity actually received at inspection dock' })
  @IsInt()
  @Min(0)
  receivedQuantity: number;

  @ApiProperty({ example: 1, description: 'Quantity determined damaged' })
  @IsInt()
  @Min(0)
  damagedQuantity: number;
}

export class InspectReturnDto {
  @ApiProperty({ enum: RestockDecision, example: RestockDecision.QUARANTINE_DAMAGED })
  @IsEnum(RestockDecision)
  restockDecision: RestockDecision;

  @ApiPropertyOptional({ example: 45.00, description: 'Approved refund amount' })
  @IsOptional()
  @IsNumber()
  refundAmount?: number;

  @ApiPropertyOptional({ example: 'Packaging breached; item cracked, quarantined to damaged bay' })
  @IsOptional()
  @IsString()
  discrepancyNotes?: string;

  @ApiProperty({ type: [InspectedItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectedItemDto)
  items: InspectedItemDto[];
}

