export interface InventoryBalanceForProduct {
  id: string;
  warehouseId: string;
  locationId: string;
  availableQty: number;
  reservedQty: number;
  damagedQty: number;
  inTransitQty: number;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inventoryBalances?: InventoryBalanceForProduct[];
  _count?: {
    inventoryBalances?: number;
    inventoryMovements?: number;
    inventoryReservations?: number;
  };
}

