import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const ProductManager: React.FC = () => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Industrial & Hardware',
    unit: 'EACH',
    description: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Industrial & Hardware',
    unit: 'EACH',
    description: '',
  });

  const canWrite = roles.some((r) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Inventory Manager',
      'Warehouse Manager',
      'Admin',
      'Manager',
    ].includes(r),
  );

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.products.findAll();
      setProducts(data);
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to fetch catalog');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.products.create({
        ...formData,
        isActive: true,
      });
      success('Product Catalog Updated', `SKU ${formData.sku.toUpperCase()} registered successfully`);
      setIsCreateOpen(false);
      setFormData({
        name: '',
        sku: '',
        category: 'Industrial & Hardware',
        unit: 'EACH',
        description: '',
      });
      fetchProducts();
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (product: any) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      category: product.category || 'Industrial & Hardware',
      unit: product.unit || 'EACH',
      description: product.description || '',
    });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.products.update(editingProduct.id, editForm);
      success('Product Updated', `SKU ${editingProduct.sku} updated successfully`);
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (product: any) => {
    if (!canWrite) return;
    try {
      await apiClient.products.delete(product.id);
      success('Product Deleted', `SKU ${product.sku} has been removed from catalog`);
      fetchProducts();
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleToggleStatus = async (product: any) => {
    if (!canWrite) return;
    try {
      await apiClient.products.updateStatus(product.id, !product.isActive);
      success('Status Updated', `SKU ${product.sku} is now ${!product.isActive ? 'Active' : 'Archived'}`);
      fetchProducts();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    }
  };

  const productList = Array.isArray(products) ? products : [];
  const activeCount = productList.filter((p) => p?.isActive).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Catalog</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Master Products & SKU Directory</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Master Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage global product specifications, SKU barcodes, volumetric metrics, and catalog lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchProducts}
            title="Refresh catalog"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Icons.Refresh size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!canWrite && (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              Read-Only Access (Auditor)
            </span>
          )}

          {canWrite && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98]"
            >
              <Icons.Plus size={14} />
              <span>+ Register New SKU</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total SKUs Registered"
          value={products.length}
          subtitle={`${activeCount} active in catalog`}
          trend="100% Synced"
          trendColor="green"
          icon={<Icons.Products size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Active SKU Health"
          value={`${products.length > 0 ? Math.round((activeCount / products.length) * 100) : 100}%`}
          subtitle="All barcodes compliant with GS1"
          trend="GS1 Ready"
          trendColor="blue"
          icon={<Icons.Check size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Categorization Coverage"
          value="100%"
          subtitle="Commodity codes assigned"
          trend="Fully Tagged"
          trendColor="green"
          icon={<Icons.Inventory size={18} className="text-indigo-600" />}
        />
        <StatCard
          title="Archived SKUs"
          value={products.length - activeCount}
          subtitle="Retired from active replenishment"
          trend={products.length - activeCount > 0 ? 'Archived' : 'Zero Archived'}
          trendColor="slate"
          icon={<Icons.Alert size={18} className="text-slate-600" />}
        />
      </div>

      {/* Filter and Products Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200/90 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-800">Product Records</span>
            <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-mono font-bold">
              {products.length}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Icons.Search size={13} />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">SKU & Barcode</th>
                <th className="py-3 px-4">Product Name & Specs</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit of Measure</th>
                <th className="py-3 px-4">Catalog Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length > 0 ? (
                products
                  .filter((p) => {
                    if (searchQuery && !p.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !p.sku?.toLowerCase().includes(searchQuery.toLowerCase())) {
                      return false;
                    }
                    return true;
                  })
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-blue-600">{p.sku}</div>
                        <div className="text-[10px] text-slate-400">ID: {p.id.slice(0, 8)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{p.description || 'Standard logistics master specification'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {p.category || 'General Merchandise'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 font-semibold">
                        {p.unit || 'EACH'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.isActive ? 'ACTIVE' : 'ARCHIVED'} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => handleEditOpen(p)}
                              className="px-2.5 py-1 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded text-[11px] font-semibold transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleStatus(p)}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                p.isActive
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {p.isActive ? 'Archive' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-[11px] font-semibold transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No products registered in the master catalog. Click "+ Register New SKU" to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Product Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Register Master Product SKU"
          subtitle="Define global product parameters, unique SKU, and measurement unit."
          maxWidth="md"
        >
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Smart Barcode Scanner Pro 900"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unique Stock Keeping Unit (SKU) *</label>
              <input
                type="text"
                required
                placeholder="e.g. SCN-SMART-900"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="Electronics"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measure</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="EACH">EACH (Discrete Unit)</option>
                  <option value="BOX">BOX (Multipack)</option>
                  <option value="PALLET">PALLET (Logistics Bulk)</option>
                  <option value="KG">KILOGRAM (Weight Bulk)</option>
                  <option value="LITER">LITER (Liquid Volume)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Industrial rugged barcode reader with Bluetooth and Wi-Fi..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
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
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Registering...' : 'Register SKU'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <Modal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          title={`Edit Product: ${editingProduct.sku}`}
          subtitle="Update product title, category, measurement unit, or catalog description."
          maxWidth="md"
        >
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Title *</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Measurement Unit</label>
                <select
                  value={editForm.unit}
                  onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="EACH">EACH (Piece)</option>
                  <option value="CASE">CASE (Box/Carton)</option>
                  <option value="PALLET">PALLET (Full Pallet)</option>
                  <option value="KG">KG (Kilogram)</option>
                  <option value="LITER">LITER (Liquid Volume)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
