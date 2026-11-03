
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ReserveStockDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsUUID()
  warehouseId: string;

  @IsUUID()
  locationId: string;

  @IsUUID()
  productId: string;

  @IsString()
  @IsNotEmpty()
  referenceType: string;

  @IsUUID()
  referenceId: string;

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
