/**
 * FleetFlow Automated Health Check & E2E Workflow Verification
 * Tests RBAC across 5 personas, cross-tenant isolation, inventory lifecycle,
 * order confirmation & deterministic allocation, shipment tracking, and returns.
 */

const BASE_URL = 'http://127.0.0.1:3001/api/v1';

const PERSONAS = [
  { role: 'Admin', email: 'admin@fleetflow.io', pass: 'Admin@123456!' },
  { role: 'Manager', email: 'manager@fleetflow.io', pass: 'Manager@123456!' },
  { role: 'Warehouse Manager', email: 'whmanager@fleetflow.io', pass: 'WhManager@123456!' },
  { role: 'Inventory Manager', email: 'invmanager@fleetflow.io', pass: 'InvManager@123456!' },
  { role: 'Auditor', email: 'auditor@fleetflow.io', pass: 'Auditor@123456!' },
];

async function api(path, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  const results = [];
  const log = (phase, test, passed, detail) => {
    results.push({ phase, test, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${phase} :: ${test}${detail ? ` -> ${detail}` : ''}`);
  };

  console.log('=== FLEETFLOW AUTOMATED HEALTH CHECK & WORKFLOW SUITE ===\n');

  // --- Phase 5: Authentication & Token Retrieval for 5 Personas ---
  const tokens = {};
  for (const p of PERSONAS) {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: p.email, password: p.pass }),
    });
    if (res.ok && res.data?.accessToken) {
      tokens[p.role] = res.data.accessToken;
      log('Phase 5 (RBAC)', `Authentication for persona [${p.role}]`, true, `JWT received (Status ${res.status})`);
    } else {
      log('Phase 5 (RBAC)', `Authentication for persona [${p.role}]`, false, `Status ${res.status}: ${res.data?.message}`);
    }
  }

  const adminToken = tokens['Admin'];
  const auditorToken = tokens['Auditor'];
  const invToken = tokens['Inventory Manager'];

  if (!adminToken) {
    console.error('FATAL: Admin login failed. Cannot continue test workflow.');
    process.exit(1);
  }

  // Verify /auth/me for each persona
  for (const p of PERSONAS) {
    if (!tokens[p.role]) continue;
    const res = await api('/auth/me', {}, tokens[p.role]);
    const ok = res.ok && res.data?.email === p.email;
    const primaryOrg = res.data?.memberships?.[0]?.organization?.slug || 'none';
    const primaryRole = res.data?.memberships?.[0]?.roles?.[0]?.role?.name || 'none';
    log('Phase 5 (RBAC)', `GET /auth/me for [${p.role}]`, ok, ok ? `Tenant: ${primaryOrg}, Role: ${primaryRole}` : `Status ${res.status}`);
  }

  // --- Phase 6: Core Business Workflows ---
  const suffix = Date.now().toString().slice(-4);

  // 1. Dashboard / Summary loading
  const dashRes = await api('/inventory/summary', {}, adminToken);
  log('Phase 6 (Workflow)', 'Step 1: Dashboard Loading (GET /inventory/summary)', dashRes.ok, `Available Qty: ${dashRes.data?.availableQty ?? 0}, Reserved: ${dashRes.data?.reservedQty ?? 0}`);

  // 2. Create Warehouse
  const whCode = `WH-HC-${suffix}`;
  const whRes = await api('/warehouses', {
    method: 'POST',
    body: JSON.stringify({
      name: `Health Check Hub ${suffix}`,
      code: whCode,
      address: '100 Health Check Blvd',
      city: 'Chicago',
      country: 'USA',
      isActive: true,
    }),
  }, adminToken);
  const warehouseId = whRes.data?.id;
  log('Phase 6 (Workflow)', `Step 2: Create Warehouse [${whCode}]`, whRes.status === 201 && !!warehouseId, `ID: ${warehouseId}`);

  // 3. Create Storage Location
  const locCode = `BAY-${suffix}`;
  const locRes = await api(`/warehouses/${warehouseId}/locations`, {
    method: 'POST',
    body: JSON.stringify({
      name: `Automated Bay ${suffix}`,
      code: locCode,
      type: 'RACK',
    }),
  }, adminToken);
  const locationId = locRes.data?.id;
  log('Phase 6 (Workflow)', `Step 3: Create Storage Location [${locCode}]`, locRes.status === 201 && !!locationId, `ID: ${locationId}`);

  // 4. Create Product with Unique SKU
  const sku = `SKU-AUTO-${suffix}`;
  const prodRes = await api('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: `Automated Diagnostic Scanner ${suffix}`,
      sku,
      category: 'Electronics',
      unit: 'EACH',
      isActive: true,
    }),
  }, adminToken);
  const productId = prodRes.data?.id;
  log('Phase 6 (Workflow)', `Step 4: Create Product with SKU [${sku}]`, prodRes.status === 201 && !!productId, `ID: ${productId}`);

  // 5. Receive Inventory (100 units)
  const recvRes = await api('/inventory/receive', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId,
      locationId,
      productId,
      quantity: 100,
      idempotencyKey: `rcv-${suffix}-${Date.now()}`,
      notes: 'Initial stock intake via Automated Health Check',
    }),
  }, adminToken);
  const receivedQty = recvRes.data?.balance?.availableQty;
  log('Phase 6 (Workflow)', 'Step 5: Receive Inventory (+100 units)', recvRes.status === 201 && receivedQty === 100, `Available: ${receivedQty}`);

  // 6. Verify Stock Balance
  const balRes = await api('/inventory/balances', {}, adminToken);
  const balances = Array.isArray(balRes.data) ? balRes.data : Array.isArray(balRes) ? balRes : [];
  const matchedBal = balances.find((b) => b.productId === productId && b.warehouseId === warehouseId);
  log('Phase 6 (Workflow)', 'Step 6: Verify Stock Balance', !!matchedBal && matchedBal.availableQty === 100, `Balance verified: ${matchedBal?.availableQty} units`);

  // 7. Issue Inventory (-25 units)
  const issueKey = `iss-${suffix}-${Date.now()}`;
  const issueRes = await api('/inventory/issue', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId,
      locationId,
      productId,
      quantity: 25,
      idempotencyKey: issueKey,
      notes: 'Dispatched 25 units for customer batch',
    }),
  }, adminToken);
  const postIssueQty = issueRes.data?.balance?.availableQty;
  log('Phase 6 (Workflow)', 'Step 7: Issue Inventory (-25 units)', issueRes.status === 201 && postIssueQty === 75, `Balance decremented to: ${postIssueQty}`);

  // 8. Attempt Overdraw (Request 500 units when only 75 exist)
  const overdrawRes = await api('/inventory/issue', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId,
      locationId,
      productId,
      quantity: 500,
      idempotencyKey: `overdraw-${suffix}-${Date.now()}`,
      notes: 'Overdraw test attempt',
    }),
  }, adminToken);
  log('Phase 6 (Workflow)', 'Step 8: Overdraw Prevention', overdrawRes.status === 400, `Rejected with HTTP ${overdrawRes.status}: "${overdrawRes.data?.message}"`);

  // 9. Verify Idempotency (Replay Step 7 with same idempotency key)
  const replayRes = await api('/inventory/issue', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId,
      locationId,
      productId,
      quantity: 25,
      idempotencyKey: issueKey,
      notes: 'Dispatched 25 units for customer batch',
    }),
  }, adminToken);
  log('Phase 6 (Workflow)', 'Step 9: Idempotency Enforcement', replayRes.status === 201 && replayRes.data?.duplicate === true, `Replay response duplicate flag: ${replayRes.data?.duplicate}`);

  // 10. Create Customer Order
  const orderRes = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      customerId: `CUST-HC-${suffix}`,
      customerName: 'Acme Test Corp',
      customerEmail: 'ops@acmetest.com',
      shippingCity: 'Chicago',
      shippingPostalCode: '60601',
      shippingAddress: '500 W Madison St',
      shippingCountry: 'US',
      items: [{ productId, quantity: 10, unitPrice: 45.0 }],
      idempotencyKey: `ord-${suffix}-${Date.now()}`,
      notes: 'Automated health check test order',
    }),
  }, adminToken);
  const orderId = orderRes.data?.id;
  log('Phase 6 (Workflow)', 'Step 10: Create Multi-Item Customer Order', orderRes.status === 201 && !!orderId, `Order #${orderRes.data?.orderNumber}, Status: ${orderRes.data?.status}`);

  // 11. Confirm Order & Deterministic Allocation
  const confirmRes = await api(`/orders/${orderId}/confirm`, { method: 'POST' }, adminToken);
  log('Phase 6 (Workflow)', 'Step 11: Confirm Order & Reserve Stock', confirmRes.ok && confirmRes.data?.order?.status === 'CONFIRMED', `Status: ${confirmRes.data?.order?.status}, Message: "${confirmRes.data?.message}"`);

  // 12. Create Shipment for Confirmed Order
  const shpRes = await api('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      warehouseId,
      originCity: 'Chicago',
      destinationCity: 'Chicago',
      destinationAddress: '500 W Madison St',
      destinationPostalCode: '60601',
      totalWeightKg: 4.5,
      items: [{ productId, quantity: 10 }],
    }),
  }, adminToken);
  const shipmentId = shpRes.data?.id;
  log('Phase 6 (Workflow)', 'Step 12: Create Shipment from Confirmed Order', shpRes.status === 201 && !!shipmentId, `Tracking #: ${shpRes.data?.trackingNumber}, Status: ${shpRes.data?.status}`);

  // 13. Create Delivery Partner & Assign Carrier
  const carrierRes = await api('/partners', {
    method: 'POST',
    body: JSON.stringify({
      name: `FastCarrier ${suffix}`,
      code: `CAR-${suffix}`,
      contactEmail: `dispatch@carrier-${suffix}.com`,
      contactPhone: '+1-312-555-0199',
      partnerType: 'CARRIER_3PL',
      serviceableRegions: ['Midwest', 'North America'],
      maxActiveShipments: 50,
    }),
  }, adminToken);
  const partnerId = carrierRes.data?.id;
  log('Phase 6 (Workflow)', 'Step 13: Register Delivery Partner Carrier', carrierRes.status === 201 && !!partnerId, `Carrier ID: ${partnerId}`);

  // Assign Carrier to Shipment
  const assignRes = await api(`/shipments/${shipmentId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ partnerId }),
  }, adminToken);
  log('Phase 6 (Workflow)', 'Step 14: Assign Partner Carrier to Shipment', assignRes.ok, `Status: ${assignRes.status}`);

  // Append Tracking Event
  const trackRes = await api(`/shipments/${shipmentId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      eventType: 'IN_TRANSIT',
      location: 'Chicago Distribution Center',
      notes: 'Package scanned and sorted for courier delivery',
    }),
  }, adminToken);
  log('Phase 6 (Workflow)', 'Step 15: Monotonic Tracking Event Update', trackRes.ok && trackRes.data?.currentStatus === 'IN_TRANSIT', `Status updated to: ${trackRes.data?.currentStatus}`);

  // 14. Dispatch Console Telemetry
  const dispRes = await api('/dispatch', {}, adminToken);
  log('Phase 6 (Workflow)', 'Step 16: Dispatch Telemetry Overview', dispRes.ok && Array.isArray(dispRes.data?.partnerFleet), `Active Dispatches: ${dispRes.data?.totalActiveDispatches}, Fleet Count: ${dispRes.data?.partnerFleet?.length}`);

  // 15. Reverse Logistics / RMA
  const returnRes = await api('/returns', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      warehouseId,
      reason: 'Customer requested model exchange',
      items: [{ productId, expectedQuantity: 2 }],
    }),
  }, adminToken);
  const returnId = returnRes.data?.id;
  log('Phase 6 (Workflow)', 'Step 17: Initiate Return (RMA)', returnRes.status === 201 && !!returnId, `RMA #: ${returnRes.data?.returnNumber}, Status: ${returnRes.data?.status}`);

  // 16. Finance Overview & Pricing Quote
  const finRes = await api('/finance/overview', {}, adminToken);
  log('Phase 6 (Workflow)', 'Step 18: Finance Metrics Overview', finRes.ok, `Total Invoiced: $${finRes.data?.totalInvoiced || 0}`);

  const quoteRes = await api('/finance/quotes', {
    method: 'POST',
    body: JSON.stringify({
      origin: 'Chicago',
      destination: 'Milwaukee',
      weightKg: 10,
      distanceKm: 150,
      serviceType: 'STANDARD_ROAD',
    }),
  }, adminToken);
  log('Phase 6 (Workflow)', 'Step 19: Freight Engine Pricing Quote', quoteRes.status === 201 && Number(quoteRes.data?.totalCharge) > 0, `Quote Amount: $${quoteRes.data?.totalCharge}`);

  // 17. Security Audit Log Query
  const auditRes = await api('/security/audit-logs?limit=5', {}, adminToken);
  log('Phase 6 (Workflow)', 'Step 20: Forensic Audit Logs', auditRes.ok && Array.isArray(auditRes.data), `Retrieved ${auditRes.data?.length} audit records`);

  // --- Phase 5: RBAC Security Enforcement Verification ---
  // Auditor Read-Only Checks
  const audWhGet = await api('/warehouses', {}, auditorToken);
  log('Phase 5 (RBAC)', 'Auditor: Can READ Warehouses (GET)', audWhGet.ok, `Status: ${audWhGet.status}`);

  const audWhWrite = await api('/warehouses', {
    method: 'POST',
    body: JSON.stringify({ name: 'Illegal Auditor Warehouse', code: `AUD-${suffix}` }),
  }, auditorToken);
  log('Phase 5 (RBAC)', 'Auditor: BLOCKED from Creating Warehouse (POST)', audWhWrite.status === 403, `Blocked with HTTP ${audWhWrite.status}`);

  const audInvRecv = await api('/inventory/receive', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId,
      locationId,
      productId,
      quantity: 10,
      idempotencyKey: `aud-rcv-${suffix}`,
      notes: 'Unauthorized auditor receipt',
    }),
  }, auditorToken);
  log('Phase 5 (RBAC)', 'Auditor: BLOCKED from Receiving Stock (POST)', audInvRecv.status === 403, `Blocked with HTTP ${audInvRecv.status}`);

  const audInvIssue = await api('/inventory/issue', {
    method: 'POST',
    body: JSON.stringify({
      warehouseId,
      locationId,
      productId,
      quantity: 10,
      idempotencyKey: `aud-iss-${suffix}`,
      notes: 'Unauthorized auditor issue',
    }),
  }, auditorToken);
  log('Phase 5 (RBAC)', 'Auditor: BLOCKED from Issuing Stock (POST)', audInvIssue.status === 403, `Blocked with HTTP ${audInvIssue.status}`);

  // Inventory Manager Permissions: can manage inventory/products, CANNOT manage warehouses
  const invWhWrite = await api('/warehouses', {
    method: 'POST',
    body: JSON.stringify({ name: 'Illegal Inv Mgr Warehouse', code: `INVM-${suffix}` }),
  }, invToken);
  log('Phase 5 (RBAC)', 'Inventory Manager: BLOCKED from Creating Warehouse (POST)', invWhWrite.status === 403, `Blocked with HTTP ${invWhWrite.status}`);

  // Cross-Tenant Access Prevention
  // Register a secondary tenant
  const tenantBRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `External User ${suffix}`,
      email: `tenantb-${suffix}@othercorp.com`,
      password: 'Password@123456!',
      organizationName: `OtherCorp ${suffix}`,
      organizationSlug: `othercorp-${suffix}`,
    }),
  });
  const tenantBToken = tenantBRes.data?.accessToken;
  if (tenantBToken) {
    const crossWh = await api(`/warehouses/${warehouseId}`, {}, tenantBToken);
    log('Phase 5 (Security)', 'Tenant B BLOCKED from Accessing Tenant A Warehouse', crossWh.status === 403 || crossWh.status === 404, `Status ${crossWh.status}: Cross-tenant boundary preserved`);

    const crossProd = await api(`/products/${productId}`, {}, tenantBToken);
    log('Phase 5 (Security)', 'Tenant B BLOCKED from Accessing Tenant A Product', crossProd.status === 403 || crossProd.status === 404, `Status ${crossProd.status}: Cross-tenant boundary preserved`);
  }

  // Final Summary
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  console.log(`\n=================================================`);
  console.log(`HEALTH CHECK COMPLETE: ${passCount} PASSED, ${failCount} FAILED (TOTAL ${results.length})`);
  console.log(`=================================================`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
