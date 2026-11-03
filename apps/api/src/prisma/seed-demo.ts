import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedDemoUser() {
  const hash = await bcrypt.hash('FleetFlow2026!', 10);
  const email = 'demo@fleetflow.io';

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash },
    create: {
      name: 'FleetFlow Demo Operator',
      email,
      passwordHash: hash,
    },
  });

  const demoOrgId = '810d6d5c-8112-4072-83f0-b7127daa6c85';

  const org = await prisma.organization.findUnique({
    where: { id: demoOrgId },
  });

  if (org) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: demoOrgId,
          name: 'Organization Owner',
        },
      },
      update: {},
      create: {
        organizationId: demoOrgId,
        name: 'Organization Owner',
        description: 'Demo Administrator and Owner',
        isSystem: true,
      },
    });

    const membership = await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: demoOrgId,
          userId: user.id,
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        organizationId: demoOrgId,
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    await prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: membership.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        membershipId: membership.id,
        roleId: role.id,
      },
    });

    console.log('Demo user seeded successfully (demo@fleetflow.io / FleetFlow2026!)');

    // Seed Auditor user
    const auditorHash = await bcrypt.hash('Auditor2026!', 10);
    const auditorUser = await prisma.user.upsert({
      where: { email: 'auditor@fleetflow.io' },
      update: { passwordHash: auditorHash },
      create: {
        name: 'FleetFlow Auditor',
        email: 'auditor@fleetflow.io',
        passwordHash: auditorHash,
      },
    });

    const auditorRole = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: demoOrgId,
          name: 'Auditor',
        },
      },
      update: {},
      create: {
        organizationId: demoOrgId,
        name: 'Auditor',
        description: 'Read-only compliance and auditing role',
        isSystem: true,
      },
    });

    const auditorMembership = await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: demoOrgId,
          userId: auditorUser.id,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        organizationId: demoOrgId,
        userId: auditorUser.id,
        status: 'ACTIVE',
      },
    });

    await prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: auditorMembership.id,
          roleId: auditorRole.id,
        },
      },
      update: {},
      create: {
        membershipId: auditorMembership.id,
        roleId: auditorRole.id,
      },
    });

    console.log('Auditor user seeded successfully (auditor@fleetflow.io / Auditor2026!)');
  }
}

seedDemoUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

