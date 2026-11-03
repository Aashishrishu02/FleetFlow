import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWarehouseStatusDto {
  @ApiProperty({ description: 'Operational active status', example: false })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}

