import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException when JWT is missing', () => {
    expect(() => guard.handleRequest(null, null, new Error('No auth token'))).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when JWT is invalid or malformed', () => {
    expect(() => guard.handleRequest(null, null, new Error('jwt malformed'))).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when user object is falsey', () => {
    expect(() => guard.handleRequest(null, false, null)).toThrow(
      UnauthorizedException,
    );
  });

  it('should return user payload when JWT is valid', () => {
    const userPayload = {
      userId: 'test-user-id',
      email: 'user@fleetflow.io',
      organizationId: 'test-org-id',
    };

    const user = guard.handleRequest(null, userPayload, null);
    expect(user).toEqual(userPayload);
  });
});

