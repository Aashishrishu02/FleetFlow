import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Permission } from '../constants/roles.enum.js';

export interface TenantContext {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  roles: string[];
  permissions: Permission[];
  membershipId: string;
}

export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ tenantContext?: TenantContext }>();
    const tenant = request.tenantContext;

    if (!tenant) {
      return null;
    }

    return data ? tenant[data] : tenant;
  },
);

