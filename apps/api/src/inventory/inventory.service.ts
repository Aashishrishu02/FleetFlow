
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiveStockDto } from './dto/receive-stock.dto.js';
import { ReserveStockDto } from './dto/reserve-stock.dto.js';
import { ReleaseStockDto } from './dto/release-stock.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // 1. RECEIVE STOCK
  // ==========================================

  async receiveStock(dto: ReceiveStockDto) {
    const orgId = dto.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }

    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException(
        'Quantity must be a positive integer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingMovement = await tx.inventoryMovement.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existingMovement) {
        const sameRequest =
          existingMovement.movementType === 'RECEIVE' &&
          existingMovement.organizationId === orgId &&
          existingMovement.warehouseId === dto.warehouseId &&
          existingMovement.locationId === dto.locationId &&
          existingMovement.productId === dto.productId &&
          existingMovement.quantity === dto.quantity;

        if (!sameRequest) {
          throw new ConflictException(
            'Idempotency key already used for a different request',
          );
        }

        return {
          message: 'Stock was already received',
          duplicate: true,
          movement: existingMovement,
        };
      }

      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          organizationId: orgId,
          isActive: true,
        },
      });

      if (!warehouse) {
        const crossTenantWarehouse = await tx.warehouse.findUnique({
          where: { id: dto.warehouseId },
        });
        if (crossTenantWarehouse && crossTenantWarehouse.organizationId !== orgId) {
          throw new ForbiddenException(
            'Cross-tenant warehouse access denied: Warehouse belongs to a different organization',
          );
        }
        throw new NotFoundException(
          'Warehouse not found or inactive',
        );
      }

      const location = await tx.storageLocation.findFirst({
        where: {
          id: dto.locationId,
          warehouseId: dto.warehouseId,
        },
      });

      if (!location) {
        const crossWarehouseLocation = await tx.storageLocation.findUnique({
          where: { id: dto.locationId },
        });
        if (crossWarehouseLocation && crossWarehouseLocation.warehouseId !== dto.warehouseId) {
          throw new ForbiddenException(
            'Storage location belongs to a different warehouse',
          );
        }
        throw new NotFoundException(
          'Storage location not found',
        );
      }

      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          organizationId: orgId,
          isActive: true,
        },
      });

      if (!product) {
        const crossTenantProduct = await tx.product.findUnique({
          where: { id: dto.productId },
        });
        if (crossTenantProduct && crossTenantProduct.organizationId !== orgId) {
          throw new ForbiddenException(
            'Cross-tenant product access denied: Product belongs to a different organization',
          );
        }
        throw new NotFoundException(
          'Product not found or inactive',
        );
      }

      const balance = await tx.inventoryBalance.upsert({
        where: {
          warehouseId_locationId_productId: {
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            productId: dto.productId,
          },
        },
        create: {
          organizationId: orgId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          productId: dto.productId,
          availableQty: dto.quantity,
        },
        update: {
          availableQty: {
            increment: dto.quantity,
          },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: orgId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          productId: dto.productId,
          movementType: 'RECEIVE',
          quantity: dto.quantity,
          idempotencyKey: dto.idempotencyKey,
          notes: dto.notes,
        },
      });

      return {
        message: 'Stock received successfully',
        duplicate: false,
        balance,
        movement,
      };
    });
  }

  // ==========================================
  // 2. RESERVE STOCK
  // ==========================================

  async reserveStock(dto: ReserveStockDto) {
    const orgId = dto.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }

    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException(
        'Quantity must be a positive integer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingMovement = await tx.inventoryMovement.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existingMovement) {
        const sameRequest =
          existingMovement.movementType === 'RESERVE' &&
          existingMovement.organizationId === orgId &&
          existingMovement.warehouseId === dto.warehouseId &&
          existingMovement.locationId === dto.locationId &&
          existingMovement.productId === dto.productId &&
          existingMovement.quantity === dto.quantity &&
          existingMovement.referenceType === dto.referenceType &&
          existingMovement.referenceId === dto.referenceId;

        if (!sameRequest) {
          throw new ConflictException(
            'Idempotency key already used for a different request',
          );
        }

        return {
          message: 'Stock was already reserved',
          duplicate: true,
          movement: existingMovement,
        };
      }

      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          organizationId: orgId,
          isActive: true,
        },
      });

      if (!warehouse) {
        const crossTenantWarehouse = await tx.warehouse.findUnique({
          where: { id: dto.warehouseId },
        });
        if (crossTenantWarehouse && crossTenantWarehouse.organizationId !== orgId) {
          throw new ForbiddenException(
            'Cross-tenant warehouse access denied: Warehouse belongs to a different organization',
          );
        }
        throw new NotFoundException(
          'Warehouse not found or inactive',
        );
      }

      const location = await tx.storageLocation.findFirst({
        where: {
          id: dto.locationId,
          warehouseId: dto.warehouseId,
        },
      });

      if (!location) {
        const crossWarehouseLocation = await tx.storageLocation.findUnique({
          where: { id: dto.locationId },
        });
        if (crossWarehouseLocation && crossWarehouseLocation.warehouseId !== dto.warehouseId) {
          throw new ForbiddenException(
            'Storage location belongs to a different warehouse',
          );
        }
        throw new NotFoundException(
          'Storage location not found',
        );
      }

      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          organizationId: orgId,
          isActive: true,
        },
      });

      if (!product) {
        const crossTenantProduct = await tx.product.findUnique({
          where: { id: dto.productId },
        });
        if (crossTenantProduct && crossTenantProduct.organizationId !== orgId) {
          throw new ForbiddenException(
            'Cross-tenant product access denied: Product belongs to a different organization',
          );
        }
        throw new NotFoundException(
          'Product not found or inactive',
        );
      }

      const result = await tx.inventoryBalance.updateMany({
        where: {
          organizationId: orgId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          productId: dto.productId,
          availableQty: {
            gte: dto.quantity,
          },
        },
        data: {
          availableQty: {
            decrement: dto.quantity,
          },
          reservedQty: {
            increment: dto.quantity,
          },
        },
      });

      if (result.count !== 1) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            organizationId: orgId,
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            productId: dto.productId,
          },
        });

        if (!balance) {
          throw new NotFoundException(
            'Inventory balance not found',
          );
        }

        throw new BadRequestException(
          `Insufficient stock. Available quantity: ${balance.availableQty}`,
        );
      }

      const reservation = await tx.inventoryReservation.create({
        data: {
          organizationId: orgId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          productId: dto.productId,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          quantity: dto.quantity,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: orgId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          productId: dto.productId,
          movementType: 'RESERVE',
          quantity: dto.quantity,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          idempotencyKey: dto.idempotencyKey,
          notes: dto.notes,
        },
      });

      const balance = await tx.inventoryBalance.findUnique({
        where: {
          warehouseId_locationId_productId: {
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            productId: dto.productId,
          },
        },
      });

      return {
        message: 'Stock reserved successfully',
        duplicate: false,
        balance,
        reservation,
        movement,
      };
    });
  }

  // ==========================================
  // 3. RELEASE STOCK
  // ==========================================

  async releaseStock(dto: ReleaseStockDto) {
    const orgId = dto.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findFirst({
        where: {
          id: dto.reservationId,
          organizationId: orgId,
          ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
          ...(dto.locationId ? { locationId: dto.locationId } : {}),
          ...(dto.productId ? { productId: dto.productId } : {}),
        },
      });

      if (!reservation) {
        const crossTenantReservation = await tx.inventoryReservation.findUnique({
          where: { id: dto.reservationId },
        });
        if (crossTenantReservation && crossTenantReservation.organizationId !== orgId) {
          throw new ForbiddenException(
            'Cross-tenant reservation access denied: Reservation belongs to a different organization',
          );
        }
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Reservation cannot be released. Current status: ${reservation.status}`,
        );
      }

      const warehouseId = dto.warehouseId || reservation.warehouseId;
      const locationId = dto.locationId || reservation.locationId;
      const productId = dto.productId || reservation.productId;

      const existingMovement = await tx.inventoryMovement.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existingMovement) {
        const sameRequest =
          existingMovement.movementType === 'RELEASE' &&
          existingMovement.organizationId === orgId &&
          existingMovement.warehouseId === warehouseId &&
          existingMovement.locationId === locationId &&
          existingMovement.productId === productId &&
          existingMovement.referenceType === 'RESERVATION' &&
          existingMovement.referenceId === dto.reservationId;

        if (!sameRequest) {
          throw new ConflictException(
            'Idempotency key already used for a different request',
          );
        }

        return {
          message: 'Stock was already released',
          duplicate: true,
          movement: existingMovement,
        };
      }

      const result = await tx.inventoryBalance.updateMany({
        where: {
          organizationId: orgId,
          warehouseId,
          locationId,
          productId,
          reservedQty: {
            gte: reservation.quantity,
          },
        },
        data: {
          availableQty: {
            increment: reservation.quantity,
          },
          reservedQty: {
            decrement: reservation.quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Inventory balance could not be released safely',
        );
      }

      const updatedReservation =
        await tx.inventoryReservation.updateMany({
          where: {
            id: reservation.id,
            status: 'ACTIVE',
          },
          data: {
            status: 'RELEASED',
          },
        });

      if (updatedReservation.count !== 1) {
        throw new ConflictException(
          'Reservation was already processed',
        );
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: orgId,
          warehouseId,
          locationId,
          productId,
          movementType: 'RELEASE',
          quantity: reservation.quantity,
          referenceType: 'RESERVATION',
          referenceId: reservation.id,
          idempotencyKey: dto.idempotencyKey,
          notes: dto.notes,
        },
      });

      const balance = await tx.inventoryBalance.findUnique({
        where: {
          warehouseId_locationId_productId: {
            warehouseId,
            locationId,
            productId,
          },
        },
      });

      const finalReservation =
        await tx.inventoryReservation.findUnique({
          where: { id: reservation.id },
        });

      return {
        message: 'Stock released successfully',
        duplicate: false,
        balance,
        reservation: finalReservation,
        movement,
      };
    });
  }

  // ==========================================
  // 4. GET INVENTORY BALANCES
  // ==========================================

  async getBalances(organizationId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { organizationId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
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
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  // ==========================================
  // 5. GET INVENTORY SUMMARY
  // ==========================================

  async getSummary(organizationId: string) {
    const balances = await this.prisma.inventoryBalance.aggregate({
      where: { organizationId },
      _sum: {
        availableQty: true,
        reservedQty: true,
        damagedQty: true,
        inTransitQty: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      totalRecords: balances._count.id,
      availableQty: balances._sum.availableQty ?? 0,
      reservedQty: balances._sum.reservedQty ?? 0,
      damagedQty: balances._sum.damagedQty ?? 0,
      inTransitQty: balances._sum.inTransitQty ?? 0,
    };
  }

  // ==========================================
  // 6. GET INVENTORY MOVEMENTS
  // ==========================================

  async getMovements(organizationId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { organizationId },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            name: true,
            code: true,
          },
        },
        location: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }
}
