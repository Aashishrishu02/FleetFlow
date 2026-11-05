import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderStatus, ReservationStatus, StepStatus, WorkflowStatus } from '../generated/prisma/client.js';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. INITIATE SAGA WORKFLOW FOR ORDER
  // ============================================================================
  async startFulfillmentWorkflow(organizationId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, organizationId },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        throw new NotFoundException(`Order '${orderId}' not found`);
      }

      // Check if an active workflow already exists for this order
      const existing = await tx.fulfillmentWorkflow.findFirst({
        where: { organizationId, orderId, status: WorkflowStatus.IN_PROGRESS },
      });

      if (existing) {
        return existing;
      }

      const workflow = await tx.fulfillmentWorkflow.create({
        data: {
          organizationId,
          orderId,
          workflowType: 'STANDARD_FULFILLMENT',
          status: WorkflowStatus.IN_PROGRESS,
          currentStep: 'INVENTORY_RESERVATION',
        },
      });

      // Initialize sequential saga steps
      const stepsDefinitions = [
        { name: 'INVENTORY_RESERVATION', order: 1 },
        { name: 'WAREHOUSE_ALLOCATION', order: 2 },
        { name: 'PICK_LIST_GENERATION', order: 3 },
        { name: 'PACK_VERIFICATION', order: 4 },
        { name: 'DISPATCH_CARRIER_ASSIGNMENT', order: 5 },
        { name: 'MONOTONIC_TRANSIT_TRACKING', order: 6 },
        { name: 'POD_FINAL_SETTLEMENT', order: 7 },
      ];

      for (const step of stepsDefinitions) {
        await tx.fulfillmentStep.create({
          data: {
            workflowId: workflow.id,
            stepName: step.name,
            stepOrder: step.order,
            status: step.order === 1 ? StepStatus.RUNNING : StepStatus.PENDING,
            executedAt: step.order === 1 ? new Date() : null,
          },
        });
      }

      // Step 1: Inventory Check & Soft Reservation
      let inventoryAvailable = true;
      for (const item of order.items) {
        const balance = await tx.inventoryBalance.findFirst({
          where: { organizationId, productId: item.productId },
        });

        const available = balance ? balance.availableQty : 0;
        if (available < item.quantity) {
          inventoryAvailable = false;
          break;
        }
      }

      const step1 = await tx.fulfillmentStep.findFirst({
        where: { workflowId: workflow.id, stepOrder: 1 },
      });

      if (!inventoryAvailable) {
        // Step 1 fails -> execute compensation
        if (step1) {
          await tx.fulfillmentStep.update({
            where: { id: step1.id },
            data: {
              status: StepStatus.FAILED,
              error: 'Insufficient available inventory across tenant warehouses',
              executedAt: new Date(),
            },
          });
        }

        await tx.fulfillmentWorkflow.update({
          where: { id: workflow.id },
          data: {
            status: WorkflowStatus.FAILED,
            failureReason: 'Inventory allocation failed: insufficient on-hand stock',
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED },
        });

        return workflow;
      }

      // Step 1 Complete
      if (step1) {
        await tx.fulfillmentStep.update({
          where: { id: step1.id },
          data: {
            status: StepStatus.COMPLETED,
            result: { reservationVerified: true },
            executedAt: new Date(),
          },
        });
      }

      // Step 2 Complete
      const step2 = await tx.fulfillmentStep.findFirst({
        where: { workflowId: workflow.id, stepOrder: 2 },
      });
      if (step2) {
        await tx.fulfillmentStep.update({
          where: { id: step2.id },
          data: {
            status: StepStatus.COMPLETED,
            executedAt: new Date(),
            result: {
              warehouseAllocated: 'PRIMARY_FACILITY',
              destination: order.shippingCity,
            },
          },
        });
      }

      // Step 3 In Progress
      const step3 = await tx.fulfillmentStep.findFirst({
        where: { workflowId: workflow.id, stepOrder: 3 },
      });
      if (step3) {
        await tx.fulfillmentStep.update({
          where: { id: step3.id },
          data: {
            status: StepStatus.RUNNING,
            executedAt: new Date(),
          },
        });
      }

      await tx.fulfillmentWorkflow.update({
        where: { id: workflow.id },
        data: { currentStep: 'PICK_LIST_GENERATION' },
      });

      return tx.fulfillmentWorkflow.findUnique({
        where: { id: workflow.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });
  }

  // ============================================================================
  // 2. LIST WORKFLOWS
  // ============================================================================
  async getWorkflows(organizationId: string, orderId?: string) {
    return this.prisma.fulfillmentWorkflow.findMany({
      where: {
        organizationId,
        ...(orderId ? { orderId } : {}),
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            totalAmount: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================================================
  // 3. GET SINGLE WORKFLOW
  // ============================================================================
  async getWorkflow(organizationId: string, id: string) {
    const workflow = await this.prisma.fulfillmentWorkflow.findFirst({
      where: { id, organizationId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        order: {
          include: {
            items: { include: { product: true } },
            shipments: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Fulfillment workflow '${id}' not found`);
    }

    return workflow;
  }

  // ============================================================================
  // 4. RETRY / ADVANCE WORKFLOW STEP
  // ============================================================================
  async advanceWorkflowStep(
    organizationId: string,
    workflowId: string,
    stepId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.fulfillmentWorkflow.findFirst({
        where: { id: workflowId, organizationId },
      });

      if (!workflow) {
        throw new NotFoundException('Workflow not found');
      }

      const step = await tx.fulfillmentStep.findFirst({
        where: { id: stepId, workflowId },
      });

      if (!step) {
        throw new NotFoundException('Workflow step not found');
      }

      // Mark current step completed
      await tx.fulfillmentStep.update({
        where: { id: step.id },
        data: {
          status: StepStatus.COMPLETED,
          executedAt: new Date(),
        },
      });

      // Find next step
      const nextStep = await tx.fulfillmentStep.findFirst({
        where: { workflowId, stepOrder: step.stepOrder + 1 },
      });

      if (nextStep) {
        await tx.fulfillmentStep.update({
          where: { id: nextStep.id },
          data: {
            status: StepStatus.RUNNING,
            executedAt: new Date(),
          },
        });

        await tx.fulfillmentWorkflow.update({
          where: { id: workflowId },
          data: { currentStep: nextStep.stepName },
        });
      } else {
        // All steps completed!
        await tx.fulfillmentWorkflow.update({
          where: { id: workflowId },
          data: {
            status: WorkflowStatus.COMPLETED,
            currentStep: 'COMPLETED',
          },
        });

        // Mark order fulfilled
        await tx.order.update({
          where: { id: workflow.orderId },
          data: { status: OrderStatus.COMPLETED },
        });
      }

      return tx.fulfillmentWorkflow.findUnique({
        where: { id: workflowId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });
  }

  // ============================================================================
  // 5. ABORT / COMPENSATE WORKFLOW (Saga Rollback)
  // ============================================================================
  async abortWorkflow(
    organizationId: string,
    workflowId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.fulfillmentWorkflow.findFirst({
        where: { id: workflowId, organizationId },
        include: { steps: true, order: true },
      });

      if (!workflow) {
        throw new NotFoundException('Workflow not found');
      }

      if (workflow.status === WorkflowStatus.COMPLETED) {
        throw new BadRequestException('Cannot abort an already completed workflow');
      }

      // Compensate completed steps in reverse order
      const completedSteps = workflow.steps
        .filter((s) => s.status === StepStatus.COMPLETED || s.status === StepStatus.RUNNING)
        .sort((a, b) => b.stepOrder - a.stepOrder);

      for (const step of completedSteps) {
        await tx.fulfillmentStep.update({
          where: { id: step.id },
          data: {
            status: StepStatus.COMPENSATED,
            error: `Compensated due to workflow abort: ${reason}`,
          },
        });
      }

      // Release reserved order items if any
      const reservations = await tx.inventoryReservation.findMany({
        where: {
          organizationId,
          referenceType: 'ORDER',
          referenceId: workflow.orderId,
          status: ReservationStatus.ACTIVE,
        },
      });

      for (const res of reservations) {
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: ReservationStatus.RELEASED },
        });

        await tx.inventoryBalance.updateMany({
          where: {
            organizationId,
            warehouseId: res.warehouseId,
            locationId: res.locationId,
            productId: res.productId,
          },
          data: {
            reservedQty: { decrement: res.quantity },
            availableQty: { increment: res.quantity },
          },
        });
      }

      await tx.order.update({
        where: { id: workflow.orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      return tx.fulfillmentWorkflow.update({
        where: { id: workflowId },
        data: {
          status: WorkflowStatus.COMPENSATED,
          failureReason: reason,
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });
  }
}
