import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import passportJwt from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';

const { ExtractJwt, Strategy } = passportJwt;

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fleetflow_jwt_secret_key_development_2026_super_secure',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    return {
      userId: user.id,
      email: user.email,
      organizationId: payload.organizationId,
    };
  }
}

