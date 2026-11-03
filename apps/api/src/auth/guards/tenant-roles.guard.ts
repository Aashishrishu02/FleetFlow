import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { RoleName, Permission, ROLE_PERMISSIONS } from '../constants/roles.enum.js';
import { MembershipStatus } from '../../generated/prisma/enums.js';
import type { TenantContext } from '../decorators/current-tenant.decorator.js';

@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { userId: string; email: string; organizationId?: string };
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: Record<string, any>;
      tenantContext?: TenantContext;
    }>();

    const user = request.user;
    if (!user?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    // 1. Resolve target organizationId from request parameters
    const targetOrgId =
      request.params?.organizationId ||
      request.params?.orgId ||
      request.query?.organizationId ||
      request.body?.organizationId ||
      user.organizationId;

    let membership;

    if (targetOrgId) {
      membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: targetOrgId,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          roles: {
            include: {
              role: {
                select: { id: true, name: true, isSystem: true },
              },
            },
          },
        },
      });

      if (!membership) {
        // Check if user has active memberships in other organizations
        const anyMembership = await this.prisma.membership.findFirst({
          where: {
            userId: user.userId,
            status: MembershipStatus.ACTIVE,
          },
          select: { id: true },
        });

        if (anyMembership) {
          throw new ForbiddenException(
            'Cross-tenant access forbidden: You do not have an active membership in the specified organization.',
          );
        }

        throw new ForbiddenException('User has no active organization membership.');
      }
    } else {
      // No target organization specified; retrieve default primary active membership
      membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          roles: {
            include: {
              role: {
                select: { id: true, name: true, isSystem: true },
              },
            },
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException('User has no active organization membership.');
      }
    }

    // 2. Extract user roles in this specific organization
    const userRoles = membership.roles.map((r) => r.role.name);

    // 3. Compute union of user permissions
    const userPermissions: Permission[] = Array.from(
      new Set(userRoles.flatMap((r) => ROLE_PERMISSIONS[r] || [])),
    );

    // 4. Verify @Roles() if present
    const requiredRoles = this.reflector.getAllAndOverride<(RoleName | string)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const isOwner = userRoles.includes(RoleName.ORGANIZATION_OWNER);
      const hasRequiredRole = isOwner || requiredRoles.some((role) => userRoles.includes(role));

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `Access denied: Requires one of [${requiredRoles.join(', ')}]. Your roles: [${userRoles.join(', ')}]`,
        );
      }
    }

    // 5. Verify @RequirePermissions() if present
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const isOwner = userRoles.includes(RoleName.ORGANIZATION_OWNER);
      if (!isOwner) {
        const missingPermissions = requiredPermissions.filter(
          (permission) => !userPermissions.includes(permission),
        );

        if (missingPermissions.length > 0) {
          throw new ForbiddenException(
            `Access denied: Missing required permission(s): [${missingPermissions.join(', ')}]`,
          );
        }
      }
    }

    // 6. Bind verified tenant context to request
    request.tenantContext = {
      organizationId: membership.organizationId,
      organization: membership.organization,
      roles: userRoles,
      permissions: userPermissions,
      membershipId: membership.id,
    };

    // Sanitize parameters to avoid trusting raw frontend input
    if (request.query) {
      request.query.organizationId = membership.organizationId;
    }
    if (request.body && typeof request.body === 'object' && 'organizationId' in request.body) {
      request.body.organizationId = membership.organizationId;
    }

    return true;
  }
}

