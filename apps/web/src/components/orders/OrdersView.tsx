import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const OrdersView: React.FC = () => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [newOrder, setNewOrder] = useState({
    customerId: `CUST-${Math.floor(Math.random() * 9000 + 1000)}`,
    customerName: '',
    customerEmail: '',
    shippingAddress: '',
    shippingCity: '',
    shippingPostalCode: '',
    shippingCountry: 'US',
    notes: '',
    items: [{ productId: '', quantity: 1, unitPrice: 45.0 }],
  });

  const canWrite = roles.some((r) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Admin',
      'Manager',
    ].includes(r),
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const [ordsRes, prodsRes] = await Promise.all([
        apiClient.orders.findAll({
          status: statusFilter || undefined,
          search: searchTerm || undefined,
        }),
        apiClient.products.findAll({ isActive: true }).catch(() => []),
      ]);
      setOrders(Array.isArray((ordsRes as any)?.data) ? (ordsRes as any).data : Array.isArray(ordsRes) ? ordsRes : []);
      setProducts(prodsRes);
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, toastError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const validItems = newOrder.items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      toastError('Validation Error', 'Order must contain at least one valid product line item');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.orders.create({
        ...newOrder,
        items: validItems,
        idempotencyKey: `ord-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      success('Order Created', `Order for ${newOrder.customerName || 'Customer'} successfully submitted`);
      setIsCreateOpen(false);
      setNewOrder({
        customerId: `CUST-${Math.floor(Math.random() * 9000 + 1000)}`,
        customerName: '',
        customerEmail: '',
        shippingAddress: '',
        shippingCity: '',
        shippingPostalCode: '',
        shippingCountry: 'US',
        notes: '',
        items: [{ productId: '', quantity: 1, unitPrice: 45.0 }],
      });
      fetchOrders();
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      const res = await apiClient.orders.confirm(orderId);
      success('Order Confirmed', res.message || 'Inventory allocated and reserved successfully');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toastError('Confirmation Failed', err.message);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiClient.orders.cancel(orderId, 'Cancelled via operations console');
      success('Order Cancelled', 'Compensating inventory release executed successfully');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toastError('Cancellation Failed', err.message);
    }
  };

  const handleTriggerWorkflow = async (orderId: string) => {
    try {
      await apiClient.workflows.start(orderId);
      success('Saga Initiated', 'Fulfillment saga workflow dispatched to outbox');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toastError('Workflow Failed', err.message);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await apiClient.orders.delete(orderId);
      success('Order Deleted', 'Customer order removed successfully');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const orderList = Array.isArray(orders) ? orders : [];
  const totalGMV = orderList.reduce((acc, o) => acc + Number(o?.totalAmount || 0), 0);
  const pendingCount = orderList.filter((o) => ['CREATED', 'CONFIRMED', 'ALLOCATING_INVENTORY'].includes(o?.status)).length;
  const completedCount = orderList.filter((o) => o?.status === 'COMPLETED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs matching Reference Screen 4 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Orders</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Global Freight Pipeline & Order Management</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Customer Orders & Fulfillment</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic scoring allocation, multi-item reservation & saga fulfillment orchestration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            title="Refresh orders"
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
              <span>+ Create Freight Order</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip matching Reference Screen 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders Placed"
          value={orderList.length.toLocaleString()}
          subtitle={`Completed: ${completedCount.toLocaleString()} orders`}
          trend="+11.6%"
          trendColor="green"
          icon={<Icons.Orders size={18} className="text-blue-600" />}
        />
        <StatCard
          title="In Fulfillment / Processing"
          value={pendingCount.toLocaleString()}
          subtitle="Active pipeline awaiting dispatch"
          trend={`${pendingCount} active`}
          trendColor="amber"
          icon={<Icons.Workflow size={18} className="text-amber-600" />}
        />
        <StatCard
          title="On-Time Fulfillment Rate"
          value="98.7%"
          subtitle="Target: 98.0% | Margin: +0.7%"
          trend="Optimal"
          trendColor="green"
          icon={<Icons.Check size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Gross Order Value"
          value={`$${totalGMV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="All transactions reconciled"
          trend="Reconciled"
          trendColor="blue"
          icon={<Icons.Finance size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Orders Table Container */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {/* Segmented Filter Pills matching Reference Screen 4 */}
        <div className="border-b border-slate-200/90 px-5 pt-3.5 pb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              ['', 'All Orders'],
              ['CREATED', 'Created / Draft'],
              ['CONFIRMED', 'Confirmed & Reserved'],
              ['ALLOCATING_INVENTORY', 'In Allocation'],
              ['COMPLETED', 'Fulfilled'],
              ['CANCELLED', 'Cancelled'],
            ].map(([st, label]) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by order #, customer, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Icons.Search size={13} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Order & PO Reference</th>
                <th className="py-3 px-4">Customer & Account</th>
                <th className="py-3 px-4">Destination & Route</th>
                <th className="py-3 px-4 text-right">Order Amount</th>
                <th className="py-3 px-4">Fulfillment Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orderList.length > 0 ? (
                orderList.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-blue-600 text-sm">{order.orderNumber}</div>
                      <div className="text-[10px] text-slate-400">
                        {order.items?.length || 1} line item(s) · {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{order.customerName || 'Acme Global Client'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.customerId}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-medium text-slate-900">{order.shippingCity}, {order.shippingCountry || 'US'}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">{order.shippingAddress || 'Distribution Point'}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ${Number(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors"
                      >
                        Details & Actions →
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No customer orders found. Click "+ Create Freight Order" to submit a new multi-item booking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details & Fulfillment Actions Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order Management: ${selectedOrder.orderNumber}`}
          subtitle={`Customer: ${selectedOrder.customerName || selectedOrder.customerId} · Status: ${selectedOrder.status}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                <div className="mt-1"><StatusBadge status={selectedOrder.status} /></div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Order GMV</span>
                <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  ${Number(selectedOrder.totalAmount || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Destination</span>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedOrder.shippingCity}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Postal Code</span>
                <div className="text-xs font-mono font-medium text-slate-700 mt-0.5">{selectedOrder.shippingPostalCode}</div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Order Line Items</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {selectedOrder.items?.map((item: any) => (
                  <div key={item.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{item.product?.name || 'Product'}</span>
                      <span className="ml-2 font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {item.product?.sku}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span>Qty: <strong className="text-slate-900">{item.quantity}</strong></span>
                      <span>Unit: ${Number(item.unitPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            {canWrite && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                {['CREATED', 'CONFIRMED', 'ALLOCATING_INVENTORY'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Cancel Order & Release Stock
                  </button>
                )}

                {['CREATED', 'CANCELLED'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Delete Order
                  </button>
                )}

                <div className="flex items-center gap-2.5 ml-auto">
                  {selectedOrder.status === 'CREATED' && (
                    <button
                      onClick={() => handleConfirmOrder(selectedOrder.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      ✓ Confirm & Reserve Stock
                    </button>
                  )}
                  <button
                    onClick={() => handleTriggerWorkflow(selectedOrder.id)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                  >
                    ⚡ Trigger Fulfillment Saga
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create Order Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Multi-Item Freight Order"
          subtitle="Register customer shipment order with deterministic warehouse allocation scoring."
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Global Logistics"
                  value={newOrder.customerName}
                  onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Email</label>
                <input
                  type="email"
                  placeholder="dispatch@apexlogistics.com"
                  value={newOrder.customerEmail}
                  onChange={(e) => setNewOrder({ ...newOrder, customerEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shipping City *</label>
                <input
                  type="text"
                  required
                  placeholder="Chicago"
                  value={newOrder.shippingCity}
                  onChange={(e) => setNewOrder({ ...newOrder, shippingCity: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Postal Code *</label>
                <input
                  type="text"
                  required
                  placeholder="60601"
                  value={newOrder.shippingPostalCode}
                  onChange={(e) => setNewOrder({ ...newOrder, shippingPostalCode: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={newOrder.shippingCountry}
                  onChange={(e) => setNewOrder({ ...newOrder, shippingCountry: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination Address</label>
              <input
                type="text"
                placeholder="500 W Madison St, Ste 2100"
                value={newOrder.shippingAddress}
                onChange={(e) => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Line Item */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700">Order Line Items</span>
              {newOrder.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-7">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product SKU *</label>
                    <select
                      required
                      value={item.productId}
                      onChange={(e) => {
                        const items = [...newOrder.items];
                        items[idx].productId = e.target.value;
                        setNewOrder({ ...newOrder, items });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                    >
                      <option value="">Select SKU...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={item.quantity}
                      onChange={(e) => {
                        const items = [...newOrder.items];
                        items[idx].quantity = Number(e.target.value);
                        setNewOrder({ ...newOrder, items });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const items = [...newOrder.items];
                        items[idx].unitPrice = Number(e.target.value);
                        setNewOrder({ ...newOrder, items });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
              ))}
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
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Submitting...' : 'Submit Freight Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
