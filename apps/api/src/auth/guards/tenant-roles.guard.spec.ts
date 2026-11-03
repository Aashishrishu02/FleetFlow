import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRolesGuard } from './tenant-roles.guard.js';
import { RoleName, Permission } from '../constants/roles.enum.js';
import { MembershipStatus } from '../../generated/prisma/enums.js';

describe('TenantRolesGuard', () => {
  let guard: TenantRolesGuard;
  let mockReflector: Reflector;
  let mockPrisma: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    mockPrisma = {
      membership: {
        findFirst: vi.fn(),
      },
    };

    guard = new TenantRolesGuard(mockReflector, mockPrisma);
  });

  const createMockContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException if user is not in request context (unauthenticated)', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if user has no active organization memberships', async () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      query: { organizationId: 'org1' },
    });

    mockPrisma.membership.findFirst
      .mockResolvedValueOnce(null) // no membership in org1
      .mockResolvedValueOnce(null); // no membership in any other org

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for cross-tenant access when user belongs to org2 but queries org1', async () => {
    const ctx = createMockContext({
      user: { userId: 'u1', organizationId: 'org2' },
      query: { organizationId: 'org1' },
    });

    mockPrisma.membership.findFirst
      .mockResolvedValueOnce(null) // no membership in org1
      .mockResolvedValueOnce({ id: 'm-org2', organizationId: 'org2' }); // has membership in org2

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Cross-tenant access forbidden/,
    );
  });

  it('should reject read-only Auditor attempting an operation requiring INVENTORY_RECEIVE permission', async () => {
    const ctx = createMockContext({
      user: { userId: 'u-auditor', organizationId: 'org1' },
    });

    mockPrisma.membership.findFirst.mockResolvedValueOnce({
      id: 'm1',
      organizationId: 'org1',
      status: MembershipStatus.ACTIVE,
      organization: { id: 'org1', name: 'Org 1', slug: 'org1' },
      roles: [{ role: { name: RoleName.AUDITOR } }],
    });

    // Handler requires INVENTORY_RECEIVE
    (mockReflector.getAllAndOverride as any).mockImplementation((key: string) => {
      if (key === 'permissions') {
        return [Permission.INVENTORY_RECEIVE];
      }
      return undefined;
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Missing required permission/,
    );
  });

  it('should allow authorized Warehouse Operator to perform INVENTORY_RECEIVE', async () => {
    const request: any = {
      user: { userId: 'u-operator', organizationId: 'org1' },
      body: { quantity: 10, organizationId: 'untrusted-org' },
    };
    const ctx = createMockContext(request);

    mockPrisma.membership.findFirst.mockResolvedValueOnce({
      id: 'm1',
      organizationId: 'org1',
      status: MembershipStatus.ACTIVE,
      organization: { id: 'org1', name: 'Org 1', slug: 'org1' },
      roles: [{ role: { name: RoleName.WAREHOUSE_OPERATOR } }],
    });

    (mockReflector.getAllAndOverride as any).mockImplementation((key: string) => {
      if (key === 'permissions') {
        return [Permission.INVENTORY_RECEIVE];
      }
      return undefined;
    });

    const allowed = await guard.canActivate(ctx);
    expect(allowed).toBe(true);
    expect(request.tenantContext).toBeDefined();
    expect(request.tenantContext.organizationId).toBe('org1');
    expect(request.tenantContext.roles).toContain(RoleName.WAREHOUSE_OPERATOR);
    expect(request.body.organizationId).toBe('org1');
  });

  it('should allow Organization Owner full access even with strict permissions', async () => {
    const request: any = {
      user: { userId: 'u-owner', organizationId: 'org1' },
    };
    const ctx = createMockContext(request);

    mockPrisma.membership.findFirst.mockResolvedValueOnce({
      id: 'm-owner',
      organizationId: 'org1',
      status: MembershipStatus.ACTIVE,
      organization: { id: 'org1', name: 'Org 1', slug: 'org1' },
      roles: [{ role: { name: RoleName.ORGANIZATION_OWNER } }],
    });

    (mockReflector.getAllAndOverride as any).mockImplementation((key: string) => {
      if (key === 'permissions') {
        return [Permission.INVENTORY_ADJUST, Permission.FINANCE_WRITE];
      }
      return [RoleName.OPERATIONS_MANAGER];
    });

    const allowed = await guard.canActivate(ctx);
    expect(allowed).toBe(true);
    expect(request.tenantContext.roles).toContain(RoleName.ORGANIZATION_OWNER);
  });
});

