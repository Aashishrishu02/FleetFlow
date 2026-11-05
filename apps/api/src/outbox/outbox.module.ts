import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service.js';
import { OutboxController } from './outbox.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [OutboxController],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}

