import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutboxService } from './outbox.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { OutboxStatus } from '../generated/prisma/client.js';

@ApiTags('Outbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('outbox')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Get('events')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'List transactional outbox events' })
  async getEvents(
    @Query('status') status?: OutboxStatus,
    @Query('limit') limit?: number,
  ) {
    return this.outboxService.getEvents(status, limit ? Number(limit) : 50);
  }

  @Post('relay')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Trigger transactional outbox event relay worker cycle' })
  async triggerRelay() {
    return this.outboxService.relayPendingEvents();
  }
}

