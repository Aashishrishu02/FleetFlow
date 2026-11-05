import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorageLocationDto {
  @ApiPropertyOptional({ description: 'Display name of location/bay/rack' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Unique alphanumeric location code within warehouse' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Location code must contain only letters, numbers, hyphens, and underscores',
  })
  code?: string;

  @ApiPropertyOptional({ description: 'Storage location type (Zone, Rack, Shelf, Bin)' })
  @IsOptional()
  @IsString()
  type?: string;
}
