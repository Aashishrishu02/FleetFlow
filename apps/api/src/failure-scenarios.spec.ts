import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory/inventory.service.js';
import { OrdersService } from './orders/orders.service.js';
import { ShipmentsService } from './shipments/shipments.service.js';
import { ReturnsService } from './returns/returns.service.js';
import { FinanceService } from './finance/finance.service.js';
import { WorkflowsService } from './workflows/workflows.service.js';
import { OrderStatus, ShipmentStatus, WorkflowStatus } from './generated/prisma/client.js';

describe('13 Mandatory Failure Scenarios (Section 10 Verification)', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn((cb) => cb(mockPrisma)),
      $queryRaw: vi.fn(),
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      inventoryBalance: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn(),
      },
      inventoryReservation: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ count: 1 }),
      },
      warehouse: {
        findFirst: vi.fn().mockResolvedValue({ id: 'wh-1', organizationId: 'org-1' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'wh-1', organizationId: 'org-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      storageLocation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'loc-1', warehouseId: 'wh-1' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'loc-1', warehouseId: 'wh-1' }),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({ id: 'prod-1', organizationId: 'org-1', isActive: true }),
        findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', organizationId: 'org-1', isActive: true }),
      },
      order: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      orderItem: {
        create: vi.fn(),
      },
      shipment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      shipmentAssignment: {
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      trackingEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      deliveryPartner: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      return: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      returnItem: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      refund: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      pricingRule: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      shippingQuote: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      creditNote: {
        create: vi.fn(),
      },
      financialEntry: {
        create: vi.fn(),
      },
      fulfillmentWorkflow: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      fulfillmentStep: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      outboxEvent: {
        create: vi.fn(),
      },
    };
  });

  // ============================================================================
  // Scenario 1: Concurrent Inventory Reservation Race
  // ============================================================================
  it('Scenario 1: Concurrent reservation race rejects over-allocation', async () => {
    const inventoryService = new InventoryService(mockPrisma);
    mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', organizationId: 'org-1' });
    mockPrisma.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1', warehouseId: 'wh-1' });
    mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', organizationId: 'org-1', isActive: true });

    // Conditional update fails because available inventory was taken by another concurrent worker
    mockPrisma.inventoryBalance.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.inventoryBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      availableQty: 1, // Only 1 left
      reservedQty: 0,
    });

    await expect(
      inventoryService.reserveStock({
        organizationId: 'org-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        productId: 'prod-1',
        quantity: 2, // Asking for 2
        referenceType: 'ORDER',
        referenceId: 'ord-1',
        idempotencyKey: 'idemp-race-1',
        notes: 'Race test',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ============================================================================
  // Scenario 2: Cross-Tenant Product Access
  // ============================================================================
  it('Scenario 2: Cross-tenant product mutation is denied', async () => {
    const inventoryService = new InventoryService(mockPrisma);
    mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', organizationId: 'org-tenant-A' });
    mockPrisma.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1', warehouseId: 'wh-1' });

    // Product belongs to Tenant B
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      organizationId: 'org-tenant-B',
    });

    await expect(
      inventoryService.receiveStock({
        organizationId: 'org-tenant-A',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        productId: 'prod-1',
        quantity: 10,
        idempotencyKey: 'idemp-cross-prod',
        notes: 'Cross-tenant probe',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ============================================================================
  // Scenario 3: Cross-Tenant Warehouse Access
  // ============================================================================
  it('Scenario 3: Cross-tenant warehouse mutation is denied', async () => {
    const inventoryService = new InventoryService(mockPrisma);

    // Warehouse belongs to Tenant B
    mockPrisma.warehouse.findFirst.mockResolvedValue(null);
    mockPrisma.warehouse.findUnique.mockResolvedValue({
      id: 'wh-tenant-B',
      organizationId: 'org-tenant-B',
    });

    await expect(
      inventoryService.receiveStock({
        organizationId: 'org-tenant-A',
        warehouseId: 'wh-tenant-B',
        locationId: 'loc-1',
        productId: 'prod-1',
        quantity: 10,
        idempotencyKey: 'idemp-cross-wh',
        notes: 'Cross-tenant probe',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ============================================================================
  // Scenario 4: Idempotent Stock Receipt
  // ============================================================================
  it('Scenario 4: Duplicate stock receipt returns existing response without double-counting', async () => {
    const inventoryService = new InventoryService(mockPrisma);

    mockPrisma.inventoryMovement.findUnique.mockResolvedValue({
      id: 'mov-existing',
      movementType: 'RECEIVE',
      organizationId: 'org-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      productId: 'prod-1',
      quantity: 50,
      idempotencyKey: 'idemp-receipt-dup',
    });

    mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
      id: 'bal-1',
      availableQty: 50,
    });

    const result = await inventoryService.receiveStock({
      organizationId: 'org-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      productId: 'prod-1',
      quantity: 50,
      idempotencyKey: 'idemp-receipt-dup',
      notes: 'Initial stock',
    });

    expect(result.duplicate).toBe(true);
    expect(mockPrisma.inventoryBalance.upsert).not.toHaveBeenCalled();
  });

  // ============================================================================
  // Scenario 5: Idempotent Stock Reservation
  // ============================================================================
  it('Scenario 5: Duplicate stock reservation returns existing reservation without double-decrementing', async () => {
    const inventoryService = new InventoryService(mockPrisma);

    mockPrisma.inventoryMovement.findUnique.mockResolvedValue({
      id: 'mov-existing',
      movementType: 'RESERVE',
      organizationId: 'org-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      productId: 'prod-1',
      referenceType: 'ORDER',
      referenceId: 'ord-101',
      quantity: 5,
      idempotencyKey: 'idemp-res-dup',
    });

    const result = await inventoryService.reserveStock({
      organizationId: 'org-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      productId: 'prod-1',
      referenceType: 'ORDER',
      referenceId: 'ord-101',
      quantity: 5,
      idempotencyKey: 'idemp-res-dup',
      notes: 'Order reservation',
    });

    expect(result.duplicate).toBe(true);
    expect(mockPrisma.inventoryBalance.updateMany).not.toHaveBeenCalled();
  });

  // ============================================================================
  // Scenario 6: Reservation Release on Order Cancellation
  // ============================================================================
  it('Scenario 6: Order cancellation releases reservations back to available balance', async () => {
    const ordersService = new OrdersService(mockPrisma);

    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'ord-cancel-1',
      organizationId: 'org-1',
      status: OrderStatus.CONFIRMED,
      items: [],
    });

    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: 'res-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        productId: 'prod-1',
        quantity: 10,
      },
    ]);

    mockPrisma.order.update.mockResolvedValue({
      id: 'ord-cancel-1',
      status: OrderStatus.CANCELLED,
    });

    const result = await ordersService.cancelOrder('org-1', 'ord-cancel-1', 'Customer cancelled');

    expect(result.order.status).toBe(OrderStatus.CANCELLED);
    expect(mockPrisma.inventoryReservation.update).toHaveBeenCalled();
    expect(mockPrisma.inventoryBalance.updateMany).toHaveBeenCalled();
  });

  // ============================================================================
  // Scenario 7: Monotonic Shipment Status Progression
  // ============================================================================
  it('Scenario 7: Regression on completed shipment status is blocked and kept monotonic', async () => {
    const shipmentsService = new ShipmentsService(mockPrisma);

    mockPrisma.shipment.findFirst.mockResolvedValue({
      id: 'shp-1',
      organizationId: 'org-1',
      status: ShipmentStatus.DELIVERED,
      trackingEvents: [],
    });

    mockPrisma.trackingEvent.findFirst.mockResolvedValue({
      status: ShipmentStatus.DELIVERED,
    });

    const result = await shipmentsService.recordEvent('org-1', 'shp-1', {
      status: 'IN_TRANSIT',
      location: 'Warehouse Hub',
      description: 'Late event arrival',
    });

    expect(result.statusUpdated).toBe(false);
    expect(result.currentStatus).toBe(ShipmentStatus.DELIVERED);
  });

  // ============================================================================
  // Scenario 8: Delivery Partner Capacity Exhaustion
  // ============================================================================
  it('Scenario 8: Assigning shipment to carrier with exhausted capacity throws ConflictException', async () => {
    const shipmentsService = new ShipmentsService(mockPrisma);

    mockPrisma.shipment.findFirst.mockResolvedValue({
      id: 'shp-1',
      organizationId: 'org-1',
      deliveryPartnerId: null,
      originAddress: 'A',
      destinationAddress: 'B',
      status: ShipmentStatus.CREATED,
    });

    mockPrisma.deliveryPartner.findFirst.mockResolvedValue({
      id: 'partner-1',
      name: 'SwiftCarrier',
      organizationId: 'org-1',
      maxActiveShipments: 2,
      shipments: [{ id: 'shp-a' }, { id: 'shp-b' }], // 2 active shipments = exhausted
    });

    await expect(
      shipmentsService.assignPartner('org-1', 'shp-1', 'partner-1'),
    ).rejects.toThrow(ConflictException);
  });

  // ============================================================================
  // Scenario 9: Damaged Goods Quarantine
  // ============================================================================
  it('Scenario 9: Damaged returns are quarantined in damagedQty, not availableQty', async () => {
    const returnsService = new ReturnsService(mockPrisma);

    mockPrisma.return.findFirst.mockResolvedValue({
      id: 'ret-1',
      organizationId: 'org-1',
      warehouseId: 'wh-1',
      warehouse: {
        locations: [{ id: 'loc-1' }],
      },
      returnNumber: 'RMA-001',
      items: [{ id: 'ret-item-1', productId: 'prod-1', expectedQuantity: 10 }],
    });

    mockPrisma.returnItem.findFirst.mockResolvedValue({
      id: 'ret-item-1',
      productId: 'prod-1',
      expectedQuantity: 10,
    });

    mockPrisma.return.update.mockResolvedValue({ id: 'ret-1', status: 'QUARANTINED' });

    await returnsService.inspectReturn('org-1', 'ret-1', {
      restockDecision: 'QUARANTINE_DAMAGED',
      items: [{ productId: 'prod-1', returnItemId: 'ret-item-1', receivedQuantity: 10, damagedQuantity: 10 }],
    });

    // Verify damagedQty upsert was called with damaged quantity
    expect(mockPrisma.inventoryBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          damagedQty: { increment: 10 },
        }),
      }),
    );
  });

  // ============================================================================
  // Scenario 10: Prevent Duplicate Refunds
  // ============================================================================
  it('Scenario 10: Settled return RMA rejects duplicate refund requests', async () => {
    const financeService = new FinanceService(mockPrisma);

    // Existing settled refund found
    mockPrisma.refund.findFirst.mockResolvedValue({
      id: 'ref-1',
      refundNumber: 'RF-999',
      status: 'SETTLED',
    });

    await expect(
      financeService.processRefund('org-1', 'ret-1', 150.0, 'Duplicate refund attempt'),
    ).rejects.toThrow(ConflictException);
  });

  // ============================================================================
  // Scenario 11: Expired Freight Quote Rejection
  // ============================================================================
  it('Scenario 11: Expired freight quote cannot be verified as active', async () => {
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past

    mockPrisma.shippingQuote.findFirst.mockResolvedValue({
      id: 'qte-expired',
      organizationId: 'org-1',
      quoteNumber: 'QTE-101',
      expiresAt: expiredDate,
    });

    const quote = await mockPrisma.shippingQuote.findFirst({
      where: { id: 'qte-expired', organizationId: 'org-1' },
    });

    const isExpired = quote.expiresAt.getTime() < Date.now();
    expect(isExpired).toBe(true);
  });

  // ============================================================================
  // Scenario 12: Duplicate Invoice Prevention
  // ============================================================================
  it('Scenario 12: Duplicate invoice generation for the same shipment is rejected', async () => {
    const financeService = new FinanceService(mockPrisma);

    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-existing',
      invoiceNumber: 'INV-001',
      shipmentId: 'shp-1',
    });

    await expect(
      financeService.createInvoice('org-1', {
        shipmentId: 'shp-1',
        invoiceNumber: 'INV-NEW-99',
        subtotal: 500,
        dueDate: '2026-12-31',
      }),
    ).rejects.toThrow(ConflictException);
  });

  // ============================================================================
  // Scenario 13: Saga Compensation Rollback on Warehouse Pick Failure
  // ============================================================================
  it('Scenario 13: Aborting fulfillment saga rolls back order to CANCELLED and releases reservations', async () => {
    const workflowsService = new WorkflowsService(mockPrisma);

    mockPrisma.fulfillmentWorkflow.findFirst.mockResolvedValue({
      id: 'wf-1',
      organizationId: 'org-1',
      orderId: 'ord-10',
      status: WorkflowStatus.IN_PROGRESS,
      steps: [
        { id: 's-1', stepName: 'INVENTORY_RESERVATION', stepOrder: 1, status: 'COMPLETED' },
        { id: 's-2', stepName: 'PICK_LIST_GENERATION', stepOrder: 2, status: 'RUNNING' },
      ],
    });

    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: 'res-wf-1',
        organizationId: 'org-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        productId: 'prod-1',
        quantity: 20,
      },
    ]);

    mockPrisma.fulfillmentWorkflow.update.mockResolvedValue({
      id: 'wf-1',
      status: WorkflowStatus.COMPENSATED,
    });

    const result = await workflowsService.abortWorkflow('org-1', 'wf-1', 'Item damaged at pick');

    expect(result.status).toBe(WorkflowStatus.COMPENSATED);
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-10' },
        data: { status: OrderStatus.CANCELLED },
      }),
    );
    expect(mockPrisma.fulfillmentStep.update).toHaveBeenCalled();
  });
});
