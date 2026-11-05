import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShipmentsService } from './shipments.service.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { RecordEventDto } from './dto/record-event.dto.js';
import { QueryShipmentsDto } from './dto/query-shipments.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @RequirePermissions(Permission.SHIPMENTS_WRITE)
  @ApiOperation({ summary: 'Create a shipment package from confirmed order' })
  @ApiResponse({ status: 201, description: 'Shipment created' })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipmentsService.createShipment(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(Permission.SHIPMENTS_READ)
  @ApiOperation({ summary: 'List consignments and active telemetry' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryShipmentsDto,
  ) {
    return this.shipmentsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.SHIPMENTS_READ)
  @ApiOperation({ summary: 'Get shipment details and package manifest' })
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.findOne(tenant.organizationId, id);
  }

  @Get(':id/tracking')
  @RequirePermissions(Permission.SHIPMENTS_READ)
  @ApiOperation({ summary: 'Get chronological telemetry checkpoint events' })
  async getTracking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.getTrackingHistory(tenant.organizationId, id);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.DISPATCH_WRITE)
  @ApiOperation({ summary: 'Assign delivery partner and vehicle with race-free locking' })
  async assignPartner(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('partnerId', ParseUUIDPipe) partnerId: string,
    @Body('vehicleId') vehicleId?: string,
  ) {
    return this.shipmentsService.assignPartner(tenant.organizationId, id, partnerId, vehicleId);
  }

  @Post(':id/events')
  @RequirePermissions(Permission.SHIPMENTS_WRITE)
  @ApiOperation({ summary: 'Record checkpoint tracking event with monotonic state validation' })
  async recordEvent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordEventDto,
  ) {
    return this.shipmentsService.recordEvent(tenant.organizationId, id, dto);
  }

  @Post(':id/proof-of-delivery')
  @RequirePermissions(Permission.SHIPMENTS_WRITE)
  @ApiOperation({ summary: 'Upload proof-of-delivery evidence link' })
  async uploadPOD(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('proofUrl') proofUrl: string,
  ) {
    return this.shipmentsService.uploadProofOfDelivery(tenant.organizationId, id, proofUrl);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SHIPMENTS_WRITE)
  @ApiOperation({ summary: 'Delete shipment consignment' })
  async deleteShipment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.deleteShipment(tenant.organizationId, id);
  }
}

