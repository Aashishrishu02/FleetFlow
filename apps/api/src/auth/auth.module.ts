import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { TenantRolesGuard } from './guards/tenant-roles.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (): JwtModuleOptions => ({
        secret: process.env.JWT_SECRET || 'fleetflow_jwt_secret_key_development_2026_super_secure',
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, TenantRolesGuard],
  exports: [AuthService, JwtAuthGuard, TenantRolesGuard, PassportModule, JwtModule],
})
export class AuthModule {}

