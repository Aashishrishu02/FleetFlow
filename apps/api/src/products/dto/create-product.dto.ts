import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiPropertyOptional({ description: 'Organization UUID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({ description: 'Product title / name', example: 'Enterprise Cloud Server 2U' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Unique Stock Keeping Unit (SKU)', example: 'SRV-2U-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'SKU must contain only letters, numbers, hyphens, and underscores',
  })
  sku: string;

  @ApiPropertyOptional({ description: 'Product description or technical specifications' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Product category', example: 'Hardware' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Unit of measure', example: 'UNIT', default: 'UNIT' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'Active catalog status', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

