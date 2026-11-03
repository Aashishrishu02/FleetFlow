import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ReceiveStockDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsUUID()
  warehouseId: string;

  @IsUUID()
  locationId: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  notes?: string;
}