import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, description: 'Quantity to return' })
  @IsInt()
  @Min(1)
  expectedQuantity: number;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'Delivered Order UUID' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Receiving Warehouse UUID' })
  @IsUUID()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Optional explicit RMA number' })
  @IsOptional()
  @IsString()
  returnNumber?: string;

  @ApiProperty({ example: 'Defective product / Transit impact crease' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}

