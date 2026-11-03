
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ReleaseStockDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsUUID()
  reservationId: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsString()
  @IsNotEmpty()
  notes: string;
}

