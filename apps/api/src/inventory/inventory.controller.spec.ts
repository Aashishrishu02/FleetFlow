import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            receiveStock: () => Promise.resolve({}),
            reserveStock: () => Promise.resolve({}),
            releaseStock: () => Promise.resolve({}),
            getBalances: () => Promise.resolve([]),
            getSummary: () => Promise.resolve({}),
            getMovements: () => Promise.resolve([]),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            membership: { findFirst: () => Promise.resolve(null) },
          },
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
