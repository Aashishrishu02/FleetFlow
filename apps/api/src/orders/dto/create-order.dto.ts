import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, description: 'Quantity requested' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 99.99, description: 'Unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Optional explicit order number (generated if omitted)' })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiProperty({ example: 'CUS-102', description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiPropertyOptional({ example: 'Apex Global Logistics' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ example: 'orders@apex-logistics.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ example: 'Delhi', description: 'Destination city' })
  @IsString()
  @IsNotEmpty()
  shippingCity: string;

  @ApiProperty({ example: '110001', description: 'Destination postal code' })
  @IsString()
  @IsNotEmpty()
  shippingPostalCode: string;

  @ApiPropertyOptional({ example: 'Plot 42, Okhla Phase 3' })
  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiPropertyOptional({ example: 'IN', default: 'US' })
  @IsOptional()
  @IsString()
  shippingCountry?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Idempotency key to prevent duplicate orders' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Operational order notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Multi-item order lines' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

