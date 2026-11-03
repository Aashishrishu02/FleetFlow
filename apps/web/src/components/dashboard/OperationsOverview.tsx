import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import type { Warehouse } from '../../types/warehouse';
import type { Product } from '../../types/product';

interface OperationsOverviewProps {
  onNavigate: (page: string) => void;
}

export const OperationsOverview: React.FC<OperationsOverviewProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState<{
    totalRecords: number;
    availableQty: number;
    reservedQty: number;
    damagedQty: number;
    inTransitQty: number;
  } | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [sumRes, whRes, prodRes, movRes] = await Promise.all([
        apiClient.inventory.getSummary().catch(() => null),
        apiClient.warehouses.findAll({ isActive: true }).catch(() => []),
        apiClient.products.findAll({ isActive: true }).catch(() => []),
        apiClient.inventory.getMovements().catch(() => []),
      ]);

      if (sumRes) setSummary(sumRes);
      if (whRes) setWarehouses(whRes);
      if (prodRes) setProducts(prodRes);
      if (movRes) setMovements(movRes.slice(0, 5));
    } catch (err: any) {
      setError(err.message || 'Failed to load live operations data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalStockUnits =
    (summary?.availableQty ?? 0) +
    (summary?.reservedQty ?? 0) +
    (summary?.damagedQty ?? 0) +
    (summary?.inTransitQty ?? 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* KPI Cards (Derived Exclusively From Live Backend) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Stock Units
            </p>
            <span className="text-lg text-blue-600">▦</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? '...' : totalStockUnits.toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Across {summary?.totalRecords ?? 0} active inventory SKU balances
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Available for Orders
            </p>
            <span className="text-lg text-emerald-600">✓</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-700">
            {loading ? '...' : (summary?.availableQty ?? 0).toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-emerald-600/80 font-medium">
            Reserved: {(summary?.reservedQty ?? 0).toLocaleString()} units
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Warehouses
            </p>
            <span className="text-lg text-indigo-600">⌂</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? '...' : warehouses.length}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Operational storage facilities
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Catalog SKUs
            </p>
            <span className="text-lg text-purple-600">◈</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? '...' : products.length}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Active products in master catalog
          </p>
        </div>
      </div>

      {/* Main Grid: Facilities & Recent Movements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Active Facilities Panel */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <h3 className="font-bold text-slate-900">Operational Facilities</h3>
              <p className="text-[11px] text-slate-400">
                Warehouses currently active in PostgreSQL database
              </p>
            </div>
            <button
              onClick={() => onNavigate('Warehouses')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View All Warehouses →
            </button>
          </div>

          <div className="p-4">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Loading facilities...</p>
            ) : warehouses.length > 0 ? (
              <div className="space-y-3">
                {warehouses.map((wh) => (
                  <div
                    key={wh.id}
                    onClick={() => onNavigate('Warehouses')}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900">{wh.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {wh.code}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {wh.city || 'No city'}, {wh.country || 'No country'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Active
                      </span>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {wh._count?.locations ?? 0} storage bays
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No active warehouses found.
              </div>
            )}
          </div>
        </div>

        {/* Recent Stock Movements Panel */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <h3 className="font-bold text-slate-900">Recent Movements</h3>
              <p className="text-[11px] text-slate-400">
                Live transactional audit trail from PostgreSQL
              </p>
            </div>
            <button
              onClick={() => onNavigate('Inventory')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View Inventory Ledger →
            </button>
          </div>

          <div className="p-4">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Loading movements...</p>
            ) : movements.length > 0 ? (
              <div className="space-y-3">
                {movements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          mov.movementType === 'RECEIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : mov.movementType === 'RESERVE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {mov.movementType}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {mov.product?.name || 'Product'}{' '}
                          <span className="text-[10px] font-mono text-slate-400">
                            ({mov.product?.sku})
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {mov.warehouse?.name} • {new Date(mov.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} units
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(mov.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No recent inventory movements recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

