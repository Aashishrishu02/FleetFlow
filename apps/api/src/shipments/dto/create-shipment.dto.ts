import {
  IsArray,
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

export class ShipmentItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity packed in shipment' })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateShipmentDto {
  @ApiProperty({ description: 'Confirmed Order UUID' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Origin Warehouse UUID' })
  @IsUUID()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Delivery Partner UUID' })
  @IsOptional()
  @IsUUID()
  deliveryPartnerId?: string;

  @ApiPropertyOptional({ description: 'Optional explicit tracking number' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiProperty({ example: 'Delhi', description: 'Origin city' })
  @IsString()
  @IsNotEmpty()
  originCity: string;

  @ApiProperty({ example: 'Mumbai', description: 'Destination city' })
  @IsString()
  @IsNotEmpty()
  destinationCity: string;

  @ApiPropertyOptional({ example: 'Plot 10, Andheri East' })
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiPropertyOptional({ example: '400069' })
  @IsOptional()
  @IsString()
  destinationPostalCode?: string;

  @ApiPropertyOptional({ example: 5.4, description: 'Total weight in kg' })
  @IsOptional()
  @IsNumber()
  totalWeightKg?: number;

  @ApiPropertyOptional({ example: 1, description: 'Package count' })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageCount?: number;

  @ApiProperty({ type: [ShipmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items: ShipmentItemDto[];
}

