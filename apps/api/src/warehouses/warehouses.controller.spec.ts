import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarehousesController } from './warehouses.controller.js';

describe('WarehousesController', () => {
  let controller: WarehousesController;
  let mockService: any;

  const mockTenant = {
    userId: 'user-1',
    organizationId: 'org-tenant-1',
    roles: ['Organization Owner'],
  };

  beforeEach(() => {
    mockService = {
      createWarehouse: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      createLocation: vi.fn(),
      findAllLocations: vi.fn(),
      findOneLocation: vi.fn(),
      updateLocation: vi.fn(),
    };

    controller = new WarehousesController(mockService);
  });

  it('should delegate create warehouse with tenant organizationId', async () => {
    const dto = { name: 'WH North', code: 'WH-N' };
    mockService.createWarehouse.mockResolvedValueOnce({ id: 'wh-1', ...dto });

    const result = await controller.create(mockTenant, dto);
    expect(mockService.createWarehouse).toHaveBeenCalledWith(mockTenant.organizationId, dto);
    expect(result.id).toBe('wh-1');
  });

  it('should delegate findAll with tenant organizationId and query', async () => {
    const query = { search: 'test' };
    mockService.findAll.mockResolvedValueOnce([{ id: 'wh-1' }]);

    const result = await controller.findAll(mockTenant, query);
    expect(mockService.findAll).toHaveBeenCalledWith(mockTenant.organizationId, query);
    expect(result).toHaveLength(1);
  });

  it('should delegate findOne with tenant organizationId and warehouse id', async () => {
    mockService.findOne.mockResolvedValueOnce({ id: 'wh-1' });

    const result = await controller.findOne(mockTenant, 'wh-1');
    expect(mockService.findOne).toHaveBeenCalledWith(mockTenant.organizationId, 'wh-1');
    expect(result.id).toBe('wh-1');
  });

  it('should delegate update status', async () => {
    mockService.updateStatus.mockResolvedValueOnce({ id: 'wh-1', isActive: false });

    const result = await controller.updateStatus(mockTenant, 'wh-1', { isActive: false });
    expect(mockService.updateStatus).toHaveBeenCalledWith(mockTenant.organizationId, 'wh-1', false);
    expect(result.isActive).toBe(false);
  });

  it('should delegate storage location creation', async () => {
    const locDto = { name: 'Bin 1', code: 'B1' };
    mockService.createLocation.mockResolvedValueOnce({ id: 'loc-1', ...locDto });

    const result = await controller.createLocation(mockTenant, 'wh-1', locDto);
    expect(mockService.createLocation).toHaveBeenCalledWith(mockTenant.organizationId, 'wh-1', locDto);
    expect(result.id).toBe('loc-1');
  });
});

