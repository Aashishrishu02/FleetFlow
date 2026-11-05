import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReturnDto } from './dto/create-return.dto.js';
import { InspectReturnDto } from './dto/inspect-return.dto.js';
import { ReturnStatus, RestockDecision } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. CREATE RETURN (RMA Generation)
  // ============================================================================
  async createReturn(organizationId: string, dto: CreateReturnDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Return must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: dto.orderId, organizationId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId, isActive: true },
      });

      if (!warehouse) {
        throw new NotFoundException('Receiving warehouse not found or inactive');
      }

      const returnNumber = dto.returnNumber || `RMA-${Date.now().toString().slice(-6)}-US`;

      const returnRma = await tx.return.create({
        data: {
          organizationId,
          orderId: order.id,
          warehouseId: warehouse.id,
          returnNumber,
          status: ReturnStatus.REQUESTED,
          reason: dto.reason,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              expectedQuantity: item.expectedQuantity,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          order: true,
        },
      });

      // Write Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'RETURN',
          aggregateId: returnRma.id,
          eventType: 'return.created',
          payload: {
            returnId: returnRma.id,
            returnNumber: returnRma.returnNumber,
            orderId: order.id,
          },
        },
      });

      return returnRma;
    });
  }

  // ============================================================================
  // 2. INSPECT RETURN (Restock vs Damaged Quarantine - Mandatory Failure Scenario #9)
  // ============================================================================
  async inspectReturn(organizationId: string, returnId: string, dto: InspectReturnDto) {
    return this.prisma.$transaction(async (tx) => {
      const returnRma = await tx.return.findFirst({
        where: { id: returnId, organizationId },
        include: { items: true, warehouse: { include: { locations: true } } },
      });

      if (!returnRma) {
        throw new NotFoundException('Return record not found');
      }

      if (returnRma.status === ReturnStatus.CLOSED || returnRma.status === ReturnStatus.RESTOCKED) {
        throw new BadRequestException(`Cannot inspect return already in status ${returnRma.status}`);
      }

      const location = returnRma.warehouse.locations[0];
      if (!location) {
        throw new BadRequestException('Warehouse has no storage locations configured for return processing');
      }

      let totalRefundAmount = dto.refundAmount
        ? new Prisma.Decimal(dto.refundAmount)
        : new Prisma.Decimal(0);

      // Process each inspected item line
      for (const inspectedItem of dto.items) {
        const itemLine = returnRma.items.find((i) => i.productId === inspectedItem.productId);
        if (!itemLine) continue;

        const undamagedQty = Math.max(
          0,
          inspectedItem.receivedQuantity - inspectedItem.damagedQuantity,
        );

        // Update return line item
        await tx.returnItem.update({
          where: { id: itemLine.id },
          data: {
            receivedQuantity: inspectedItem.receivedQuantity,
            damagedQuantity: inspectedItem.damagedQuantity,
            isRestocked: dto.restockDecision === RestockDecision.RESTOCK_AVAILABLE && undamagedQty > 0,
          },
        });

        // 1. Damaged Stock Quarantine: MUST NOT become available stock!
        if (inspectedItem.damagedQuantity > 0) {
          await tx.inventoryBalance.upsert({
            where: {
              warehouseId_locationId_productId: {
                warehouseId: returnRma.warehouseId,
                locationId: location.id,
                productId: inspectedItem.productId,
              },
            },
            create: {
              organizationId,
              warehouseId: returnRma.warehouseId,
              locationId: location.id,
              productId: inspectedItem.productId,
              availableQty: 0,
              damagedQty: inspectedItem.damagedQuantity,
            },
            update: {
              damagedQty: { increment: inspectedItem.damagedQuantity },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              organizationId,
              warehouseId: returnRma.warehouseId,
              locationId: location.id,
              productId: inspectedItem.productId,
              movementType: 'DAMAGE',
              quantity: inspectedItem.damagedQuantity,
              referenceType: 'RETURN_INSPECTION_DAMAGED',
              referenceId: returnRma.id,
              idempotencyKey: `rma-damage-${returnRma.id}-${inspectedItem.productId}-${Date.now()}`,
              notes: `Quarantined damaged returned stock for RMA ${returnRma.returnNumber}`,
            },
          });
        }

        // 2. Undamaged Restocking: ONLY approved undamaged items can become available inventory!
        if (dto.restockDecision === RestockDecision.RESTOCK_AVAILABLE && undamagedQty > 0) {
          await tx.inventoryBalance.upsert({
            where: {
              warehouseId_locationId_productId: {
                warehouseId: returnRma.warehouseId,
                locationId: location.id,
                productId: inspectedItem.productId,
              },
            },
            create: {
              organizationId,
              warehouseId: returnRma.warehouseId,
              locationId: location.id,
              productId: inspectedItem.productId,
              availableQty: undamagedQty,
              damagedQty: 0,
            },
            update: {
              availableQty: { increment: undamagedQty },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              organizationId,
              warehouseId: returnRma.warehouseId,
              locationId: location.id,
              productId: inspectedItem.productId,
              movementType: 'RESTOCK',
              quantity: undamagedQty,
              referenceType: 'RETURN_RESTOCK',
              referenceId: returnRma.id,
              idempotencyKey: `rma-restock-${returnRma.id}-${inspectedItem.productId}-${Date.now()}`,
              notes: `Restocked undamaged returned stock for RMA ${returnRma.returnNumber}`,
            },
          });
        }
      }

      // Update Return Record
      const updatedReturn = await tx.return.update({
        where: { id: returnRma.id },
        data: {
          status:
            dto.restockDecision === RestockDecision.RESTOCK_AVAILABLE
              ? ReturnStatus.RESTOCKED
              : ReturnStatus.INSPECTED,
          restockDecision: dto.restockDecision,
          refundAmount: totalRefundAmount,
          discrepancyNotes: dto.discrepancyNotes,
          inspectedAt: new Date(),
        },
        include: { items: { include: { product: true } } },
      });

      // Issue refund record if refund approved
      if (totalRefundAmount.gt(0)) {
        await tx.refund.create({
          data: {
            organizationId,
            returnId: returnRma.id,
            refundNumber: `RF-${Date.now().toString().slice(-6)}`,
            amount: totalRefundAmount,
            status: 'APPROVED',
            reason: `Refund for inspected RMA ${returnRma.returnNumber}`,
          },
        });
      }

      // Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'RETURN',
          aggregateId: returnRma.id,
          eventType: 'return.inspected',
          payload: {
            returnId: returnRma.id,
            returnNumber: returnRma.returnNumber,
            restockDecision: dto.restockDecision,
            refundAmount: totalRefundAmount.toNumber(),
          },
        },
      });

      return {
        message: 'Return inspection completed successfully and inventory ledger updated',
        return: updatedReturn,
      };
    });
  }

  // ============================================================================
  // 3. LIST ALL RETURNS
  // ============================================================================
  async findAll(organizationId: string) {
    return this.prisma.return.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNumber: true, customerName: true } },
        items: { include: { product: true } },
        refunds: true,
      },
    });
  }

  // ============================================================================
  // 4. GET RETURN DETAILS
  // ============================================================================
  async findOne(organizationId: string, id: string) {
    const returnRma = await this.prisma.return.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: true,
        order: true,
        items: { include: { product: true } },
        refunds: true,
      },
    });

    if (!returnRma) {
      throw new NotFoundException('Return record not found');
    }

    return returnRma;
  }

  // ============================================================================
  // 5. DELETE RETURN RECORD (Admin privilege)
  // ============================================================================
  async deleteReturn(organizationId: string, id: string) {
    const returnRma = await this.prisma.return.findFirst({
      where: { id, organizationId },
    });

    if (!returnRma) {
      throw new NotFoundException('Return record not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.deleteMany({ where: { returnId: id } });
      await tx.returnItem.deleteMany({ where: { returnId: id } });
      await tx.return.delete({ where: { id } });
    });

    return { success: true, message: `Return RMA ${returnRma.returnNumber} deleted successfully` };
  }
}

