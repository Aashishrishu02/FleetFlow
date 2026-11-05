import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '../../generated/prisma/enums.js';

export class RecordEventDto {
  @ApiProperty({ enum: ShipmentStatus, description: 'New shipment tracking milestone' })
  @IsEnum(ShipmentStatus)
  eventType: ShipmentStatus;

  @ApiProperty({ example: 'Delhi Airport Gateway', description: 'Checkpoint location' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiPropertyOptional({ example: 'Processed through sorting facility' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'delivery-partner-app', default: 'system' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Timestamp when event occurred' })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

