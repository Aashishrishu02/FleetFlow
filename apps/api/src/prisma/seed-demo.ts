import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function seedDemoUser() {
  // Create or find demo organization
  const org = await prisma.organization.upsert({
    where: { slug: 'fleetflow-demo' },
    update: {},
    create: {
      name: 'FleetFlow Demo Organization',
      slug: 'fleetflow-demo',
    },
  });

  // Demo operator
  const passwordHash = await bcrypt.hash('FleetFlow2026!', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@fleetflow.io' },
    update: { passwordHash },
    create: {
      name: 'FleetFlow Demo Operator',
      email: 'demo@fleetflow.io',
      passwordHash,
    },
  });

  const ownerRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: 'Organization Owner',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Organization Owner',
      description: 'Demo Administrator and Owner',
      isSystem: true,
    },
  });

  const membership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: org.id,
      userId: user.id,
      status: 'ACTIVE',
    },
  });

  await prisma.membershipRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      membershipId: membership.id,
      roleId: ownerRole.id,
    },
  });

  console.log('Demo operator seeded successfully.');

  // Auditor account
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
        organizationId: org.id,
        name: 'Auditor',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Auditor',
      description: 'Read-only compliance and auditing role',
      isSystem: true,
    },
  });

  const auditorMembership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: auditorUser.id,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: org.id,
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

  console.log('Auditor account seeded successfully.');
}

seedDemoUser()
  .catch((error) => {
    console.error('Demo seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
