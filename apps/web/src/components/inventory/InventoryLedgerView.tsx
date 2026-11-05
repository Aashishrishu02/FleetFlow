import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const InventoryLedgerView: React.FC = () => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<'balances' | 'movements'>('balances');

  const [balances, setBalances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Aux dropdown data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Action Modals
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [receiveForm, setReceiveForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    quantity: 50,
    notes: 'Inbound PO freight delivery',
  });

  const [issueForm, setIssueForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    quantity: 10,
    notes: 'Customer dispatch fulfillment',
  });

  const [adjustForm, setAdjustForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    quantity: 5,
    reason: 'DAMAGE' as 'RECONCILIATION' | 'DAMAGE',
    notes: 'Dock triage quarantine',
  });

  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: '',
    fromLocationId: '',
    toWarehouseId: '',
    toLocationId: '',
    productId: '',
    quantity: 10,
  });

  const [destLocations, setDestLocations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const canWrite = roles.some((r) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Inventory Manager',
      'Warehouse Manager',
      'Warehouse Operator',
      'Admin',
      'Manager',
    ].includes(r),
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bals, movs, summ, whs, prods] = await Promise.all([
        apiClient.inventory.getBalances().catch(() => []),
        apiClient.inventory.getMovements().catch(() => []),
        apiClient.inventory.getSummary().catch(() => null),
        apiClient.warehouses.findAll({ isActive: true }).catch(() => []),
        apiClient.products.findAll({ isActive: true }).catch(() => []),
      ]);
      setBalances(bals);
      setMovements(movs);
      setSummary(summ);
      setWarehouses(whs);
      setProducts(prods);

      if (whs.length > 0 && !receiveForm.warehouseId) {
        setReceiveForm((prev) => ({ ...prev, warehouseId: whs[0].id }));
        setIssueForm((prev) => ({ ...prev, warehouseId: whs[0].id }));
        setAdjustForm((prev) => ({ ...prev, warehouseId: whs[0].id }));
        setTransferForm((prev) => ({ ...prev, fromWarehouseId: whs[0].id }));
      }
      if (prods.length > 0 && !receiveForm.productId) {
        setReceiveForm((prev) => ({ ...prev, productId: prods[0].id }));
        setIssueForm((prev) => ({ ...prev, productId: prods[0].id }));
        setAdjustForm((prev) => ({ ...prev, productId: prods[0].id }));
        setTransferForm((prev) => ({ ...prev, productId: prods[0].id }));
      }
    } catch (err: any) {
      toastError('Fetch Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [toastError, receiveForm.warehouseId, receiveForm.productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load locations whenever warehouse changes
  useEffect(() => {
    const whId = receiveForm.warehouseId;
    if (whId) {
      apiClient.warehouses.findAllLocations(whId).then((locs) => {
        setLocations(locs);
        if (locs.length > 0) {
          setReceiveForm((prev) => ({ ...prev, locationId: locs[0].id }));
          setIssueForm((prev) => ({ ...prev, locationId: locs[0].id }));
          setAdjustForm((prev) => ({ ...prev, locationId: locs[0].id }));
          setTransferForm((prev) => ({ ...prev, fromLocationId: locs[0].id }));
        }
      });
    }
  }, [receiveForm.warehouseId]);

  // Destination locations for transfer
  useEffect(() => {
    const whId = transferForm.toWarehouseId;
    if (whId) {
      apiClient.warehouses.findAllLocations(whId).then((locs) => {
        setDestLocations(locs);
        if (locs.length > 0) {
          setTransferForm((prev) => ({ ...prev, toLocationId: locs[0].id }));
        }
      });
    }
  }, [transferForm.toWarehouseId]);

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.inventory.receiveStock({
        ...receiveForm,
        idempotencyKey: `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      success('Stock Received', `Intake of ${receiveForm.quantity} units successfully committed to balance`);
      setIsReceiveOpen(false);
      loadData();
    } catch (err: any) {
      toastError('Receipt Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.inventory.issueStock({
        ...issueForm,
        idempotencyKey: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      success('Stock Issued', `Dispatched ${issueForm.quantity} units from inventory`);
      setIsIssueOpen(false);
      loadData();
    } catch (err: any) {
      toastError('Issue Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.inventory.adjustStock({
        ...adjustForm,
        idempotencyKey: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      success('Stock Adjusted', `Quarantined/reconciled ${adjustForm.quantity} units`);
      setIsAdjustOpen(false);
      loadData();
    } catch (err: any) {
      toastError('Adjustment Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.inventory.transferStock({
        ...transferForm,
        idempotencyKey: `trf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      success('Stock Transferred', `Moved ${transferForm.quantity} units between facility locations`);
      setIsTransferOpen(false);
      loadData();
    } catch (err: any) {
      toastError('Transfer Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAvailable = summary?.availableQty ?? 0;
  const totalReserved = summary?.reservedQty ?? 0;
  const totalDamaged = summary?.damagedQty ?? 0;
  const totalInTransit = summary?.inTransitQty ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs matching Reference Screen 5 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Inventory</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Global Stock & SKU Management</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Inventory & Stock Levels</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time warehouse inventory, multi-facility SKU balances, reservation pipelines, and automated reorder triggers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh inventory"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Icons.Refresh size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!canWrite ? (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              Read-Only Access (Auditor)
            </span>
          ) : (
            <>
              <button
                onClick={() => setIsAdjustOpen(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-all"
              >
                Adjust / Quarantine
              </button>
              <button
                onClick={() => setIsTransferOpen(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-all"
              >
                Transfer Stock
              </button>
              <button
                onClick={() => setIsIssueOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg shadow-2xs transition-all"
              >
                <Icons.Minus size={13} />
                <span>- Issue Stock</span>
              </button>
              <button
                onClick={() => setIsReceiveOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98]"
              >
                <Icons.Plus size={14} />
                <span>+ Receive Stock Inbound</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Strip matching Reference Screen 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total SKUs Managed"
          value={products.length}
          subtitle={`${balances.length} location balance records`}
          trend="100% Synced"
          trendColor="green"
          icon={<Icons.Products size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Total Available Stock"
          value={totalAvailable.toLocaleString()}
          subtitle="92.4% Optimal Health vs target"
          trend="In Stock"
          trendColor="green"
          icon={<Icons.Inventory size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Reserved & In-Transit"
          value={(totalReserved + totalInTransit).toLocaleString()}
          subtitle={`${totalReserved.toLocaleString()} reserved · ${totalInTransit.toLocaleString()} in-transit`}
          trend="Active Flow"
          trendColor="blue"
          icon={<Icons.Shipments size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Stock Alerts & Quarantine"
          value={totalDamaged}
          subtitle={`${totalDamaged} damaged units quarantined`}
          trend={totalDamaged > 0 ? 'Requires QA' : 'Zero Damage'}
          trendColor={totalDamaged > 0 ? 'rose' : 'green'}
          icon={<Icons.Alert size={18} className="text-rose-600" />}
        />
      </div>

      {/* Main Ledger Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200/90 px-5 pt-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('balances')}
              className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
                activeTab === 'balances'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Current Stock Balances ({balances.length})
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
                activeTab === 'movements'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Immutable Movement Ledger ({movements.length})
            </button>
          </div>

          <div className="pb-2">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search SKU or warehouse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Icons.Search size={13} />
              </div>
            </div>
          </div>
        </div>

        {/* Tab 1: Current Stock Balances Table */}
        {activeTab === 'balances' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Product Details & SKU</th>
                  <th className="py-3 px-4">Warehouse & Storage Location</th>
                  <th className="py-3 px-4 text-right">Available Qty</th>
                  <th className="py-3 px-4 text-right">Reserved Qty</th>
                  <th className="py-3 px-4 text-right">Damaged Qty</th>
                  <th className="py-3 px-4 text-right">In-Transit</th>
                  <th className="py-3 px-4 text-right">Total Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.length > 0 ? (
                  balances
                    .filter((b) => {
                      if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        const pName = b.product?.name?.toLowerCase() || '';
                        const pSku = b.product?.sku?.toLowerCase() || '';
                        const wName = b.warehouse?.name?.toLowerCase() || '';
                        return pName.includes(q) || pSku.includes(q) || wName.includes(q);
                      }
                      return true;
                    })
                    .map((b) => {
                      const total =
                        (b.availableQty || 0) +
                        (b.reservedQty || 0) +
                        (b.damagedQty || 0) +
                        (b.inTransitQty || 0);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{b.product?.name || 'Item'}</div>
                            <div className="font-mono text-[10px] text-blue-600 font-semibold">
                              SKU: {b.product?.sku}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <div className="font-medium text-slate-900">{b.warehouse?.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">
                              Zone: {b.location?.name || 'Aisle 01'} ({b.location?.code || 'BAY-01'})
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                            {b.availableQty?.toLocaleString() || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-amber-600 font-semibold">
                            {b.reservedQty?.toLocaleString() || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold">
                            {b.damagedQty?.toLocaleString() || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-blue-600">
                            {b.inTransitQty?.toLocaleString() || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                            {total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No stock records found. Click "+ Receive Stock Inbound" to intake initial product inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Immutable Movements Table */}
        {activeTab === 'movements' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Product & SKU</th>
                  <th className="py-3 px-4">Facility / Hub</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4">Reference & Notes</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length > 0 ? (
                  movements.slice(0, 15).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <StatusBadge status={m.movementType} />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {m.product?.sku || 'SKU'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {m.warehouse?.name || 'Warehouse Hub'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="truncate max-w-xs">{m.notes || m.referenceType || 'Internal transfer'}</div>
                        <div className="font-mono text-[9px] text-slate-400">{m.idempotencyKey}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No inventory movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Stock Modal */}
      {isReceiveOpen && (
        <Modal
          isOpen={isReceiveOpen}
          onClose={() => setIsReceiveOpen(false)}
          title="Receive Inbound Stock"
          subtitle="Commit inbound freight into warehouse inventory balance with idempotency."
          maxWidth="md"
        >
          <form onSubmit={handleReceiveStock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Warehouse Hub *</label>
              <select
                required
                value={receiveForm.warehouseId}
                onChange={(e) => setReceiveForm({ ...receiveForm, warehouseId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Storage Location (Rack/Aisle) *</label>
              <select
                required
                value={receiveForm.locationId}
                onChange={(e) => setReceiveForm({ ...receiveForm, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product SKU *</label>
              <select
                required
                value={receiveForm.productId}
                onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Intake Quantity *</label>
              <input
                type="number"
                min={1}
                required
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / BOL Ref</label>
              <input
                type="text"
                value={receiveForm.notes}
                onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReceiveOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Committing...' : 'Commit Inbound Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Issue Stock Modal */}
      {isIssueOpen && (
        <Modal
          isOpen={isIssueOpen}
          onClose={() => setIsIssueOpen(false)}
          title="Issue Outbound Stock"
          subtitle="Deduct inventory units for customer order dispatch with overdraw prevention."
          maxWidth="md"
        >
          <form onSubmit={handleIssueStock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Source Facility Hub *</label>
              <select
                required
                value={issueForm.warehouseId}
                onChange={(e) => setIssueForm({ ...issueForm, warehouseId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Source Storage Location *</label>
              <select
                required
                value={issueForm.locationId}
                onChange={(e) => setIssueForm({ ...issueForm, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product SKU *</label>
              <select
                required
                value={issueForm.productId}
                onChange={(e) => setIssueForm({ ...issueForm, productId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deduction Quantity *</label>
              <input
                type="number"
                min={1}
                required
                value={issueForm.quantity}
                onChange={(e) => setIssueForm({ ...issueForm, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference Reason</label>
              <input
                type="text"
                value={issueForm.notes}
                onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsIssueOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Deducting...' : 'Deduct & Issue Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Adjust / Damage Modal */}
      {isAdjustOpen && (
        <Modal
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          title="Stock Adjustment & Damage Quarantine"
          subtitle="Segregate broken/damaged goods or record cycle-count reconciliations."
          maxWidth="md"
        >
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Type *</label>
              <select
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="DAMAGE">DAMAGE (Move Available → Damaged Quarantine)</option>
                <option value="RECONCILIATION">RECONCILIATION (Physical Count Discrepancy)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Warehouse</label>
                <select
                  value={adjustForm.warehouseId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product SKU</label>
              <select
                value={adjustForm.productId}
                onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Audit Reason</label>
              <input
                type="text"
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdjustOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inter-Facility Transfer Modal */}
      {isTransferOpen && (
        <Modal
          isOpen={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          title="Inter-Facility Stock Transfer"
          subtitle="Move pallet stock between distribution hubs or rack locations."
          maxWidth="lg"
        >
          <form onSubmit={handleTransferStock} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500">Source Location</span>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Warehouse</label>
                  <select
                    value={transferForm.fromWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Location</label>
                  <select
                    value={transferForm.fromLocationId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromLocationId: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                <span className="text-[11px] font-bold uppercase text-blue-800">Destination Location</span>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Warehouse</label>
                  <select
                    value={transferForm.toWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                  >
                    <option value="">Select Target...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Location</label>
                  <select
                    value={transferForm.toLocationId}
                    onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                  >
                    {destLocations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product SKU</label>
                <select
                  value={transferForm.productId}
                  onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Units</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !transferForm.toWarehouseId}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Transferring...' : 'Execute Stock Transfer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
