import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueStockDto {
  @ApiProperty({ description: 'Source warehouse ID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Source storage location ID within warehouse', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ description: 'Product ID being issued', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Quantity to issue out of warehouse', minimum: 1 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unique idempotency key preventing duplicate issuance' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Operational notes or reason for issue' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Reference type, e.g. OUTBOUND_DISPATCH, MANUAL_ISSUE' })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference ID (e.g. order ID or shipment ID)', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Organization ID set by tenant context', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
