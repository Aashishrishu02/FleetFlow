/**
 * FleetFlow Centralized API Client
 * Single source of truth for all backend communications.
 * Strictly communicates with live NestJS endpoints without mock fallbacks.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
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
    findAllLocations: (warehouseId: string) =>
      request<any[]>(`/warehouses/${warehouseId}/locations`),
    createLocation: (
      warehouseId: string,
      data: { name: string; code: string },
    ) =>
      request<any>(`/warehouses/${warehouseId}/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateLocation: (
      warehouseId: string,
      locationId: string,
      data: { name?: string; code?: string },
    ) =>
      request<any>(`/warehouses/${warehouseId}/locations/${locationId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
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
  },
};
