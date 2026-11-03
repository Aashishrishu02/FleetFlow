export enum RoleName {
  ORGANIZATION_OWNER = 'Organization Owner',
  OPERATIONS_MANAGER = 'Operations Manager',
  WAREHOUSE_MANAGER = 'Warehouse Manager',
  WAREHOUSE_OPERATOR = 'Warehouse Operator',
  DELIVERY_PARTNER = 'Delivery Partner',
  FINANCE_MANAGER = 'Finance Manager',
  AUDITOR = 'Auditor',
}

export enum Permission {
  // Inventory
  INVENTORY_READ = 'inventory:read',
  INVENTORY_RECEIVE = 'inventory:receive',
  INVENTORY_RESERVE = 'inventory:reserve',
  INVENTORY_RELEASE = 'inventory:release',
  INVENTORY_ADJUST = 'inventory:adjust',
  INVENTORY_TRANSFER = 'inventory:transfer',

  // Products
  PRODUCTS_READ = 'products:read',
  PRODUCTS_WRITE = 'products:write',

  // Warehouses
  WAREHOUSES_READ = 'warehouses:read',
  WAREHOUSES_WRITE = 'warehouses:write',

  // Orders
  ORDERS_READ = 'orders:read',
  ORDERS_WRITE = 'orders:write',

  // Shipments & Dispatch
  SHIPMENTS_READ = 'shipments:read',
  SHIPMENTS_WRITE = 'shipments:write',
  DISPATCH_READ = 'dispatch:read',
  DISPATCH_WRITE = 'dispatch:write',

  // Finance
  FINANCE_READ = 'finance:read',
  FINANCE_WRITE = 'finance:write',

  // System & Org
  ORG_MANAGE = 'org:manage',
  AUDIT_READ = 'audit:read',
}

/**
 * Canonical Role-to-Permissions Mapping
 * Organization Owner has full operational and administrative permissions.
 * Auditor has strictly read-only access.
 */
export const ROLE_PERMISSIONS: Record<RoleName | string, Permission[]> = {
  [RoleName.ORGANIZATION_OWNER]: Object.values(Permission),

  [RoleName.OPERATIONS_MANAGER]: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_RECEIVE,
    Permission.INVENTORY_RESERVE,
    Permission.INVENTORY_RELEASE,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_TRANSFER,
    Permission.PRODUCTS_READ,
    Permission.PRODUCTS_WRITE,
    Permission.WAREHOUSES_READ,
    Permission.WAREHOUSES_WRITE,
    Permission.ORDERS_READ,
    Permission.ORDERS_WRITE,
    Permission.SHIPMENTS_READ,
    Permission.SHIPMENTS_WRITE,
    Permission.DISPATCH_READ,
    Permission.DISPATCH_WRITE,
    Permission.FINANCE_READ,
    Permission.AUDIT_READ,
  ],

  [RoleName.WAREHOUSE_MANAGER]: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_RECEIVE,
    Permission.INVENTORY_RESERVE,
    Permission.INVENTORY_RELEASE,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_TRANSFER,
    Permission.PRODUCTS_READ,
    Permission.PRODUCTS_WRITE,
    Permission.WAREHOUSES_READ,
    Permission.WAREHOUSES_WRITE,
    Permission.ORDERS_READ,
    Permission.SHIPMENTS_READ,
    Permission.AUDIT_READ,
  ],

  [RoleName.WAREHOUSE_OPERATOR]: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_RECEIVE,
    Permission.INVENTORY_RESERVE,
    Permission.INVENTORY_RELEASE,
    Permission.PRODUCTS_READ,
    Permission.WAREHOUSES_READ,
  ],

  [RoleName.DELIVERY_PARTNER]: [
    Permission.SHIPMENTS_READ,
    Permission.SHIPMENTS_WRITE,
    Permission.DISPATCH_READ,
  ],

  [RoleName.FINANCE_MANAGER]: [
    Permission.FINANCE_READ,
    Permission.FINANCE_WRITE,
    Permission.INVENTORY_READ,
    Permission.ORDERS_READ,
    Permission.SHIPMENTS_READ,
    Permission.AUDIT_READ,
  ],

  [RoleName.AUDITOR]: [
    Permission.INVENTORY_READ,
    Permission.PRODUCTS_READ,
    Permission.WAREHOUSES_READ,
    Permission.ORDERS_READ,
    Permission.SHIPMENTS_READ,
    Permission.DISPATCH_READ,
    Permission.FINANCE_READ,
    Permission.AUDIT_READ,
  ],
};

