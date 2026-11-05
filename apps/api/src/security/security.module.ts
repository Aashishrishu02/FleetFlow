import { Module } from '@nestjs/common';
import { SecurityService } from './security.service.js';
import { SecurityController } from './security.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}

