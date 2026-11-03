import { Module } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller.js';
import { WarehousesService } from './warehouses.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}

