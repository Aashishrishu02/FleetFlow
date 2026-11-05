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
import { SecurityService } from './security.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Post('api-keys')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Provision new cryptographically hashed API key' })
  async createApiKey(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: { name: string; scopes?: string[]; expiresDays?: number },
  ) {
    return this.securityService.createApiKey(tenant.organizationId, body);
  }

  @Get('api-keys')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'List tenant API keys with prefixes and scopes' })
  async getApiKeys(@CurrentTenant() tenant: TenantContext) {
    return this.securityService.getApiKeys(tenant.organizationId);
  }

  @Delete('api-keys/:id')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Revoke active API key' })
  async revokeApiKey(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.securityService.revokeApiKey(tenant.organizationId, id);
  }

  @Get('audit-logs')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Query immutable tenant forensic audit log' })
  async getAuditLogs(
    @CurrentTenant() tenant: TenantContext,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: number,
  ) {
    return this.securityService.getAuditLogs(tenant.organizationId, {
      entityType,
      action,
      limit: limit ? Number(limit) : 50,
    });
  }
}

