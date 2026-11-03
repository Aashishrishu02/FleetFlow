import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, type JwtPayload } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
    };
    strategy = new JwtStrategy(mockPrisma);
  });

  it('should validate payload and return user context if user exists in database', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-uuid-1',
      email: 'jane@example.com',
    });

    const payload: JwtPayload = {
      sub: 'user-uuid-1',
      email: 'jane@example.com',
      organizationId: 'org-uuid-1',
    };

    const result = await strategy.validate(payload);
    expect(result).toEqual({
      userId: 'user-uuid-1',
      email: 'jane@example.com',
      organizationId: 'org-uuid-1',
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
      select: { id: true, email: true },
    });
  });

  it('should throw UnauthorizedException if sub is missing in payload', async () => {
    await expect(strategy.validate({} as any)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user is not found in database', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const payload: JwtPayload = {
      sub: 'deleted-user',
      email: 'deleted@example.com',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});

