import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let mockPrisma: any;

  const orgA = 'org-tenant-a-uuid';
  const orgB = 'org-tenant-b-uuid';
  const productId = 'product-uuid-1';

  beforeEach(() => {
    mockPrisma = {
      product: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      inventoryBalance: {
        findFirst: vi.fn(),
      },
      inventoryReservation: {
        findFirst: vi.fn(),
      },
      orderItem: {
        findFirst: vi.fn(),
      },
    };

    service = new ProductsService(mockPrisma);
  });

  describe('create', () => {
    const createDto = {
      name: 'Wireless Barcode Scanner',
      sku: 'WBS-001',
      unit: 'UNIT',
      description: 'Handheld scanner',
      isActive: true,
    };

  it('should create product successfully when SKU is unique in organization', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.product.create.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        ...createDto,
        _count: { inventoryBalances: 0, inventoryMovements: 0 },
      });

      const result = await service.create(orgA, createDto);
      expect(result.id).toBe(productId);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgA,
          name: 'Wireless Barcode Scanner',
          sku: 'WBS-001',
          description: 'Handheld scanner',
          category: 'General',
          unit: 'UNIT',
          isActive: true,
        },
        include: {
          _count: { select: { inventoryBalances: true, inventoryMovements: true } },
        },
      });
    });

    it('should throw ConflictException if SKU already exists within the same organization', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'existing-product-id',
        organizationId: orgA,
        sku: 'WBS-001',
      });

      await expect(service.create(orgA, createDto)).rejects.toThrow(ConflictException);
    });

    it('should allow the same SKU in a different organization', async () => {
      // In orgB, findUnique returns null
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.product.create.mockResolvedValueOnce({
        id: 'new-product-orgB',
        organizationId: orgB,
        ...createDto,
      });

      const result = await service.create(orgB, createDto);
      expect(result.id).toBe('new-product-orgB');
    });
  });

  describe('findAll', () => {
    it('should return products filtered by organizationId', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: productId, name: 'Scanner', sku: 'WBS-001' },
      ]);

      const result = await service.findAll(orgA, { search: 'scanner', isActive: 'true' });
      expect(result).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne & Cross-Tenant Access', () => {
    it('should return product details when found and belongs to tenant', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        name: 'Scanner',
        inventoryBalances: [],
      });

      const result = await service.findOne(orgA, productId);
      expect(result.id).toBe(productId);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne(orgA, 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if product belongs to a different organization (Cross-tenant)', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgB, // Belongs to Tenant B
      });

      await expect(service.findOne(orgA, productId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update & inventory safety checks', () => {
    it('should update product name and description safely', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        name: 'Old Name',
        sku: 'SKU-1',
        unit: 'UNIT',
      });
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.product.update.mockResolvedValueOnce({
        id: productId,
        name: 'New Name',
      });

      const result = await service.update(orgA, productId, { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should reject changing unit of measure if product has active inventory stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        sku: 'SKU-1',
        unit: 'UNIT',
      });
      // Active stock exists!
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce({
        availableQty: 50,
        reservedQty: 10,
      });

      await expect(
        service.update(orgA, productId, { unit: 'PALLET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject changing SKU if product has active inventory stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        sku: 'SKU-1',
        unit: 'UNIT',
      });
      // Active stock exists!
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce({
        availableQty: 50,
        reservedQty: 0,
      });

      await expect(
        service.update(orgA, productId, { sku: 'NEW-SKU-99' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if updating to a duplicate SKU in same organization', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        sku: 'SKU-1',
        unit: 'UNIT',
      });
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        id: 'other-product-id',
        organizationId: orgA,
        sku: 'EXISTING-SKU',
      });

      await expect(
        service.update(orgA, productId, { sku: 'EXISTING-SKU' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus & reservation safety', () => {
    it('should update product status to active', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        isActive: false,
      });
      mockPrisma.product.update.mockResolvedValueOnce({
        id: productId,
        isActive: true,
      });

      const result = await service.updateStatus(orgA, productId, true);
      expect(result.isActive).toBe(true);
    });

    it('should reject deactivating product if active reservations exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
        isActive: true,
      });
      // Active reservation exists!
      mockPrisma.inventoryReservation.findFirst.mockResolvedValueOnce({
        id: 'res-1',
        status: 'ACTIVE',
      });

      await expect(
        service.updateStatus(orgA, productId, false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteProduct & safe deletion', () => {
    it('should block deletion if active inventory balance exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
      });
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce({
        id: 'bal-1',
        availableQty: 10,
      });

      await expect(service.deleteProduct(orgA, productId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block deletion if product is referenced in customer orders', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
      });
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.orderItem.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        productId,
      });

      await expect(service.deleteProduct(orgA, productId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully delete product when no stock and no orders exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: productId,
        organizationId: orgA,
      });
      mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.orderItem.findFirst.mockResolvedValueOnce(null);
      mockPrisma.product.delete.mockResolvedValueOnce({ id: productId });

      const res = await service.deleteProduct(orgA, productId);
      expect(res.message).toContain('deleted successfully');
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: productId } });
    });
  });
});

