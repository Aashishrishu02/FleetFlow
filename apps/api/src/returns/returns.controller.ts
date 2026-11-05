import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReturnsService } from './returns.service.js';
import { CreateReturnDto } from './dto/create-return.dto.js';
import { InspectReturnDto } from './dto/inspect-return.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Reverse Logistics & Returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Initiate a customer return (RMA)' })
  @ApiResponse({ status: 201, description: 'RMA created successfully' })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returnsService.createReturn(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'List return material authorizations and reverse logistics status' })
  async findAll(@CurrentTenant() tenant: TenantContext) {
    return this.returnsService.findAll(tenant.organizationId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'Get return details and inspection report' })
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/inspect')
  @RequirePermissions(Permission.INVENTORY_RECEIVE)
  @ApiOperation({ summary: 'Record dock inspection, quarantine damaged stock, and approve restock' })
  async inspect(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InspectReturnDto,
  ) {
    return this.returnsService.inspectReturn(tenant.organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Delete customer return RMA record' })
  async deleteReturn(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.deleteReturn(tenant.organizationId, id);
  }
}

