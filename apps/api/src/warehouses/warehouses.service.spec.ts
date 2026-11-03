import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WarehousesService } from './warehouses.service.js';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let mockPrisma: any;

  const orgA = 'org-tenant-a-uuid';
  const orgB = 'org-tenant-b-uuid';
  const warehouseId = 'warehouse-uuid-1';
  const locationId = 'location-uuid-1';

  beforeEach(() => {
    mockPrisma = {
      warehouse: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      storageLocation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    service = new WarehousesService(mockPrisma);
  });

  describe('createWarehouse', () => {
    const createDto = {
      name: 'Mumbai Logistics Center',
      code: 'BOM-01',
      city: 'Mumbai',
      country: 'India',
      isActive: true,
    };

    it('should create warehouse successfully when code is unique in org', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce(null);
      mockPrisma.warehouse.create.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
        ...createDto,
        _count: { locations: 0, inventoryBalances: 0 },
      });

      const result = await service.createWarehouse(orgA, createDto);
      expect(result.id).toBe(warehouseId);
      expect(mockPrisma.warehouse.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgA,
          name: 'Mumbai Logistics Center',
          code: 'BOM-01',
          address: null,
          city: 'Mumbai',
          country: 'India',
          isActive: true,
        },
        include: {
          _count: { select: { locations: true, inventoryBalances: true } },
        },
      });
    });

    it('should throw ConflictException if warehouse code already exists in org', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: 'existing-wh',
        organizationId: orgA,
        code: 'BOM-01',
      });

      await expect(service.createWarehouse(orgA, createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should list warehouses filtered by organizationId', async () => {
      mockPrisma.warehouse.findMany.mockResolvedValueOnce([
        { id: warehouseId, name: 'Mumbai Hub', code: 'BOM-01' },
      ]);

      const result = await service.findAll(orgA, { search: 'mumbai', isActive: 'true' });
      expect(result).toHaveLength(1);
      expect(mockPrisma.warehouse.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne & Cross-Tenant Access', () => {
    it('should return warehouse when found and belongs to tenant', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
        name: 'Mumbai Hub',
      });

      const result = await service.findOne(orgA, warehouseId);
      expect(result.id).toBe(warehouseId);
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne(orgA, 'non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if warehouse belongs to another tenant (Cross-tenant)', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgB, // Belongs to Tenant B!
      });

      await expect(service.findOne(orgA, warehouseId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update & status', () => {
    it('should update warehouse details', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.warehouse.update.mockResolvedValueOnce({
        id: warehouseId,
        name: 'Updated Name',
      });

      const result = await service.update(orgA, warehouseId, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictException if updating to a duplicate code in org', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.warehouse.findFirst.mockResolvedValueOnce({
        id: 'other-wh-id',
        organizationId: orgA,
        code: 'DEL-01',
      });

      await expect(service.update(orgA, warehouseId, { code: 'DEL-01' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update operational status', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.warehouse.update.mockResolvedValueOnce({
        id: warehouseId,
        isActive: false,
      });

      const result = await service.updateStatus(orgA, warehouseId, false);
      expect(result.isActive).toBe(false);
    });
  });

  describe('Storage Locations', () => {
    it('should create storage location in authorized warehouse', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.storageLocation.findUnique.mockResolvedValueOnce(null);
      mockPrisma.storageLocation.create.mockResolvedValueOnce({
        id: locationId,
        warehouseId,
        name: 'Rack A2',
        code: 'A2',
      });

      const result = await service.createLocation(orgA, warehouseId, {
        name: 'Rack A2',
        code: 'A2',
      });

      expect(result.id).toBe(locationId);
    });

    it('should throw ConflictException for duplicate location code in same warehouse', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.storageLocation.findUnique.mockResolvedValueOnce({
        id: 'loc-existing',
        code: 'A1',
      });

      await expect(
        service.createLocation(orgA, warehouseId, { name: 'Duplicate Rack', code: 'A1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if location belongs to a different warehouse (Invalid relationship)', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.storageLocation.findUnique.mockResolvedValueOnce({
        id: locationId,
        warehouseId: 'different-warehouse-uuid', // belongs to another warehouse!
      });

      await expect(
        service.findOneLocation(orgA, warehouseId, locationId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should list all locations in warehouse', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValueOnce({
        id: warehouseId,
        organizationId: orgA,
      });
      mockPrisma.storageLocation.findMany.mockResolvedValueOnce([
        { id: locationId, code: 'A1', name: 'Rack A1' },
      ]);

      const result = await service.findAllLocations(orgA, warehouseId);
      expect(result).toHaveLength(1);
    });
  });
});

