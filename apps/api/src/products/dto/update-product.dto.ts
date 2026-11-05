import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Organization UUID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Product title / name' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Unique Stock Keeping Unit (SKU)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'SKU must contain only letters, numbers, hyphens, and underscores',
  })
  sku?: string;

  @ApiPropertyOptional({ description: 'Product description or technical specifications' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Product category' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Unit of measure' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'Active catalog status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

