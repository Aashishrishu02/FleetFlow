import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './jwt.strategy.js';
import { MembershipStatus } from '../generated/prisma/enums.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user, their organization, and assign Organization Owner role atomically.
   */
  async register(dto: RegisterDto) {
    // 1. Check for duplicate email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }

    // 2. Generate unique organization slug
    const baseSlug = dto.organizationSlug
      ? dto.organizationSlug.toLowerCase()
      : dto.organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'org';

    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // 3. Hash password securely
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // 4. Atomic transaction: create User, Organization, Role, Membership, MembershipRole
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user (never select or return passwordHash)
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      });

      // Create Organization Owner system role
      const role = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Organization Owner',
          description: 'Manage organization, billing configuration, and members',
          isSystem: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      // Create active membership
      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      // Link membership to role
      await tx.membershipRole.create({
        data: {
          membershipId: membership.id,
          roleId: role.id,
        },
      });

      return {
        user,
        organization,
        roleName: role.name,
      };
    });

    // 5. Generate JWT access token
    const payload: JwtPayload = {
      sub: result.user.id,
      email: result.user.email,
      organizationId: result.organization.id,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: result.user,
      organization: result.organization,
      roles: [result.roleName],
    };
  }

  /**
   * Log in an existing user with email and password.
   * Returns generic 401 error message for non-existent users or bad passwords to prevent enumeration.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    isSystem: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Use generic error message to prevent user enumeration
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const primaryMembership = user.memberships[0] || null;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: primaryMembership?.organizationId,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      organization: primaryMembership?.organization ?? null,
      roles: primaryMembership?.roles.map((r) => r.role.name) ?? [],
    };
  }

  /**
   * Get current authenticated user profile and memberships.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: {
            id: true,
            status: true,
            joinedAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    isSystem: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    return user;
  }
}

