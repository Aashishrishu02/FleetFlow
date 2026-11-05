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
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { QueryOrdersDto } from './dto/query-orders.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Create a new multi-item customer order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'List customer orders with status filter and search' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'Retrieve full order details and fulfillment history' })
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(tenant.organizationId, id);
  }

  @Get(':id/fulfillment')
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiOperation({ summary: 'Retrieve order fulfillment status' })
  async getFulfillment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.getFulfillmentStatus(tenant.organizationId, id);
  }

  @Post(':id/confirm')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Confirm order, execute deterministic warehouse allocation, and reserve inventory' })
  async confirmOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.confirmOrder(tenant.organizationId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Cancel order and execute compensating inventory release' })
  async cancelOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.ordersService.cancelOrder(tenant.organizationId, id, reason);
  }

  @Delete(':id')
  @RequirePermissions(Permission.ORDERS_WRITE)
  @ApiOperation({ summary: 'Delete order safely if draft or cancelled' })
  async deleteOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.deleteOrder(tenant.organizationId, id);
  }
}

