export interface StorageLocation {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  type?: string;
  createdAt: string;
  _count?: {
    inventoryBalances?: number;
    inventoryMovements?: number;
  };
}

export interface Warehouse {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  locations?: StorageLocation[];
  _count?: {
    locations?: number;
    inventoryBalances?: number;
    inventoryMovements?: number;
    inventoryReservations?: number;
  };
}

