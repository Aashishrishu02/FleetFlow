import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PartnersService } from './partners.service.js';
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Delivery Partners & Dispatch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller()
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('partners')
  @RequirePermissions(Permission.DISPATCH_WRITE)
  @ApiOperation({ summary: 'Onboard and register a delivery partner carrier' })
  @ApiResponse({ status: 201, description: 'Delivery partner registered' })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePartnerDto,
  ) {
    return this.partnersService.createPartner(tenant.organizationId, dto);
  }

  @Get('partners')
  @RequirePermissions(Permission.DISPATCH_READ)
  @ApiOperation({ summary: 'List delivery partner carriers and active capacity' })
  async findAll(@CurrentTenant() tenant: TenantContext) {
    return this.partnersService.findAll(tenant.organizationId);
  }

  @Get('partners/:id')
  @RequirePermissions(Permission.DISPATCH_READ)
  @ApiOperation({ summary: 'Get delivery partner profile and fleet' })
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.partnersService.findOne(tenant.organizationId, id);
  }

  @Post('partners/:id/vehicles')
  @RequirePermissions(Permission.DISPATCH_WRITE)
  @ApiOperation({ summary: 'Register a vehicle into partner fleet' })
  async addVehicle(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.partnersService.addVehicle(tenant.organizationId, id, dto);
  }

  @Get(['dispatch', 'partners/dispatch/overview'])
  @RequirePermissions(Permission.DISPATCH_READ)
  @ApiOperation({ summary: 'Dispatch and fleet routing telemetry overview' })
  async getDispatch(@CurrentTenant() tenant: TenantContext) {
    return this.partnersService.getDispatchOverview(tenant.organizationId);
  }

  @Patch('partners/:id')
  @RequirePermissions(Permission.DISPATCH_WRITE)
  @ApiOperation({ summary: 'Update delivery partner profile and parameters' })
  async updatePartner(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.partnersService.updatePartner(tenant.organizationId, id, dto);
  }

  @Delete('partners/:id')
  @RequirePermissions(Permission.DISPATCH_WRITE)
  @ApiOperation({ summary: 'Delete delivery partner carrier' })
  async deletePartner(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.partnersService.deletePartner(tenant.organizationId, id);
  }

  @Delete('partners/:partnerId/vehicles/:vehicleId')
  @RequirePermissions(Permission.DISPATCH_WRITE)
  @ApiOperation({ summary: 'Delete vehicle from partner fleet' })
  async deleteVehicle(
    @CurrentTenant() tenant: TenantContext,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ) {
    return this.partnersService.deleteVehicle(tenant.organizationId, partnerId, vehicleId);
  }
}

