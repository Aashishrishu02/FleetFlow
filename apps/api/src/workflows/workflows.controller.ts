import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('start')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Initiate an end-to-end order fulfillment saga workflow' })
  async startWorkflow(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: { orderId: string },
  ) {
    return this.workflowsService.startFulfillmentWorkflow(tenant.organizationId, body.orderId);
  }

  @Get()
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'List fulfillment workflows with execution steps' })
  async getWorkflows(
    @CurrentTenant() tenant: TenantContext,
    @Query('orderId') orderId?: string,
  ) {
    return this.workflowsService.getWorkflows(tenant.organizationId, orderId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'Get workflow execution graph and current step status' })
  async getWorkflow(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflowsService.getWorkflow(tenant.organizationId, id);
  }

  @Post(':id/advance')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Advance or retry an active workflow step' })
  async advanceStep(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { stepId: string },
  ) {
    return this.workflowsService.advanceWorkflowStep(tenant.organizationId, id, body.stepId);
  }

  @Post(':id/abort')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Trigger compensation saga rollback and release reservations' })
  async abortWorkflow(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    return this.workflowsService.abortWorkflow(
      tenant.organizationId,
      id,
      body.reason || 'Operator triggered workflow abort',
    );
  }
}

