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
import { OrganizationsService } from './organizations.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/constants/roles.enum.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant organization info and parameters' })
  async getCurrent(@CurrentTenant() tenant: TenantContext) {
    return this.organizationsService.getCurrent(tenant.organizationId);
  }

  @Patch('settings')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Update tenant optimization weights and operational settings' })
  async updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body()
    dto: {
      defaultCurrency?: string;
      operatingTimezone?: string;
      autoAllocationEnabled?: boolean;
      reorderAlertThreshold?: number;
      distanceWeight?: number;
      costWeight?: number;
      splitWeight?: number;
    },
  ) {
    return this.organizationsService.updateSettings(tenant.organizationId, dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'List organization active members and their roles' })
  async getMembers(@CurrentTenant() tenant: TenantContext) {
    return this.organizationsService.getMembers(tenant.organizationId);
  }

  @Post('members')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Invite or provision a team member to current organization' })
  async inviteMember(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: { email: string; name: string; roleName: string },
  ) {
    return this.organizationsService.inviteMember(tenant.organizationId, body);
  }

  @Patch('members/:membershipId/role')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Update a team member role assignment' })
  async updateMemberRole(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() body: { roleName: string },
  ) {
    return this.organizationsService.updateMemberRole(
      tenant.organizationId,
      membershipId,
      body.roleName,
    );
  }

  @Delete('members/:membershipId')
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'Revoke organization access for a team member' })
  async removeMember(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.organizationsService.removeMember(tenant.organizationId, membershipId);
  }
}

