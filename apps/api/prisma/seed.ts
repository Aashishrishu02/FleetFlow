import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://fleetflow:fleetflow_dev_password@127.0.0.1:5433/fleetflow?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding FleetFlow enterprise production dataset into Postgres...');

  // 1. Organization & Settings
  const org = await prisma.organization.upsert({
    where: { slug: 'fleetflow-global' },
    update: {},
    create: {
      name: 'FleetFlow Global Logistics',
      slug: 'fleetflow-global',
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      defaultCurrency: 'USD',
      operatingTimezone: 'America/Chicago',
      autoAllocationEnabled: true,
      reorderAlertThreshold: 15,
      distanceWeight: new Prisma.Decimal(0.40),
      costWeight: new Prisma.Decimal(0.40),
      splitWeight: new Prisma.Decimal(0.20),
    },
  });

  // 2. Roles & Users for Each Core RBAC Persona
  const createOrgUser = async (email: string, name: string, roleName: string, pass: string) => {
    const hash = await bcrypt.hash(pass, 10);
    const u = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash },
      create: { name, email, passwordHash: hash },
    });

    const r = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name: roleName,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        name: roleName,
        isSystem: true,
        description: `${roleName} privileges`,
      },
    });

    const m = await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: u.id,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        organizationId: org.id,
        userId: u.id,
        status: 'ACTIVE',
      },
    });

    await prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: m.id,
          roleId: r.id,
        },
      },
      update: {},
      create: {
        membershipId: m.id,
        roleId: r.id,
      },
    });

    return u;
  };

  await createOrgUser('admin@fleetflow.io', 'Operations Director', 'Organization Owner', 'Admin@123456!');
  await createOrgUser('manager@fleetflow.io', 'General Operations Manager', 'Manager', 'Manager@123456!');
  await createOrgUser('whmanager@fleetflow.io', 'Chicago Facility Manager', 'Warehouse Manager', 'WhManager@123456!');
  await createOrgUser('invmanager@fleetflow.io', 'Lead Inventory Controller', 'Inventory Manager', 'InvManager@123456!');
  await createOrgUser('auditor@fleetflow.io', 'Compliance Auditor', 'Auditor', 'Auditor@123456!');

  // 3. Warehouses & Storage Locations
  const whChicago = await prisma.warehouse.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'ORD-DC1',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Chicago Central Distribution Center',
      code: 'ORD-DC1',
      address: "1000 O'Hare Logistics Way",
      city: 'Chicago',
      country: 'US',
      isActive: true,
    },
  });

  const whDallas = await prisma.warehouse.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'DFW-FC2',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Dallas Regional Fulfillment Facility',
      code: 'DFW-FC2',
      address: '500 DFW Airport Freeway',
      city: 'Dallas',
      country: 'US',
      isActive: true,
    },
  });

  const locChiA1 = await prisma.storageLocation.upsert({
    where: {
      warehouseId_code: {
        warehouseId: whChicago.id,
        code: 'A1-BAY-01',
      },
    },
    update: {},
    create: {
      warehouseId: whChicago.id,
      name: 'Pallet Rack A1-01',
      code: 'A1-BAY-01',
    },
  });

  const locDalB1 = await prisma.storageLocation.upsert({
    where: {
      warehouseId_code: {
        warehouseId: whDallas.id,
        code: 'B1-BAY-02',
      },
    },
    update: {},
    create: {
      warehouseId: whDallas.id,
      name: 'Pallet Rack B1-02',
      code: 'B1-BAY-02',
    },
  });

  // 4. Products Master
  const prodPallet = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: org.id,
        sku: 'SKU-PALLET-001',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Heavy Duty Wooden Pallet 48x40',
      sku: 'SKU-PALLET-001',
      description: 'Standard GMA heat-treated hardwood pallet for racking',
      unit: 'UNIT',
      isActive: true,
    },
  });

  const prodBattery = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: org.id,
        sku: 'SKU-FORKLIFT-BAT',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Industrial Forklift Lithium Battery 48V',
      sku: 'SKU-FORKLIFT-BAT',
      description: 'High-capacity rapid charge forklift battery module',
      unit: 'UNIT',
      isActive: true,
    },
  });

  // 5. Initial Inventory Balances
  await prisma.inventoryBalance.upsert({
    where: {
      warehouseId_locationId_productId: {
        warehouseId: whChicago.id,
        locationId: locChiA1.id,
        productId: prodPallet.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      warehouseId: whChicago.id,
      locationId: locChiA1.id,
      productId: prodPallet.id,
      availableQty: 450,
      reservedQty: 50,
      damagedQty: 5,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      warehouseId_locationId_productId: {
        warehouseId: whDallas.id,
        locationId: locDalB1.id,
        productId: prodBattery.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      warehouseId: whDallas.id,
      locationId: locDalB1.id,
      productId: prodBattery.id,
      availableQty: 80,
      reservedQty: 10,
      damagedQty: 0,
    },
  });

  // 6. Delivery Partners & Vehicles
  const partnerSwift = await prisma.deliveryPartner.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'SWIFT-EXP',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'SwiftExpress Freight Lines',
      code: 'SWIFT-EXP',
      contactEmail: 'dispatch@swiftexpress.com',
      contactPhone: '+1-800-555-0199',
      partnerType: 'CARRIER_3PL',
      serviceableRegions: ['US-MIDWEST', 'US-SOUTH'],
      maxActiveShipments: 50,
      onTimeRate: new Prisma.Decimal(98.5),
      status: 'ACTIVE',
    },
  });

  const existingVehicle = await prisma.vehicle.findFirst({
    where: { vehicleNumber: 'IL-SEMI-901' },
  });

  if (!existingVehicle) {
    await prisma.vehicle.create({
      data: {
        deliveryPartnerId: partnerSwift.id,
        vehicleNumber: 'IL-SEMI-901',
        vehicleType: 'TRAILER_53FT',
        maxWeightCapacityKg: new Prisma.Decimal(20000),
        status: 'AVAILABLE',
      },
    });
  }

  // 7. Pricing Rule
  const existingRule = await prisma.pricingRule.findFirst({
    where: { organizationId: org.id, ruleName: 'North America Standard Road Tariff 2026' },
  });

  if (!existingRule) {
    await prisma.pricingRule.create({
      data: {
        organizationId: org.id,
        ruleName: 'North America Standard Road Tariff 2026',
        serviceType: 'STANDARD_ROAD',
        baseCharge: new Prisma.Decimal(85.0),
        perKmRate: new Prisma.Decimal(1.25),
        perKgRate: new Prisma.Decimal(0.45),
        fuelSurchargePct: new Prisma.Decimal(14.5),
        handlingFee: new Prisma.Decimal(15.0),
        insurancePct: new Prisma.Decimal(2.0),
        version: 1,
        isActive: true,
      },
    });
  }

  console.log('Seeding completed successfully! Default admin credentials: admin@fleetflow.io / Admin@123456!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
