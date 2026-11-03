import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsController } from './products.controller.js';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockService: any;

  const mockTenant = {
    userId: 'user-1',
    organizationId: 'org-tenant-1',
    roles: ['Organization Owner'],
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };

    controller = new ProductsController(mockService);
  });

  it('should delegate create product to service with tenant organizationId', async () => {
    const dto = { name: 'Thermal Printer', sku: 'PRN-01', unit: 'UNIT' };
    mockService.create.mockResolvedValueOnce({ id: 'prod-1', ...dto });

    const result = await controller.create(mockTenant, dto);
    expect(mockService.create).toHaveBeenCalledWith(mockTenant.organizationId, dto);
    expect(result.id).toBe('prod-1');
  });

  it('should delegate findAll to service with tenant organizationId and query', async () => {
    const query = { search: 'scanner', isActive: 'true' };
    mockService.findAll.mockResolvedValueOnce([{ id: 'prod-1' }]);

    const result = await controller.findAll(mockTenant, query);
    expect(mockService.findAll).toHaveBeenCalledWith(mockTenant.organizationId, query);
    expect(result).toHaveLength(1);
  });

  it('should delegate findOne to service with tenant organizationId and product id', async () => {
    mockService.findOne.mockResolvedValueOnce({ id: 'prod-1' });

    const result = await controller.findOne(mockTenant, 'prod-1');
    expect(mockService.findOne).toHaveBeenCalledWith(mockTenant.organizationId, 'prod-1');
    expect(result.id).toBe('prod-1');
  });

  it('should delegate update to service with tenant organizationId and product id', async () => {
    const dto = { name: 'Updated Printer' };
    mockService.update.mockResolvedValueOnce({ id: 'prod-1', ...dto });

    const result = await controller.update(mockTenant, 'prod-1', dto);
    expect(mockService.update).toHaveBeenCalledWith(mockTenant.organizationId, 'prod-1', dto);
    expect(result.id).toBe('prod-1');
  });

  it('should delegate updateStatus to service', async () => {
    mockService.updateStatus.mockResolvedValueOnce({ id: 'prod-1', isActive: false });

    const result = await controller.updateStatus(mockTenant, 'prod-1', { isActive: false });
    expect(mockService.updateStatus).toHaveBeenCalledWith(mockTenant.organizationId, 'prod-1', false);
    expect(result.isActive).toBe(false);
  });
});

