import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: Error | undefined,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const message = info?.message || 'Authentication token is missing or invalid';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}

