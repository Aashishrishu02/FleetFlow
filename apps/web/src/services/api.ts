/**
 * FleetFlow Centralized API Client
 * Single source of truth for all backend communications.
 * Strictly communicates with live NestJS endpoints without mock fallbacks.
 */

const rawEnvUrl = (import.meta.env.VITE_API_URL || '').trim();
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = (
  isLocalhost && (!rawEnvUrl || rawEnvUrl.includes('onrender.com'))
    ? 'http://localhost:3001/api/v1'
    : (rawEnvUrl || 'http://localhost:3001/api/v1')
).replace(/\/$/, '');
export const TOKEN_STORAGE_KEY = 'fleetflow_auth_token';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorDetails?: any;

  constructor(
    statusCode: number,
    message: string,
    errorDetails?: any,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;
  }
}

// Global 401 listener so components/contexts can automatically logout
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setStoredToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

/**
 * Low-level HTTP request dispatcher with authentication and centralized error handling
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(401, 'Session expired or unauthorized. Please sign in again.');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || `HTTP ${response.status}: Request failed`;
    throw new ApiError(response.status, errorMsg, data);
  }

  return data as T;
}

// --- API Service Methods ---

export const apiClient = {
  // Authentication
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (payload: {
      name: string;
      email: string;
      password: string;
      organizationName: string;
      organizationSlug?: string;
    }) =>
      request<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getMe: () => request<any>('/auth/me'),
  },

  // Warehouses & Locations
  warehouses: {
    findAll: (query?: { search?: string; isActive?: boolean }) => {
      const params = new URLSearchParams();
      if (query?.search?.trim()) params.append('search', query.search.trim());
      if (query?.isActive !== undefined) params.append('isActive', String(query.isActive));
      const q = params.toString();
      return request<any[]>(`/warehouses${q ? `?${q}` : ''}`);
    },
    findOne: (id: string) => request<any>(`/warehouses/${id}`),
    create: (data: {
      name: string;
      code: string;
      address?: string | null;
      city?: string | null;
      country?: string | null;
      isActive?: boolean;
    }) =>
      request<any>('/warehouses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        code?: string;
        address?: string | null;
        city?: string | null;
        country?: string | null;
        isActive?: boolean;
      },
    ) =>
      request<any>(`/warehouses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, isActive: boolean) =>
      request<any>(`/warehouses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    delete: (id: string) =>
      request<any>(`/warehouses/${id}`, {
        method: 'DELETE',
      }),
    findAllLocations: (warehouseId: string) =>
      request<any[]>(`/warehouses/${warehouseId}/locations`),
    createLocation: (
      warehouseId: string,
      data: { name: string; code: string; type?: string },
    ) =>
      request<any>(`/warehouses/${warehouseId}/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateLocation: (
      warehouseId: string,
      locationId: string,
      data: { name?: string; code?: string; type?: string },
    ) =>
      request<any>(`/warehouses/${warehouseId}/locations/${locationId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteLocation: (warehouseId: string, locationId: string) =>
      request<any>(`/warehouses/${warehouseId}/locations/${locationId}`, {
        method: 'DELETE',
      }),
  },

  // Products
  products: {
    findAll: (query?: { search?: string; isActive?: boolean }) => {
      const params = new URLSearchParams();
      if (query?.search?.trim()) params.append('search', query.search.trim());
      if (query?.isActive !== undefined) params.append('isActive', String(query.isActive));
      const q = params.toString();
      return request<any[]>(`/products${q ? `?${q}` : ''}`);
    },
    findOne: (id: string) => request<any>(`/products/${id}`),
    create: (data: {
      name: string;
      sku: string;
      description?: string | null;
      category?: string | null;
      unit?: string;
      isActive?: boolean;
    }) =>
      request<any>('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        sku?: string;
        description?: string | null;
        category?: string | null;
        unit?: string;
        isActive?: boolean;
      },
    ) =>
      request<any>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, isActive: boolean) =>
      request<any>(`/products/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    delete: (id: string) =>
      request<any>(`/products/${id}`, {
        method: 'DELETE',
      }),
  },

  // Inventory
  inventory: {
    getSummary: () => request<any>('/inventory/summary'),
    getBalances: () => request<any[]>('/inventory/balances'),
    getMovements: () => request<any[]>('/inventory/movements'),
    receiveStock: (data: {
      warehouseId: string;
      locationId: string;
      productId: string;
      quantity: number;
      idempotencyKey: string;
      notes: string;
    }) =>
      request<any>('/inventory/receive', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    issueStock: (data: {
      warehouseId: string;
      locationId: string;
      productId: string;
      quantity: number;
      idempotencyKey: string;
      notes?: string;
    }) =>
      request<any>('/inventory/issue', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    reserveStock: (data: {
      warehouseId: string;
      locationId: string;
      productId: string;
      referenceType: string;
      referenceId: string;
      quantity: number;
      idempotencyKey: string;
      notes: string;
    }) =>
      request<any>('/inventory/reserve', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    releaseStock: (data: {
      warehouseId: string;
      locationId: string;
      productId: string;
      reservationId: string;
      idempotencyKey: string;
      notes: string;
    }) =>
      request<any>('/inventory/release', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    adjustStock: (data: {
      warehouseId: string;
      locationId: string;
      productId: string;
      quantity: number;
      reason: 'RECONCILIATION' | 'DAMAGE';
      notes?: string;
      idempotencyKey: string;
    }) =>
      request<any>('/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    transferStock: (data: {
      fromWarehouseId: string;
      fromLocationId: string;
      toWarehouseId: string;
      toLocationId: string;
      productId: string;
      quantity: number;
      idempotencyKey: string;
    }) =>
      request<any>('/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Orders
  orders: {
    findAll: (query?: { status?: string; search?: string }) => {
      const params = new URLSearchParams();
      if (query?.status) params.append('status', query.status);
      if (query?.search?.trim()) params.append('search', query.search.trim());
      const q = params.toString();
      return request<any[]>(`/orders${q ? `?${q}` : ''}`);
    },
    findOne: (id: string) => request<any>(`/orders/${id}`),
    create: (data: {
      customerId: string;
      customerName?: string;
      customerEmail?: string;
      shippingCity: string;
      shippingPostalCode: string;
      shippingAddress?: string;
      shippingCountry?: string;
      notes?: string;
      idempotencyKey?: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    }) =>
      request<any>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    confirm: (id: string) =>
      request<any>(`/orders/${id}/confirm`, {
        method: 'POST',
      }),
    cancel: (id: string, reason?: string) =>
      request<any>(`/orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    delete: (id: string) =>
      request<any>(`/orders/${id}`, {
        method: 'DELETE',
      }),
  },

  // Shipments & Dispatch
  shipments: {
    findAll: (query?: { status?: string; search?: string }) => {
      const params = new URLSearchParams();
      if (query?.status) params.append('status', query.status);
      if (query?.search?.trim()) params.append('search', query.search.trim());
      const q = params.toString();
      return request<any[]>(`/shipments${q ? `?${q}` : ''}`);
    },
    findOne: (id: string) => request<any>(`/shipments/${id}`),
    create: (data: {
      orderId: string;
      warehouseId: string;
      deliveryPartnerId?: string;
      originAddress: string;
      destinationAddress: string;
      estimatedDelivery?: string;
      trackingNumber?: string;
      items: Array<{ productId: string; quantity: number }>;
    }) =>
      request<any>('/shipments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    recordEvent: (id: string, data: { status: string; location: string; description: string; eventTimestamp?: string }) =>
      request<any>(`/shipments/${id}/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadPod: (id: string, data: { podRecipientName: string; podSignatureUrl: string; proofUrl?: string }) =>
      request<any>(`/shipments/${id}/proof-of-delivery`, {
        method: 'POST',
        body: JSON.stringify({ proofUrl: data.proofUrl || data.podSignatureUrl || data.podRecipientName }),
      }),
    delete: (id: string) =>
      request<any>(`/shipments/${id}`, {
        method: 'DELETE',
      }),
  },

  // Delivery Partners & Dispatch Console
  partners: {
    findAll: () => request<any[]>('/partners'),
    create: (data: {
      name: string;
      code: string;
      contactEmail: string;
      contactPhone?: string;
      serviceType: string;
      contractedRatePerKm: number;
      activeCapacity: number;
    }) =>
      request<any>('/partners', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createVehicle: (partnerId: string, data: { licensePlate: string; vehicleType: string; capacityKg: number }) =>
      request<any>(`/partners/${partnerId}/vehicles`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getDispatchOverview: () => request<any>('/dispatch'),
    assignShipment: (data: { shipmentId: string; deliveryPartnerId: string; vehicleId?: string; idempotencyKey?: string }) =>
      request<any>(`/shipments/${data.shipmentId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ partnerId: data.deliveryPartnerId, vehicleId: data.vehicleId }),
      }),
    delete: (id: string) =>
      request<any>(`/partners/${id}`, {
        method: 'DELETE',
      }),
    update: (id: string, data: any) =>
      request<any>(`/partners/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteVehicle: (partnerId: string, vehicleId: string) =>
      request<any>(`/partners/${partnerId}/vehicles/${vehicleId}`, {
        method: 'DELETE',
      }),
  },

  // Returns & Reverse Logistics
  returns: {
    findAll: (query?: { status?: string }) => {
      const q = query?.status ? `?status=${query.status}` : '';
      return request<any[]>(`/returns${q}`);
    },
    findOne: (id: string) => request<any>(`/returns/${id}`),
    create: (data: {
      orderId: string;
      warehouseId: string;
      reason: string;
      items: Array<{ productId: string; expectedQuantity: number }>;
    }) =>
      request<any>('/returns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    inspect: (id: string, data: {
      restockDecision: string;
      discrepancyNotes?: string;
      locationId?: string;
      items: Array<{ returnItemId: string; receivedQuantity: number; damagedQuantity: number }>;
    }) =>
      request<any>(`/returns/${id}/inspect`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<any>(`/returns/${id}`, {
        method: 'DELETE',
      }),
  },

  // Finance & Pricing Engine
  finance: {
    getOverview: () => request<any>('/finance/overview'),
    getPricingRules: () => request<any[]>('/finance/pricing-rules'),
    createPricingRule: (data: any) =>
      request<any>('/finance/pricing-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deletePricingRule: (id: string) =>
      request<any>(`/finance/pricing-rules/${id}`, {
        method: 'DELETE',
      }),
    updatePricingRule: (id: string, data: any) =>
      request<any>(`/finance/pricing-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getQuotes: () => request<any[]>('/finance/quotes'),
    generateQuote: (data: {
      origin: string;
      destination: string;
      weightKg: number;
      distanceKm: number;
      serviceType: string;
      discount?: number;
    }) =>
      request<any>('/finance/quotes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getInvoices: () => request<any[]>('/finance/invoices'),
    createInvoice: (data: {
      shipmentId?: string;
      invoiceNumber?: string;
      subtotal: number;
      taxAmount?: number;
      dueDate: string;
      currency?: string;
    }) =>
      request<any>('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createCreditNote: (invoiceId: string, data: { amount: number; reason: string }) =>
      request<any>(`/finance/invoices/${invoiceId}/credit-notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getCreditNotes: () => request<any[]>('/finance/credit-notes'),
    getRefunds: () => request<any[]>('/finance/refunds'),
    processRefund: (data: { returnId: string; amount: number; reason: string }) =>
      request<any>('/finance/refunds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getPayables: () => request<any[]>('/finance/payables'),
    getReconciliation: () => request<any>('/finance/reconciliation'),
  },

  // Workflows & Sagas
  workflows: {
    findAll: (orderId?: string) => {
      const q = orderId ? `?orderId=${orderId}` : '';
      return request<any[]>(`/workflows${q}`);
    },
    findOne: (id: string) => request<any>(`/workflows/${id}`),
    start: (orderId: string) =>
      request<any>('/workflows/start', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      }),
    advance: (id: string, stepId: string) =>
      request<any>(`/workflows/${id}/advance`, {
        method: 'POST',
        body: JSON.stringify({ stepId }),
      }),
    abort: (id: string, reason: string) =>
      request<any>(`/workflows/${id}/abort`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  // Organizations & Settings
  organizations: {
    getCurrent: () => request<any>('/organizations/current'),
    updateSettings: (data: {
      defaultCurrency?: string;
      operatingTimezone?: string;
      autoAllocationEnabled?: boolean;
      reorderAlertThreshold?: number;
      distanceWeight?: number;
      costWeight?: number;
      splitWeight?: number;
    }) =>
      request<any>('/organizations/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getMembers: () => request<any[]>('/organizations/members'),
    inviteMember: (data: { email: string; name: string; roleName: string }) =>
      request<any>('/organizations/members', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateMemberRole: (membershipId: string, roleName: string) =>
      request<any>(`/organizations/members/${membershipId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ roleName }),
      }),
    removeMember: (membershipId: string) =>
      request<any>(`/organizations/members/${membershipId}`, {
        method: 'DELETE',
      }),
  },

  // Security & Audit
  security: {
    getApiKeys: () => request<any[]>('/security/api-keys'),
    createApiKey: (data: { name: string; scopes?: string[]; expiresDays?: number }) =>
      request<any>('/security/api-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    revokeApiKey: (id: string) =>
      request<any>(`/security/api-keys/${id}`, {
        method: 'DELETE',
      }),
    getAuditLogs: (query?: { entityType?: string; action?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (query?.entityType) params.append('entityType', query.entityType);
      if (query?.action) params.append('action', query.action);
      if (query?.limit) params.append('limit', String(query.limit));
      const q = params.toString();
      return request<any[]>(`/security/audit-logs${q ? `?${q}` : ''}`);
    },
  },

  // Outbox
  outbox: {
    getEvents: (status?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (limit) params.append('limit', String(limit));
      const q = params.toString();
      return request<any[]>(`/outbox/events${q ? `?${q}` : ''}`);
    },
    triggerRelay: () =>
      request<any>('/outbox/relay', {
        method: 'POST',
      }),
  },
};
