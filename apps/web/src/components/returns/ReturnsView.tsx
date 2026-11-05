import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const ReturnsView: React.FC = () => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [returns, setReturns] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({
    orderId: '',
    warehouseId: '',
    reason: 'Customer initiated return - model mismatch',
    productId: '',
    quantity: 1,
  });

  const [inspectForm, setInspectForm] = useState({
    restockDecision: 'RESTOCK' as 'RESTOCK' | 'SCRAP' | 'REFURBISH',
    discrepancyNotes: 'Dock triage passed. Restocked to shelf inventory.',
    damagedQuantity: 0,
    receivedQuantity: 1,
  });

  const canWrite = roles.some((r) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Warehouse Manager',
      'Warehouse Operator',
      'Admin',
      'Manager',
    ].includes(r),
  );

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const [rts, ords, whs] = await Promise.all([
        apiClient.returns.findAll({ status: statusFilter || undefined }),
        apiClient.orders.findAll().catch(() => []),
        apiClient.warehouses.findAll({ isActive: true }).catch(() => []),
      ]);
      setReturns(rts);
      setOrders(ords);
      setWarehouses(whs);

      if (ords.length > 0 && !createForm.orderId) {
        setCreateForm((prev) => ({
          ...prev,
          orderId: ords[0].id,
          productId: ords[0].items?.[0]?.productId || '',
        }));
      }
      if (whs.length > 0 && !createForm.warehouseId) {
        setCreateForm((prev) => ({ ...prev, warehouseId: whs[0].id }));
      }
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toastError, createForm.orderId, createForm.warehouseId]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.returns.create({
        orderId: createForm.orderId,
        warehouseId: createForm.warehouseId,
        reason: createForm.reason,
        items: [{ productId: createForm.productId, expectedQuantity: createForm.quantity }],
      });
      success('RMA Initiated', 'Return authorization generated with receiving triage tracking');
      setIsCreateOpen(false);
      fetchReturns();
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn || !canWrite) return;
    try {
      setSubmitting(true);
      const returnItemId = selectedReturn.items?.[0]?.id || selectedReturn.id;
      await apiClient.returns.inspect(selectedReturn.id, {
        restockDecision: inspectForm.restockDecision,
        discrepancyNotes: inspectForm.discrepancyNotes,
        items: [
          {
            returnItemId,
            receivedQuantity: inspectForm.receivedQuantity,
            damagedQuantity: inspectForm.damagedQuantity,
          },
        ],
      });
      success('Dock Inspection Recorded', 'Restock vs damaged quarantine committed to balance');
      setIsInspectOpen(false);
      setSelectedReturn(null);
      fetchReturns();
    } catch (err: any) {
      toastError('Inspection Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReturn = async (returnId: string, rmaNum: string) => {
    try {
      await apiClient.returns.delete(returnId);
      success('RMA Deleted', `Return authorization ${rmaNum} deleted`);
      fetchReturns();
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs matching Reference Screen 10 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Returns</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Reverse Logistics & RMA Processing</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Reverse Logistics & Returns Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Return material authorization (RMA), dock QA triage, damaged stock isolation, and restocking approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReturns}
            title="Refresh returns"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Icons.Refresh size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!canWrite ? (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              Read-Only Access (Auditor)
            </span>
          ) : (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98]"
            >
              <Icons.Plus size={14} />
              <span>+ Create Return RMA</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip matching Reference Screen 10 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active RMAs"
          value={returns.length}
          subtitle="Customer reverse logistics pipeline"
          trend="+2.4% MoM"
          trendColor="green"
          icon={<Icons.Returns size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Processing Velocity"
          value="3.1 Days"
          subtitle="-0.6d vs dock-to-restock target"
          trend="Optimal"
          trendColor="green"
          icon={<Icons.Refresh size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Restock & Recovery Rate"
          value="84.6%"
          subtitle="Passed dock QA and returned to stock"
          trend="84.6% Salvaged"
          trendColor="blue"
          icon={<Icons.Check size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Quarantine & Hold"
          value={returns.filter((r) => r.status === 'INSPECTED' || r.status === 'CLOSED').length}
          subtitle="Damaged units isolated from available stock"
          trend="QA Isolated"
          trendColor="slate"
          icon={<Icons.Alert size={18} className="text-rose-600" />}
        />
      </div>

      {/* Returns Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200/90 px-5 pt-3.5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['', 'REQUESTED', 'APPROVED', 'INSPECTED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {st === '' ? 'All RMAs' : st}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            {returns.length} return authorizations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">RMA Number</th>
                <th className="py-3 px-4">Order Reference</th>
                <th className="py-3 px-4">Return Reason</th>
                <th className="py-3 px-4">Destination Hub</th>
                <th className="py-3 px-4">Disposition Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.length > 0 ? (
                returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 text-sm">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono font-medium">
                      Order #{ret.orderId?.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-semibold text-slate-900">{ret.reason}</div>
                      <div className="text-[10px] text-slate-400">
                        {ret.items?.length || 1} item(s) to inspect
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {ret.warehouse?.name || 'Receiving Facility'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ret.status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {canWrite && ret.status === 'REQUESTED' && (
                        <button
                          onClick={() => {
                            setSelectedReturn(ret);
                            setIsInspectOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-colors"
                        >
                          Record Dock Inspection →
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => handleDeleteReturn(ret.id, ret.returnNumber)}
                          className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-[11px] font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No active return authorizations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Return Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Initiate Return Material Authorization (RMA)"
          subtitle="Generate customer return tracking and route package to warehouse dock."
          maxWidth="md"
        >
          <form onSubmit={handleCreateReturn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Order *</label>
              <select
                required
                value={createForm.orderId}
                onChange={(e) => {
                  const ord = orders.find((o) => o.id === e.target.value);
                  setCreateForm({
                    ...createForm,
                    orderId: e.target.value,
                    productId: ord?.items?.[0]?.productId || '',
                  });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {o.customerName || 'Customer'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Receiving Warehouse Hub *</label>
              <select
                required
                value={createForm.warehouseId}
                onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Return Reason *</label>
              <input
                type="text"
                required
                value={createForm.reason}
                onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Return Quantity *</label>
              <input
                type="number"
                min={1}
                required
                value={createForm.quantity}
                onChange={(e) => setCreateForm({ ...createForm, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !createForm.orderId}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Generating...' : 'Generate RMA'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dock Inspection Modal */}
      {isInspectOpen && selectedReturn && (
        <Modal
          isOpen={isInspectOpen}
          onClose={() => setIsInspectOpen(false)}
          title={`Dock QA Inspection: ${selectedReturn.returnNumber}`}
          subtitle="Triage received package, inspect for damage, and execute restocking."
          maxWidth="md"
        >
          <form onSubmit={handleInspectReturn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Triage Decision *</label>
              <select
                value={inspectForm.restockDecision}
                onChange={(e) => setInspectForm({ ...inspectForm, restockDecision: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="RESTOCK">RESTOCK (Grade A - Return to Available Stock)</option>
                <option value="SCRAP">SCRAP / QUARANTINE (Damaged - Move to Damaged Stock)</option>
                <option value="REFURBISH">REFURBISH (Secondary Processing Required)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Received Units *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={inspectForm.receivedQuantity}
                  onChange={(e) => setInspectForm({ ...inspectForm, receivedQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Damaged Units</label>
                <input
                  type="number"
                  min={0}
                  value={inspectForm.damagedQuantity}
                  onChange={(e) => setInspectForm({ ...inspectForm, damagedQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspector Notes</label>
              <textarea
                rows={3}
                value={inspectForm.discrepancyNotes}
                onChange={(e) => setInspectForm({ ...inspectForm, discrepancyNotes: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsInspectOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Committing...' : 'Commit Dock Triage'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
