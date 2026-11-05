import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import type { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import type { CreateStorageLocationDto } from './dto/create-storage-location.dto.js';
import type { UpdateStorageLocationDto } from './dto/update-storage-location.dto.js';
import type { QueryWarehousesDto } from './dto/query-warehouses.dto.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new warehouse within the tenant organization.
   */
  async createWarehouse(organizationId: string, dto: CreateWarehouseDto) {
    const code = dto.code.trim().toUpperCase();

    // Check for existing warehouse with this code in the tenant organization
    const existing = await this.prisma.warehouse.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Warehouse code "${code}" already exists in this organization.`,
      );
    }

    return this.prisma.warehouse.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        code,
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        country: dto.country?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        _count: {
          select: {
            locations: true,
            inventoryBalances: true,
          },
        },
      },
    });
  }

  /**
   * List all warehouses for the authorized organization with optional filtering.
   */
  async findAll(organizationId: string, query?: QueryWarehousesDto) {
    const where: any = {
      organizationId,
    };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query?.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
        { city: { contains: s, mode: 'insensitive' } },
        { country: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.warehouse.findMany({
      where,
      include: {
        _count: {
          select: {
            locations: true,
            inventoryBalances: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get warehouse details by ID with tenant isolation verification.
   */
  async findOne(organizationId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        locations: {
          orderBy: { code: 'asc' },
          include: {
            _count: {
              select: {
                inventoryBalances: true,
              },
            },
          },
        },
        _count: {
          select: {
            locations: true,
            inventoryBalances: true,
            inventoryMovements: true,
            inventoryReservations: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${id}" not found.`);
    }

    if (warehouse.organizationId !== organizationId) {
      throw new ForbiddenException(
        `Cross-tenant access forbidden: Warehouse belongs to a different organization.`,
      );
    }

    return warehouse;
  }

  /**
   * Update warehouse details.
   */
  async update(organizationId: string, id: string, dto: UpdateWarehouseDto) {
    await this.findOne(organizationId, id);

    if (dto.code) {
      const codeUpper = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.warehouse.findFirst({
        where: {
          organizationId,
          code: codeUpper,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Warehouse code "${codeUpper}" already exists in this organization.`,
        );
      }
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.country !== undefined ? { country: dto.country?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        _count: {
          select: {
            locations: true,
            inventoryBalances: true,
          },
        },
      },
    });
  }

  /**
   * Update warehouse operational status (active/inactive).
   */
  async updateStatus(organizationId: string, id: string, isActive: boolean) {
    await this.findOne(organizationId, id);

    return this.prisma.warehouse.update({
      where: { id },
      data: { isActive },
      include: {
        _count: {
          select: {
            locations: true,
            inventoryBalances: true,
          },
        },
      },
    });
  }

  /**
   * Create a storage location within an authorized warehouse.
   */
  async createLocation(
    organizationId: string,
    warehouseId: string,
    dto: CreateStorageLocationDto,
  ) {
    await this.findOne(organizationId, warehouseId);

    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.storageLocation.findUnique({
      where: {
        warehouseId_code: {
          warehouseId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Storage location code "${code}" already exists in this warehouse.`,
      );
    }

    return this.prisma.storageLocation.create({
      data: {
        warehouseId,
        name: dto.name.trim(),
        code,
        type: dto.type?.trim().toUpperCase() || 'BIN',
      },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
          },
        },
      },
    });
  }

  /**
   * List all storage locations for an authorized warehouse.
   */
  async findAllLocations(organizationId: string, warehouseId: string) {
    await this.findOne(organizationId, warehouseId);

    return this.prisma.storageLocation.findMany({
      where: { warehouseId },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  /**
   * Get a specific storage location in a warehouse.
   */
  async findOneLocation(
    organizationId: string,
    warehouseId: string,
    locationId: string,
  ) {
    await this.findOne(organizationId, warehouseId);

    const location = await this.prisma.storageLocation.findUnique({
      where: { id: locationId },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryMovements: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Storage location with ID "${locationId}" not found.`,
      );
    }

    if (location.warehouseId !== warehouseId) {
      throw new ForbiddenException(
        `Storage location does not belong to the specified warehouse.`,
      );
    }

    return location;
  }

  /**
   * Update a storage location.
   */
  async updateLocation(
    organizationId: string,
    warehouseId: string,
    locationId: string,
    dto: UpdateStorageLocationDto,
  ) {
    await this.findOneLocation(organizationId, warehouseId, locationId);

    if (dto.code) {
      const codeUpper = dto.code.trim().toUpperCase();
      const conflict = await this.prisma.storageLocation.findFirst({
        where: {
          warehouseId,
          code: codeUpper,
          NOT: { id: locationId },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Storage location code "${codeUpper}" already exists in this warehouse.`,
        );
      }
    }

    return this.prisma.storageLocation.update({
      where: { id: locationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.type !== undefined ? { type: dto.type.trim().toUpperCase() } : {}),
      },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
          },
        },
      },
    });
  }

  /**
   * Delete warehouse safely. Blocks deletion if non-zero inventory balances exist.
   */
  async deleteWarehouse(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    const activeBalance = await this.prisma.inventoryBalance.findFirst({
      where: {
        warehouseId: id,
        OR: [
          { availableQty: { gt: 0 } },
          { reservedQty: { gt: 0 } },
          { damagedQty: { gt: 0 } },
          { inTransitQty: { gt: 0 } },
        ],
      },
    });

    if (activeBalance) {
      throw new BadRequestException(
        'Cannot delete warehouse with active inventory balances. Please transfer or adjust stock first or deactivate the facility.',
      );
    }

    // Cascade delete any remaining empty locations & balances, then warehouse
    await this.prisma.storageLocation.deleteMany({
      where: { warehouseId: id },
    });

    await this.prisma.warehouse.delete({
      where: { id },
    });

    return { message: 'Warehouse deleted successfully' };
  }

  /**
   * Delete storage location safely. Blocks deletion if non-zero inventory balance exists.
   */
  async deleteLocation(organizationId: string, warehouseId: string, locationId: string) {
    await this.findOneLocation(organizationId, warehouseId, locationId);

    const activeBalance = await this.prisma.inventoryBalance.findFirst({
      where: {
        locationId,
        OR: [
          { availableQty: { gt: 0 } },
          { reservedQty: { gt: 0 } },
          { damagedQty: { gt: 0 } },
        ],
      },
    });

    if (activeBalance) {
      throw new BadRequestException(
        'Cannot delete storage location with non-zero inventory balance. Please transfer or adjust stock first.',
      );
    }

    await this.prisma.storageLocation.delete({
      where: { id: locationId },
    });

    return { message: 'Storage location deleted successfully' };
  }
}

