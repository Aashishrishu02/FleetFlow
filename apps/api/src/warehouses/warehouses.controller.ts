import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { UpdateWarehouseStatusDto } from './dto/update-warehouse-status.dto.js';
import { CreateStorageLocationDto } from './dto/create-storage-location.dto.js';
import { UpdateStorageLocationDto } from './dto/update-storage-location.dto.js';
import { QueryWarehousesDto } from './dto/query-warehouses.dto.js';

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @RequirePermissions(Permission.WAREHOUSES_WRITE)
  @ApiOperation({ summary: 'Create a new warehouse for the authorized organization' })
  @ApiResponse({ status: 201, description: 'Warehouse created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate warehouse code' })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.warehousesService.createWarehouse(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(Permission.WAREHOUSES_READ)
  @ApiOperation({ summary: 'List all warehouses for the authorized organization' })
  @ApiResponse({ status: 200, description: 'Warehouses retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryWarehousesDto,
  ) {
    return this.warehousesService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.WAREHOUSES_READ)
  @ApiOperation({ summary: 'Get warehouse details by ID with locations and counts' })
  @ApiParam({ name: 'id', description: 'Warehouse UUID' })
  @ApiResponse({ status: 200, description: 'Warehouse retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant access' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.warehousesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.WAREHOUSES_WRITE)
  @ApiOperation({ summary: 'Update warehouse details' })
  @ApiParam({ name: 'id', description: 'Warehouse UUID' })
  @ApiResponse({ status: 200, description: 'Warehouse updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant or missing permissions' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate warehouse code' })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(tenant.organizationId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.WAREHOUSES_WRITE)
  @ApiOperation({ summary: 'Toggle warehouse operational status' })
  @ApiParam({ name: 'id', description: 'Warehouse UUID' })
  @ApiResponse({ status: 200, description: 'Warehouse status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async updateStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseStatusDto,
  ) {
    return this.warehousesService.updateStatus(tenant.organizationId, id, dto.isActive);
  }

  // --- Storage Location Endpoints ---

  @Post(':warehouseId/locations')
  @RequirePermissions(Permission.WAREHOUSES_WRITE)
  @ApiOperation({ summary: 'Create a storage location within a warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse UUID' })
  @ApiResponse({ status: 201, description: 'Storage location created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant or missing permissions' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate location code in warehouse' })
  async createLocation(
    @CurrentTenant() tenant: TenantContext,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() dto: CreateStorageLocationDto,
  ) {
    return this.warehousesService.createLocation(
      tenant.organizationId,
      warehouseId,
      dto,
    );
  }

  @Get(':warehouseId/locations')
  @RequirePermissions(Permission.WAREHOUSES_READ)
  @ApiOperation({ summary: 'List all storage locations within a warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse UUID' })
  @ApiResponse({ status: 200, description: 'Storage locations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async findAllLocations(
    @CurrentTenant() tenant: TenantContext,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
  ) {
    return this.warehousesService.findAllLocations(
      tenant.organizationId,
      warehouseId,
    );
  }

  @Get(':warehouseId/locations/:locationId')
  @RequirePermissions(Permission.WAREHOUSES_READ)
  @ApiOperation({ summary: 'Get a specific storage location in a warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse UUID' })
  @ApiParam({ name: 'locationId', description: 'Storage Location UUID' })
  @ApiResponse({ status: 200, description: 'Storage location retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — location does not belong to warehouse or cross-tenant' })
  @ApiResponse({ status: 404, description: 'Location or Warehouse not found' })
  async findOneLocation(
    @CurrentTenant() tenant: TenantContext,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.warehousesService.findOneLocation(
      tenant.organizationId,
      warehouseId,
      locationId,
    );
  }

  @Patch(':warehouseId/locations/:locationId')
  @RequirePermissions(Permission.WAREHOUSES_WRITE)
  @ApiOperation({ summary: 'Update a storage location' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse UUID' })
  @ApiParam({ name: 'locationId', description: 'Storage Location UUID' })
  @ApiResponse({ status: 200, description: 'Storage location updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant or missing permissions' })
  @ApiResponse({ status: 404, description: 'Location or Warehouse not found' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate location code' })
  async updateLocation(
    @CurrentTenant() tenant: TenantContext,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateStorageLocationDto,
  ) {
    return this.warehousesService.updateLocation(
      tenant.organizationId,
      warehouseId,
      locationId,
      dto,
    );
  }
}

