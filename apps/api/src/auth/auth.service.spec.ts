import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      organization: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      role: {
        create: vi.fn(),
      },
      membership: {
        create: vi.fn(),
      },
      membershipRole: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
    };

    service = new AuthService(mockPrisma, mockJwtService);
  });

  describe('register', () => {
    it('should throw ConflictException if email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(
        service.register({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
          organizationName: 'Jane Logistics',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
        select: { id: true },
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should register user and organization atomically and return token without passwordHash', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      const mockCreatedUser = {
        id: 'user-uuid-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        createdAt: new Date(),
      };

      const mockCreatedOrg = {
        id: 'org-uuid-1',
        name: 'Jane Logistics',
        slug: 'jane-logistics',
        createdAt: new Date(),
      };

      const mockCreatedRole = {
        id: 'role-uuid-1',
        name: 'Organization Owner',
      };

      const mockCreatedMembership = {
        id: 'membership-uuid-1',
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: { create: vi.fn().mockResolvedValue(mockCreatedUser) },
          organization: { create: vi.fn().mockResolvedValue(mockCreatedOrg) },
          role: { create: vi.fn().mockResolvedValue(mockCreatedRole) },
          membership: { create: vi.fn().mockResolvedValue(mockCreatedMembership) },
          membershipRole: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const response = await service.register({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password123!',
        organizationName: 'Jane Logistics',
      });

      expect(response).toBeDefined();
      expect(response.accessToken).toBe('mock.jwt.token');
      expect(response.user.id).toBe('user-uuid-1');
      expect(response.user.email).toBe('jane@example.com');
      expect((response.user as any).passwordHash).toBeUndefined();
      expect(response.organization.id).toBe('org-uuid-1');
      expect(response.roles).toContain('Organization Owner');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user does not exist (generic error to prevent enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123', 10);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-uuid-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        passwordHash: hashedPassword,
        memberships: [],
      });

      await expect(
        service.login({
          email: 'jane@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login successfully with valid credentials and return access token without passwordHash', async () => {
      const rawPassword = 'CorrectPassword123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-uuid-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        passwordHash: hashedPassword,
        createdAt: new Date(),
        memberships: [
          {
            organizationId: 'org-uuid-1',
            organization: {
              id: 'org-uuid-1',
              name: 'Jane Logistics',
              slug: 'jane-logistics',
            },
            roles: [
              {
                role: {
                  id: 'role-uuid-1',
                  name: 'Organization Owner',
                  isSystem: true,
                },
              },
            ],
          },
        ],
      });

      const response = await service.login({
        email: 'jane@example.com',
        password: rawPassword,
      });

      expect(response.accessToken).toBe('mock.jwt.token');
      expect(response.user.email).toBe('jane@example.com');
      expect((response.user as any).passwordHash).toBeUndefined();
      expect(response.organization?.id).toBe('org-uuid-1');
      expect(response.roles).toContain('Organization Owner');
    });
  });

  describe('getMe', () => {
    it('should return user profile without passwordHash', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-uuid-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          {
            id: 'membership-uuid-1',
            status: 'ACTIVE',
            joinedAt: new Date(),
            organization: {
              id: 'org-uuid-1',
              name: 'Jane Logistics',
              slug: 'jane-logistics',
            },
            roles: [
              {
                role: {
                  id: 'role-uuid-1',
                  name: 'Organization Owner',
                  isSystem: true,
                  description: 'Manage org',
                },
              },
            ],
          },
        ],
      });

      const profile = await service.getMe('user-uuid-1');
      expect(profile).toBeDefined();
      expect(profile.id).toBe('user-uuid-1');
      expect((profile as any).passwordHash).toBeUndefined();
      expect(profile.memberships).toHaveLength(1);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.getMe('missing-id')).rejects.toThrow(UnauthorizedException);
    });
  });
});

