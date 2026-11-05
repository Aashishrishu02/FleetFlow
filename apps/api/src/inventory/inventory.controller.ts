
import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InventoryService } from './inventory.service.js';
import { ReceiveStockDto } from './dto/receive-stock.dto.js';
import { IssueStockDto } from './dto/issue-stock.dto.js';
import { ReserveStockDto } from './dto/reserve-stock.dto.js';
import { ReleaseStockDto } from './dto/release-stock.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  // ==========================================
  // POST APIs (Write Operations)
  // ==========================================

  // Receive Stock
  @Post('receive')
  @RequirePermissions(Permission.INVENTORY_RECEIVE)
  @ApiOperation({ summary: 'Receive stock into warehouse' })
  @ApiResponse({ status: 201, description: 'Stock received successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role permissions or cross-tenant access' })
  @ApiResponse({ status: 404, description: 'Warehouse, location, or product not found' })
  async receiveStock(
    @Body() dto: ReceiveStockDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    dto.organizationId = tenant.organizationId;
    return this.inventoryService.receiveStock(dto);
  }

  // Issue Stock (Outbound / Dispatch)
  @Post('issue')
  @RequirePermissions(Permission.INVENTORY_ISSUE)
  @ApiOperation({ summary: 'Issue / dispatch stock out of warehouse' })
  @ApiResponse({ status: 201, description: 'Stock issued successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient stock or invalid quantity' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role permissions or cross-tenant access' })
  @ApiResponse({ status: 404, description: 'Warehouse, location, or product not found' })
  async issueStock(
    @Body() dto: IssueStockDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    dto.organizationId = tenant.organizationId;
    return this.inventoryService.issueStock(dto);
  }

  // Reserve Stock
  @Post('reserve')
  @RequirePermissions(Permission.INVENTORY_RESERVE)
  @ApiOperation({ summary: 'Reserve stock for order fulfillment' })
  @ApiResponse({ status: 201, description: 'Stock reserved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role permissions or cross-tenant access' })
  @ApiResponse({ status: 404, description: 'Warehouse, location, or product not found' })
  async reserveStock(
    @Body() dto: ReserveStockDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    dto.organizationId = tenant.organizationId;
    return this.inventoryService.reserveStock(dto);
  }

  // Release Stock
  @Post('release')
  @RequirePermissions(Permission.INVENTORY_RELEASE)
  @ApiOperation({ summary: 'Release active stock reservation' })
  @ApiResponse({ status: 201, description: 'Reservation released successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role permissions or cross-tenant access' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async releaseStock(
    @Body() dto: ReleaseStockDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    dto.organizationId = tenant.organizationId;
    return this.inventoryService.releaseStock(dto);
  }

  // Adjust Stock (Damage / Cycle Count)
  @Post('adjustments')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Adjust stock quantities for cycle counts or damage quarantine' })
  async adjustStock(
    @CurrentTenant() tenant: TenantContext,
    @Body()
    dto: {
      warehouseId: string;
      locationId: string;
      productId: string;
      quantity: number;
      reason: 'RECONCILIATION' | 'DAMAGE';
      notes?: string;
      idempotencyKey: string;
    },
  ) {
    return this.inventoryService.adjustStock(tenant.organizationId, dto);
  }

  // Transfer Stock
  @Post('transfers')
  @RequirePermissions(Permission.INVENTORY_TRANSFER)
  @ApiOperation({ summary: 'Transfer inventory between warehouses or storage locations' })
  async transferStock(
    @CurrentTenant() tenant: TenantContext,
    @Body()
    dto: {
      fromWarehouseId: string;
      fromLocationId: string;
      toWarehouseId: string;
      toLocationId: string;
      productId: string;
      quantity: number;
      idempotencyKey: string;
    },
  ) {
    return this.inventoryService.transferStock(tenant.organizationId, dto);
  }

  // ==========================================
  // GET APIs (Read Operations)
  // ==========================================

  // Get Inventory Balances
  @Get('balances')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'Get inventory balances for authorized organization' })
  @ApiResponse({ status: 200, description: 'Balances retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant access denied' })
  async getBalances(@CurrentTenant() tenant: TenantContext) {
    return this.inventoryService.getBalances(tenant.organizationId);
  }

  // Get Inventory Summary
  @Get('summary')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'Get aggregate inventory metrics for authorized organization' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant access denied' })
  async getSummary(@CurrentTenant() tenant: TenantContext) {
    return this.inventoryService.getSummary(tenant.organizationId);
  }

  // Get Inventory Movements
  @Get('movements')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'Get stock movement audit history for authorized organization' })
  @ApiResponse({ status: 200, description: 'Movements retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant access denied' })
  async getMovements(@CurrentTenant() tenant: TenantContext) {
    return this.inventoryService.getMovements(tenant.organizationId);
  }
}
