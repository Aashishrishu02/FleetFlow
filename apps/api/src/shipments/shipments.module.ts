import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller.js';
import { ShipmentsService } from './shipments.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}

