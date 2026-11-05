import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { QueryOrdersDto } from './dto/query-orders.dto.js';
import { OrderStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. CREATE ORDER (With Idempotency)
  // ============================================================================
  async createOrder(organizationId: string, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: { include: { product: true } } },
      });
      if (existing) {
        if (existing.organizationId !== organizationId) {
          throw new ConflictException('Idempotency key belongs to another tenant');
        }
        return existing;
      }
    }

    // Verify all products belong to this tenant and are active
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        organizationId,
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive in organization');
    }

    const orderNumber = dto.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

    // Calculate total amount
    let totalAmount = new Prisma.Decimal(0);
    const itemRecords = dto.items.map((item) => {
      const price = item.unitPrice ? new Prisma.Decimal(item.unitPrice) : new Prisma.Decimal(50.0);
      const lineTotal = price.mul(item.quantity);
      totalAmount = totalAmount.add(lineTotal);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: price,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          organizationId,
          orderNumber,
          customerId: dto.customerId,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          status: OrderStatus.CREATED,
          shippingCity: dto.shippingCity,
          shippingPostalCode: dto.shippingPostalCode,
          shippingAddress: dto.shippingAddress,
          shippingCountry: dto.shippingCountry || 'US',
          totalAmount,
          currency: dto.currency || 'USD',
          idempotencyKey: dto.idempotencyKey,
          notes: dto.notes,
          items: {
            create: itemRecords,
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
        },
      });

      // Write Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'order.created',
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            organizationId,
            customerId: order.customerId,
            totalAmount: order.totalAmount.toNumber(),
          },
        },
      });

      return order;
    });
  }

  // ============================================================================
  // 2. CONFIRM & ALLOCATE ORDER (Deterministic Scoring & Race-Free Reservation)
  // ============================================================================
  async confirmOrder(organizationId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, organizationId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.CREATED) {
        throw new BadRequestException(`Order cannot be confirmed from status ${order.status}`);
      }

      // Fetch organization settings for allocation weights
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId },
      });

      const distanceWeight = settings?.distanceWeight ? Number(settings.distanceWeight) : 0.40;
      const costWeight = settings?.costWeight ? Number(settings.costWeight) : 0.40;
      const splitWeight = settings?.splitWeight ? Number(settings.splitWeight) : 0.20;

      // Find active warehouses for this organization
      const warehouses = await tx.warehouse.findMany({
        where: { organizationId, isActive: true },
        include: {
          inventoryBalances: {
            where: {
              productId: { in: order.items.map((i) => i.productId) },
            },
          },
        },
      });

      if (warehouses.length === 0) {
        throw new BadRequestException('No active warehouses available for order allocation');
      }

      // Evaluate stock availability per warehouse and calculate deterministic allocation score
      // allocation_score = distance_weight * normalized_distance + cost_weight * normalized_shipping_cost + split_weight * additional_shipment_penalty
      let selectedWarehouse = warehouses[0];
      let bestScore = 999999;
      let canFulfillEntireOrder = false;

      for (const wh of warehouses) {
        let hasAllStock = true;
        for (const item of order.items) {
          const balance = wh.inventoryBalances.find((b) => b.productId === item.productId);
          if (!balance || balance.availableQty < item.quantity) {
            hasAllStock = false;
            break;
          }
        }

        // Simulating deterministic distance & shipping cost based on city match
        const isLocal = wh.city?.toLowerCase() === order.shippingCity.toLowerCase();
        const normalizedDistance = isLocal ? 0.1 : 0.8;
        const normalizedShippingCost = isLocal ? 0.15 : 0.75;
        const additionalShipmentPenalty = hasAllStock ? 0 : 1.0;

        const score =
          distanceWeight * normalizedDistance +
          costWeight * normalizedShippingCost +
          splitWeight * additionalShipmentPenalty;

        if (hasAllStock && score < bestScore) {
          bestScore = score;
          selectedWarehouse = wh;
          canFulfillEntireOrder = true;
        }
      }

      if (!canFulfillEntireOrder) {
        // Fallback: check if first warehouse has partial stock or throw
        throw new BadRequestException('Insufficient inventory across active fulfillment hubs to satisfy order items');
      }

      // Race-Free Row-Level Locking on InventoryBalances
      // Atomically decrement availableQty, increment reservedQty, and create InventoryReservation
      for (const item of order.items) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            warehouseId: selectedWarehouse.id,
            productId: item.productId,
          },
        });

        if (!balance || balance.availableQty < item.quantity) {
          throw new ConflictException(`Concurrent stock depletion for product ${item.productId}`);
        }

        const updateResult = await tx.inventoryBalance.updateMany({
          where: {
            id: balance.id,
            availableQty: { gte: item.quantity },
          },
          data: {
            availableQty: { decrement: item.quantity },
            reservedQty: { increment: item.quantity },
          },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException('Concurrent stock reservation race condition detected');
        }

        // Create reservation record
        await tx.inventoryReservation.create({
          data: {
            organizationId,
            warehouseId: selectedWarehouse.id,
            locationId: balance.locationId,
            productId: item.productId,
            referenceType: 'ORDER',
            referenceId: order.id,
            quantity: item.quantity,
            status: ReservationStatus.ACTIVE,
          },
        });

        // Append to immutable movement ledger
        await tx.inventoryMovement.create({
          data: {
            organizationId,
            warehouseId: selectedWarehouse.id,
            locationId: balance.locationId,
            productId: item.productId,
            movementType: 'RESERVE',
            quantity: item.quantity,
            referenceType: 'ORDER',
            referenceId: order.id,
            idempotencyKey: `order-reserve-${order.id}-${item.productId}-${Date.now()}`,
            notes: `Reserved for Order ${order.orderNumber}`,
          },
        });
      }

      // Update Order Status
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          allocationScore: new Prisma.Decimal(bestScore),
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      // Write Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'order.confirmed',
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            allocatedWarehouseId: selectedWarehouse.id,
            allocationScore: bestScore,
          },
        },
      });

      return {
        message: 'Order confirmed and inventory allocated successfully',
        allocatedWarehouse: {
          id: selectedWarehouse.id,
          name: selectedWarehouse.name,
          code: selectedWarehouse.code,
        },
        allocationScore: bestScore,
        order: updatedOrder,
      };
    });
  }

  // ============================================================================
  // 3. CANCEL ORDER (With Compensating Inventory Release)
  // ============================================================================
  async cancelOrder(organizationId: string, orderId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, organizationId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
        throw new BadRequestException(`Cannot cancel order in status ${order.status}`);
      }

      // Find all active reservations for this order
      const reservations = await tx.inventoryReservation.findMany({
        where: {
          organizationId,
          referenceType: 'ORDER',
          referenceId: order.id,
          status: ReservationStatus.ACTIVE,
        },
      });

      // Compensating action: release all reservations back to available stock
      for (const res of reservations) {
        await tx.inventoryBalance.updateMany({
          where: {
            warehouseId: res.warehouseId,
            locationId: res.locationId,
            productId: res.productId,
            reservedQty: { gte: res.quantity },
          },
          data: {
            availableQty: { increment: res.quantity },
            reservedQty: { decrement: res.quantity },
          },
        });

        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: ReservationStatus.RELEASED },
        });

        await tx.inventoryMovement.create({
          data: {
            organizationId,
            warehouseId: res.warehouseId,
            locationId: res.locationId,
            productId: res.productId,
            movementType: 'RELEASE',
            quantity: res.quantity,
            referenceType: 'ORDER_CANCELLED',
            referenceId: order.id,
            idempotencyKey: `cancel-release-${order.id}-${res.id}-${Date.now()}`,
            notes: `Compensating release for cancelled Order ${order.orderNumber}: ${reason || 'Customer cancellation'}`,
          },
        });
      }

      const cancelledOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: reason ? `${order.notes || ''} [Cancelled: ${reason}]`.trim() : order.notes,
        },
      });

      // Write Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'order.cancelled',
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            releasedReservationsCount: reservations.length,
          },
        },
      });

      return {
        message: 'Order cancelled and allocated inventory successfully released',
        order: cancelledOrder,
      };
    });
  }

  // ============================================================================
  // 4. QUERY ORDERS (Paginated with search and status filter)
  // ============================================================================
  async findAll(organizationId: string, query: QueryOrdersDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { customerId: { contains: query.search, mode: 'insensitive' } },
              { customerName: { contains: query.search, mode: 'insensitive' } },
              { shippingCity: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
          shipments: {
            select: { id: true, trackingNumber: true, status: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // 5. GET ORDER BY ID
  // ============================================================================
  async findOne(organizationId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shipments: {
          include: {
            deliveryPartner: true,
            trackingEvents: { orderBy: { timestamp: 'desc' } },
          },
        },
        returns: true,
        workflows: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  // ============================================================================
  // 6. GET ORDER FULFILLMENT STATUS
  // ============================================================================
  async getFulfillmentStatus(organizationId: string, id: string) {
    const order = await this.findOne(organizationId, id);

    const totalOrdered = order.items.reduce((acc, i) => acc + i.quantity, 0);
    const totalFulfilled = order.items.reduce((acc, i) => acc + i.fulfilledQuantity, 0);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalOrderedUnits: totalOrdered,
      totalFulfilledUnits: totalFulfilled,
      isFullyFulfilled: totalFulfilled >= totalOrdered && totalOrdered > 0,
      activeShipmentsCount: order.shipments.filter(
        (s) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(s.status),
      ).length,
      shipments: order.shipments.map((s) => ({
        id: s.id,
        trackingNumber: s.trackingNumber,
        status: s.status,
        deliveredAt: s.deliveredAt,
      })),
    };
  }

  // ============================================================================
  // 7. DELETE ORDER (Admin / Owner privilege)
  // ============================================================================
  async deleteOrder(organizationId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: { shipments: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.ALLOCATING_INVENTORY) {
      throw new BadRequestException('Cannot delete an order with active stock reservations. Please cancel the order first.');
    }

    if (order.shipments && order.shipments.length > 0) {
      throw new BadRequestException('Cannot delete an order with attached shipments.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });

    return { success: true, message: `Order ${order.orderNumber} deleted successfully` };
  }
}
