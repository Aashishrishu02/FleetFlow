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
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions(Permission.PRODUCTS_WRITE)
  @ApiOperation({ summary: 'Create a new product in the organization catalog' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate SKU within organization' })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'List all products for the authorized organization' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryProductsDto,
  ) {
    return this.productsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get product details by ID with inventory stock balances' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — cross-tenant access' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PRODUCTS_WRITE)
  @ApiOperation({ summary: 'Update product details' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request — unsafe change to product with active inventory' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate SKU' })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(tenant.organizationId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.PRODUCTS_WRITE)
  @ApiOperation({ summary: 'Toggle product active catalog status' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product status updated' })
  @ApiResponse({ status: 400, description: 'Bad request — cannot deactivate product with active reservations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(tenant.organizationId, id, dto.isActive);
  }
}
