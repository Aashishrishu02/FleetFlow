import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InventoryService', () => {
  let service: InventoryService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: (fn: any) => fn(mockPrisma),
      inventoryMovement: {
        findUnique: () => Promise.resolve(null),
        create: (args: any) => Promise.resolve({ id: 'mov-1', ...args.data }),
      },
      inventoryBalance: {
        findUnique: () => Promise.resolve({ id: 'bal-1', availableQty: 50 }),
        update: (args: any) => Promise.resolve({ id: 'bal-1', availableQty: 40 }),
      },
      warehouse: {
        findFirst: () => Promise.resolve({ id: 'wh-1', isActive: true }),
      },
      storageLocation: {
        findFirst: () => Promise.resolve({ id: 'loc-1' }),
      },
      product: {
        findFirst: () => Promise.resolve({ id: 'prod-1', isActive: true }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully issue stock and return updated balance', async () => {
    const res = await service.issueStock({
      organizationId: 'org-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      productId: 'prod-1',
      quantity: 10,
      idempotencyKey: 'iss-test-key-1',
    });

    expect(res.message).toBe('Stock issued successfully');
    expect(res.balance.availableQty).toBe(40);
  });

  it('should throw BadRequestException if available quantity is insufficient', async () => {
    mockPrisma.inventoryBalance.findUnique = () => Promise.resolve({ id: 'bal-1', availableQty: 5 });

    await expect(
      service.issueStock({
        organizationId: 'org-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        productId: 'prod-1',
        quantity: 10,
        idempotencyKey: 'iss-test-key-2',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
