import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Optional Shipment UUID' })
  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @ApiPropertyOptional({ description: 'Explicit invoice number (generated if omitted)' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ example: 3633.24, description: 'Subtotal before tax' })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ example: 181.66, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: '2026-11-30', description: 'Due date' })
  @IsDateString()
  dueDate: string;
}

