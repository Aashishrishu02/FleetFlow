import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import type { QueryProductsDto } from './dto/query-products.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product catalog entry within the authorized organization.
   */
  async create(organizationId: string, dto: CreateProductDto) {
    const sku = dto.sku.trim().toUpperCase();

    // Check for existing product with this SKU in the organization
    const existing = await this.prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId,
          sku,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Product with SKU "${sku}" already exists in this organization.`,
      );
    }

    return this.prisma.product.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        sku,
        description: dto.description?.trim() || null,
        unit: (dto.unit?.trim().toUpperCase()) || 'UNIT',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryMovements: true,
          },
        },
      },
    });
  }

  /**
   * List products for the authorized organization with search and status filters.
   */
  async findAll(organizationId: string, query?: QueryProductsDto) {
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
        { sku: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryMovements: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get product details by ID with tenant isolation verification.
   */
  async findOne(organizationId: string, id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        inventoryBalances: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        _count: {
          select: {
            inventoryBalances: true,
            inventoryMovements: true,
            inventoryReservations: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }

    if (product.organizationId !== organizationId) {
      throw new ForbiddenException(
        `Cross-tenant access forbidden: Product belongs to a different organization.`,
      );
    }

    return product;
  }

  /**
   * Update product details with safety checks for products referenced by inventory.
   */
  async update(organizationId: string, id: string, dto: UpdateProductDto) {
    const current = await this.findOne(organizationId, id);

    // Check if product has active inventory stock
    const activeInventory = await this.prisma.inventoryBalance.findFirst({
      where: {
        productId: id,
        OR: [
          { availableQty: { gt: 0 } },
          { reservedQty: { gt: 0 } },
        ],
      },
    });

    // Prevent unsafe unit changes when active stock exists
    if (dto.unit && dto.unit.trim().toUpperCase() !== current.unit) {
      if (activeInventory) {
        throw new BadRequestException(
          `Cannot modify unit of measure for product with active inventory stock (${activeInventory.availableQty} units available).`,
        );
      }
    }

    // Check SKU update safety & uniqueness
    if (dto.sku) {
      const skuUpper = dto.sku.trim().toUpperCase();
      if (skuUpper !== current.sku) {
        if (activeInventory) {
          throw new BadRequestException(
            `Cannot modify SKU for product with active inventory stock (${activeInventory.availableQty} units available).`,
          );
        }

        const duplicate = await this.prisma.product.findFirst({
          where: {
            organizationId,
            sku: skuUpper,
            NOT: { id },
          },
        });

        if (duplicate) {
          throw new ConflictException(
            `Product with SKU "${skuUpper}" already exists in this organization.`,
          );
        }
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit.trim().toUpperCase() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryMovements: true,
          },
        },
      },
    });
  }

  /**
   * Activate or deactivate product with active reservation validation.
   */
  async updateStatus(organizationId: string, id: string, isActive: boolean) {
    await this.findOne(organizationId, id);

    if (!isActive) {
      // Prevent deactivation if active reservations exist
      const activeReservation = await this.prisma.inventoryReservation.findFirst({
        where: {
          productId: id,
          status: 'ACTIVE',
        },
      });

      if (activeReservation) {
        throw new BadRequestException(
          'Cannot deactivate product with active inventory reservations.',
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryMovements: true,
          },
        },
      },
    });
  }
}
