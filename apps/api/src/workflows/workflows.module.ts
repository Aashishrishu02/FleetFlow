import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

