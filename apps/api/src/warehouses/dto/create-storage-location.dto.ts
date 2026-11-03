import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStorageLocationDto {
  @ApiProperty({ description: 'Display name of location/bay/rack', example: 'Aisle 1 - Shelf B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Unique alphanumeric location code within warehouse', example: 'A1-B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Location code must contain only letters, numbers, hyphens, and underscores',
  })
  code: string;
}

