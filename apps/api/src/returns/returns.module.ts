import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}

