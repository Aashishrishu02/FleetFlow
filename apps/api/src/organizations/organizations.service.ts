import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. GET CURRENT ORGANIZATION & SETTINGS
  // ============================================================================
  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        settings: true,
        _count: {
          select: {
            memberships: { where: { status: 'ACTIVE' } },
            warehouses: { where: { isActive: true } },
            products: { where: { isActive: true } },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Default settings fallback if settings record doesn't exist yet
    let settings = org.settings;
    if (!settings) {
      settings = await this.prisma.organizationSettings.create({
        data: {
          organizationId: org.id,
          defaultCurrency: 'USD',
          operatingTimezone: 'UTC',
          autoAllocationEnabled: true,
          reorderAlertThreshold: 10,
          distanceWeight: new Prisma.Decimal(0.4),
          costWeight: new Prisma.Decimal(0.4),
          splitWeight: new Prisma.Decimal(0.2),
        },
      });
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      stats: {
        activeMembers: org._count.memberships,
        activeWarehouses: org._count.warehouses,
        activeProducts: org._count.products,
      },
      settings,
    };
  }

  // ============================================================================
  // 2. UPDATE SETTINGS
  // ============================================================================
  async updateSettings(
    organizationId: string,
    dto: {
      defaultCurrency?: string;
      operatingTimezone?: string;
      autoAllocationEnabled?: boolean;
      reorderAlertThreshold?: number;
      distanceWeight?: number;
      costWeight?: number;
      splitWeight?: number;
    },
  ) {
    const data: Prisma.OrganizationSettingsUpdateInput = {};
    if (dto.defaultCurrency !== undefined) data.defaultCurrency = dto.defaultCurrency;
    if (dto.operatingTimezone !== undefined) data.operatingTimezone = dto.operatingTimezone;
    if (dto.autoAllocationEnabled !== undefined) data.autoAllocationEnabled = dto.autoAllocationEnabled;
    if (dto.reorderAlertThreshold !== undefined) data.reorderAlertThreshold = dto.reorderAlertThreshold;
    if (dto.distanceWeight !== undefined) data.distanceWeight = new Prisma.Decimal(dto.distanceWeight);
    if (dto.costWeight !== undefined) data.costWeight = new Prisma.Decimal(dto.costWeight);
    if (dto.splitWeight !== undefined) data.splitWeight = new Prisma.Decimal(dto.splitWeight);

    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: data,
      create: {
        organizationId,
        defaultCurrency: dto.defaultCurrency || 'USD',
        operatingTimezone: dto.operatingTimezone || 'UTC',
        autoAllocationEnabled: dto.autoAllocationEnabled ?? true,
        reorderAlertThreshold: dto.reorderAlertThreshold ?? 10,
        distanceWeight: new Prisma.Decimal(dto.distanceWeight ?? 0.4),
        costWeight: new Prisma.Decimal(dto.costWeight ?? 0.4),
        splitWeight: new Prisma.Decimal(dto.splitWeight ?? 0.2),
      },
    });
  }

  // ============================================================================
  // 3. GET MEMBERS
  // ============================================================================
  async getMembers(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        roles: { include: { role: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      status: m.status,
      joinedAt: m.joinedAt,
      roles: m.roles.map((r) => r.role.name),
    }));
  }

  // ============================================================================
  // 4. INVITE / ADD MEMBER
  // ============================================================================
  async inviteMember(
    organizationId: string,
    dto: { email: string; name: string; roleName: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Find or create user
      let user = await tx.user.findUnique({ where: { email: dto.email } });
      if (!user) {
        const tempPasswordHash = await bcrypt.hash('TempPassword123!', 10);
        user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash: tempPasswordHash,
          },
        });
      }

      // Check existing membership
      const existingMembership = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        if (existingMembership.status === 'ACTIVE') {
          throw new ConflictException('User is already an active member of this organization');
        } else {
          // Reactivate
          await tx.membership.update({
            where: { id: existingMembership.id },
            data: { status: 'ACTIVE' },
          });
        }
      }

      const membership =
        existingMembership ??
        (await tx.membership.create({
          data: {
            organizationId,
            userId: user.id,
            status: 'ACTIVE',
          },
        }));

      // Find role
      let role = await tx.role.findFirst({
        where: { organizationId, name: dto.roleName },
      });

      if (!role) {
        // Fallback to system role if exists or create
        role = await tx.role.create({
          data: {
            organizationId,
            name: dto.roleName,
            isSystem: false,
          },
        });
      }

      // Assign role
      await tx.membershipRole.upsert({
        where: {
          membershipId_roleId: {
            membershipId: membership.id,
            roleId: role.id,
          },
        },
        create: {
          membershipId: membership.id,
          roleId: role.id,
        },
        update: {},
      });

      return {
        message: 'Member invited and added successfully',
        membershipId: membership.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: role.name,
      };
    });
  }

  // ============================================================================
  // 5. UPDATE MEMBER ROLE
  // ============================================================================
  async updateMemberRole(
    organizationId: string,
    membershipId: string,
    roleName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      let role = await tx.role.findFirst({
        where: { organizationId, name: roleName },
      });

      if (!role) {
        role = await tx.role.create({
          data: {
            organizationId,
            name: roleName,
            isSystem: false,
          },
        });
      }

      // Delete existing roles for this membership and set new
      await tx.membershipRole.deleteMany({
        where: { membershipId },
      });

      await tx.membershipRole.create({
        data: {
          membershipId,
          roleId: role.id,
        },
      });

      return { message: 'Member role updated successfully', role: role.name };
    });
  }

  // ============================================================================
  // 6. REMOVE / SUSPEND MEMBER
  // ============================================================================
  async removeMember(organizationId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'SUSPENDED' },
    });

    return { message: 'Member suspended successfully' };
  }
}
