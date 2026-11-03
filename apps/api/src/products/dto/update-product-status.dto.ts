import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductStatusDto {
  @ApiProperty({ description: 'Active operational catalog status', example: false })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}

