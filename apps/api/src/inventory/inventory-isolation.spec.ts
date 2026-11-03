import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';

describe('InventoryService Tenant & Warehouse Isolation', () => {
  let service: InventoryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      warehouse: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      storageLocation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      inventoryReservation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    service = new InventoryService(mockPrisma);
  });

  describe('Warehouse & Product Cross-Tenant Checks in receiveStock', () => {
    const baseDto = {
      organizationId: 'org-tenant-A',
      warehouseId: 'warehouse-1',
      locationId: 'location-1',
      productId: 'product-1',
      quantity: 10,
      idempotencyKey: 'idemp-1',
      notes: 'test',
    };

    it('should throw ForbiddenException if warehouse belongs to a different organization', async () => {
      // findFirst in org-tenant-A returns null
      mockPrisma.warehouse.findFirst.mockResolvedValueOnce(null);
      // findUnique finds it in org-tenant-B!
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: 'warehouse-1',
        organizationId: 'org-tenant-B',
      });

      await expect(service.receiveStock(baseDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if warehouse does not exist at all', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValueOnce(null);
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce(null);

      await expect(service.receiveStock(baseDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if storage location belongs to a different warehouse', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValueOnce({
        id: 'warehouse-1',
        organizationId: 'org-tenant-A',
        isActive: true,
      });

      // location not in warehouse-1
      mockPrisma.storageLocation.findFirst.mockResolvedValueOnce(null);
      // location exists in warehouse-2!
      mockPrisma.storageLocation.findUnique.mockResolvedValueOnce({
        id: 'location-1',
        warehouseId: 'warehouse-2',
      });

      await expect(service.receiveStock(baseDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if product belongs to a different organization', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValueOnce({
        id: 'warehouse-1',
        organizationId: 'org-tenant-A',
        isActive: true,
      });
      mockPrisma.storageLocation.findFirst.mockResolvedValueOnce({
        id: 'location-1',
        warehouseId: 'warehouse-1',
      });

      // product not in org-tenant-A
      mockPrisma.product.findFirst.mockResolvedValueOnce(null);
      // product exists in org-tenant-B!
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'product-1',
        organizationId: 'org-tenant-B',
      });

      await expect(service.receiveStock(baseDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Reservation Cross-Tenant Checks in releaseStock', () => {
    const releaseDto = {
      organizationId: 'org-tenant-A',
      warehouseId: 'warehouse-1',
      locationId: 'location-1',
      productId: 'product-1',
      reservationId: 'reservation-uuid-1',
      idempotencyKey: 'release-idemp-1',
      notes: 'release notes',
    };

    it('should throw ForbiddenException if reservation belongs to a different organization', async () => {
      mockPrisma.inventoryReservation.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryReservation.findUnique.mockResolvedValueOnce({
        id: 'reservation-uuid-1',
        organizationId: 'org-tenant-B',
      });

      await expect(service.releaseStock(releaseDto)).rejects.toThrow(ForbiddenException);
    });
  });
});

