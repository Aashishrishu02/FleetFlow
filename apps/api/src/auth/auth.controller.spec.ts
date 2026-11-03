import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: Partial<AuthService>;

  beforeEach(() => {
    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
      getMe: vi.fn(),
    };

    controller = new AuthController(mockAuthService as AuthService);
  });

  it('should call register on service', async () => {
    const dto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      organizationName: 'John Org',
    };
    const expected = {
      accessToken: 'token-123',
      user: { id: 'u1', name: 'John Doe', email: 'john@example.com' },
      organization: { id: 'o1', name: 'John Org', slug: 'john-org' },
      roles: ['Organization Owner'],
    };
    (mockAuthService.register as any).mockResolvedValueOnce(expected);

    const res = await controller.register(dto as any);
    expect(res).toEqual(expected);
    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
  });

  it('should call login on service', async () => {
    const dto = { email: 'john@example.com', password: 'password123' };
    const expected = {
      accessToken: 'token-123',
      user: { id: 'u1', name: 'John Doe', email: 'john@example.com' },
      organization: { id: 'o1', name: 'John Org', slug: 'john-org' },
      roles: ['Organization Owner'],
    };
    (mockAuthService.login as any).mockResolvedValueOnce(expected);

    const res = await controller.login(dto);
    expect(res).toEqual(expected);
    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('should call getMe on service with current user id', async () => {
    const user = { userId: 'u1', email: 'john@example.com' };
    const profile = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    (mockAuthService.getMe as any).mockResolvedValueOnce(profile);

    const res = await controller.getMe(user);
    expect(res).toEqual(profile);
    expect(mockAuthService.getMe).toHaveBeenCalledWith('u1');
  });
});

