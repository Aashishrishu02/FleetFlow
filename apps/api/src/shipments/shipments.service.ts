import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { RecordEventDto } from './dto/record-event.dto.js';
import { QueryShipmentsDto } from './dto/query-shipments.dto.js';
import { ShipmentStatus, OrderStatus } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

const LIFECYCLE_RANK: Record<ShipmentStatus, number> = {
  [ShipmentStatus.CREATED]: 0,
  [ShipmentStatus.READY_FOR_PICKUP]: 1,
  [ShipmentStatus.PICKED_UP]: 2,
  [ShipmentStatus.IN_TRANSIT]: 3,
  [ShipmentStatus.OUT_FOR_DELIVERY]: 4,
  [ShipmentStatus.DELIVERED]: 5,
  [ShipmentStatus.DELIVERY_FAILED]: 4,
  [ShipmentStatus.RETURN_INITIATED]: 5,
  [ShipmentStatus.RETURN_IN_TRANSIT]: 6,
  [ShipmentStatus.RETURNED]: 7,
  [ShipmentStatus.CANCELLED]: 8,
};

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. CREATE SHIPMENT (Scoped to Confirmed Order)
  // ============================================================================
  async createShipment(organizationId: string, dto: CreateShipmentDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Shipment must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: dto.orderId, organizationId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const validStatuses: OrderStatus[] = [
        OrderStatus.CONFIRMED,
        OrderStatus.ALLOCATING_INVENTORY,
        OrderStatus.PARTIALLY_FULFILLED,
      ];
      if (!validStatuses.includes(order.status)) {
        throw new BadRequestException(`Cannot create shipment for order in status ${order.status}`);
      }

      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId, isActive: true },
      });

      if (!warehouse) {
        throw new NotFoundException('Warehouse not found or inactive');
      }

      const trackingNumber =
        dto.trackingNumber || `SHP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      const shipment = await tx.shipment.create({
        data: {
          organizationId,
          orderId: order.id,
          warehouseId: warehouse.id,
          deliveryPartnerId: dto.deliveryPartnerId,
          trackingNumber,
          status: ShipmentStatus.CREATED,
          originCity: dto.originCity,
          destinationCity: dto.destinationCity,
          destinationAddress: dto.destinationAddress,
          destinationPostalCode: dto.destinationPostalCode,
          totalWeightKg: dto.totalWeightKg ? new Prisma.Decimal(dto.totalWeightKg) : new Prisma.Decimal(2.5),
          packageCount: dto.packageCount || 1,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          deliveryPartner: true,
        },
      });

      // Record initial tracking event
      await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: ShipmentStatus.CREATED,
          location: `${warehouse.city || warehouse.name} Facility`,
          notes: 'Shipment created and package manifest generated',
          source: 'system',
        },
      });

      // Update Order fulfilled quantities
      for (const item of dto.items) {
        await tx.orderItem.updateMany({
          where: { orderId: order.id, productId: item.productId },
          data: { fulfilledQuantity: { increment: item.quantity } },
        });
      }

      // Check if order is partially or fully fulfilled
      const updatedOrderItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });

      const allFulfilled = updatedOrderItems.every((i) => i.fulfilledQuantity >= i.quantity);
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: allFulfilled ? OrderStatus.FULFILLED : OrderStatus.PARTIALLY_FULFILLED,
        },
      });

      // Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'SHIPMENT',
          aggregateId: shipment.id,
          eventType: 'shipment.created',
          payload: {
            shipmentId: shipment.id,
            trackingNumber: shipment.trackingNumber,
            orderId: order.id,
            originCity: shipment.originCity,
            destinationCity: shipment.destinationCity,
          },
        },
      });

      return shipment;
    });
  }

  // ============================================================================
  // 2. ASSIGN DELIVERY PARTNER & VEHICLE (Race-Free Row-Level Locking)
  // ============================================================================
  async assignPartner(
    organizationId: string,
    shipmentId: string,
    partnerId: string,
    vehicleId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Row-level lock on shipment
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, organizationId },
      });

      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }

      if (
        shipment.status === ShipmentStatus.DELIVERED ||
        shipment.status === ShipmentStatus.CANCELLED ||
        shipment.status === ShipmentStatus.RETURNED
      ) {
        throw new BadRequestException(`Cannot assign partner to shipment in status ${shipment.status}`);
      }

      const partner = await tx.deliveryPartner.findFirst({
        where: { id: partnerId, organizationId, status: 'ACTIVE' },
        include: {
          shipments: {
            where: {
              status: { in: [ShipmentStatus.READY_FOR_PICKUP, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY] },
            },
          },
        },
      });

      if (!partner) {
        throw new NotFoundException('Delivery partner not found or not active');
      }

      // Enforce active shipment capacity limits
      if (partner.shipments.length >= partner.maxActiveShipments) {
        throw new ConflictException(`Delivery partner ${partner.name} has exceeded active capacity limit (${partner.maxActiveShipments} shipments)`);
      }

      // Check vehicle capacity if assigned
      if (vehicleId) {
        const vehicle = await tx.vehicle.findFirst({
          where: { id: vehicleId, deliveryPartnerId: partner.id, status: 'AVAILABLE' },
        });
        if (!vehicle) {
          throw new ConflictException('Selected vehicle is not available or assigned to another carrier route');
        }

        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { status: 'ASSIGNED' },
        });
      }

      const updatedShipment = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          deliveryPartnerId: partner.id,
          status: ShipmentStatus.READY_FOR_PICKUP,
        },
        include: { deliveryPartner: true },
      });

      await tx.shipmentAssignment.create({
        data: {
          shipmentId: shipment.id,
          vehicleId,
        },
      });

      await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: ShipmentStatus.READY_FOR_PICKUP,
          location: shipment.originCity,
          notes: `Carrier ${partner.name} (${partner.code}) assigned for transport`,
          source: 'dispatch-coordinator',
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'SHIPMENT',
          aggregateId: shipment.id,
          eventType: 'shipment.assigned',
          payload: {
            shipmentId: shipment.id,
            partnerId: partner.id,
            partnerName: partner.name,
            vehicleId,
          },
        },
      });

      return updatedShipment;
    });
  }

  // ============================================================================
  // 3. RECORD TRACKING EVENT (Monotonic Progression & Late Event Safety)
  // ============================================================================
  async recordEvent(organizationId: string, shipmentId: string, dto: RecordEventDto) {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, organizationId },
      });

      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }

      // Record immutable tracking checkpoint
      const trackingEvent = await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: dto.eventType,
          location: dto.location,
          notes: dto.notes,
          source: dto.source || 'system',
          timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        },
      });

      // Monotonicity Check (Mandatory Failure Scenario #7):
      // Late events must NOT move a shipment backward!
      const currentRank = LIFECYCLE_RANK[shipment.status] ?? 0;
      const eventRank = LIFECYCLE_RANK[dto.eventType] ?? 0;

      let statusUpdated = false;
      let newStatus = shipment.status;

      if (eventRank >= currentRank) {
        // Normal forward progression
        newStatus = dto.eventType;
        statusUpdated = true;

        const updateData: Prisma.ShipmentUpdateInput = {
          status: newStatus,
        };

        if (newStatus === ShipmentStatus.DELIVERED) {
          updateData.deliveredAt = new Date();
        } else if (newStatus === ShipmentStatus.DELIVERY_FAILED) {
          updateData.failureReason = dto.notes || 'Delivery attempt failed';
        }

        await tx.shipment.update({
          where: { id: shipment.id },
          data: updateData,
        });

        // Write outbox event
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SHIPMENT',
            aggregateId: shipment.id,
            eventType: `shipment.${newStatus.toLowerCase()}`,
            payload: {
              shipmentId: shipment.id,
              trackingNumber: shipment.trackingNumber,
              newStatus,
              location: dto.location,
            },
          },
        });
      }

      return {
        message: statusUpdated
          ? `Tracking event recorded; status progressed to ${newStatus}`
          : `Late tracking event recorded in historical telemetry; shipment status kept at ${shipment.status} (cannot move backward)`,
        statusUpdated,
        currentStatus: statusUpdated ? newStatus : shipment.status,
        trackingEvent,
      };
    });
  }

  // ============================================================================
  // 4. UPLOAD PROOF OF DELIVERY
  // ============================================================================
  async uploadProofOfDelivery(organizationId: string, shipmentId: string, proofUrl: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: { proofOfDeliveryUrl: proofUrl },
    });

    await this.prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: shipment.status,
        location: shipment.destinationCity,
        notes: `Proof of delivery uploaded: ${proofUrl}`,
        source: 'delivery-partner-app',
      },
    });

    return updated;
  }

  // ============================================================================
  // 5. QUERY SHIPMENTS
  // ============================================================================
  async findAll(organizationId: string, query: QueryShipmentsDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ShipmentWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { trackingNumber: { contains: query.search, mode: 'insensitive' } },
              { originCity: { contains: query.search, mode: 'insensitive' } },
              { destinationCity: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          deliveryPartner: { select: { id: true, name: true, code: true, onTimeRate: true } },
          items: { include: { product: true } },
          _count: { select: { trackingEvents: true } },
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      data: shipments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // 6. GET SHIPMENT DETAILS
  // ============================================================================
  async findOne(organizationId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, organizationId },
      include: {
        order: true,
        warehouse: true,
        deliveryPartner: true,
        items: { include: { product: true } },
        trackingEvents: { orderBy: { timestamp: 'desc' } },
        assignments: { include: { vehicle: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  // ============================================================================
  // 7. GET TRACKING TELEMETRY HISTORY
  // ============================================================================
  async getTrackingHistory(organizationId: string, id: string) {
    const shipment = await this.findOne(organizationId, id);
    return {
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      originCity: shipment.originCity,
      destinationCity: shipment.destinationCity,
      carrier: shipment.deliveryPartner?.name || 'Unassigned',
      events: shipment.trackingEvents,
    };
  }

  // ============================================================================
  // 8. DELETE SHIPMENT (Admin / Dispatcher privilege)
  // ============================================================================
  async deleteShipment(organizationId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, organizationId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException('Cannot delete a successfully delivered shipment consignment.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.trackingEvent.deleteMany({ where: { shipmentId: id } });
      await tx.shipmentAssignment.deleteMany({ where: { shipmentId: id } });
      await tx.shipmentItem.deleteMany({ where: { shipmentId: id } });
      await tx.shipment.delete({ where: { id } });
    });

    return { success: true, message: `Shipment ${shipment.trackingNumber} deleted successfully` };
  }
}
