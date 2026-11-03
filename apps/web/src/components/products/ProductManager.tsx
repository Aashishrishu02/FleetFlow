import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Product } from '../../types/product';

import { API_BASE_URL } from '../../services/api';

const STANDARD_UNITS = ['UNIT', 'PCS', 'BOX', 'PALLET', 'KG', 'LTR', 'MTR', 'PACK'];

export const ProductManager: React.FC = () => {
  const { token, roles, logout } = useAuth();

  const canWrite = roles.some((r) =>
    ['Organization Owner', 'Operations Manager', 'Warehouse Manager'].includes(r),
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Selected Product for Details Drawer
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    unit: 'UNIT',
    isActive: true,
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter === 'ACTIVE') params.append('isActive', 'true');
      if (statusFilter === 'INACTIVE') params.append('isActive', 'false');

      const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        logout();
        setError('Session expired or unauthorized. Please log in again.');
        return;
      }

      if (res.status === 403) {
        setError('Access Denied (403): You do not have permission to view products.');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch products');
      }

      const data: Product[] = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Products API');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, logout]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch full product details including warehouse balances
  const handleSelectProduct = async (prod: Product) => {
    setSelectedProduct(prod);
    setDetailsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/products/${prod.id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        logout();
        return;
      }

      if (res.ok) {
        const fullProd: Product = await res.json();
        setSelectedProduct(fullProd);
      }
    } catch {
      // Retain basic prod if fetch fails
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open modal to create product
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      description: '',
      unit: 'UNIT',
      isActive: true,
    });
    setError('');
    setIsModalOpen(true);
  };

  // Open modal to edit product
  const handleOpenEditModal = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      sku: prod.sku,
      description: prod.description || '',
      unit: prod.unit,
      isActive: prod.isActive,
    });
    setError('');
    setIsModalOpen(true);
  };

  // Save product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.sku.trim()) {
      setError('Product Name and SKU are required.');
      return;
    }

    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = !!editingProduct;
      const url = isEdit ? `${API_BASE_URL}/products/${editingProduct.id}` : `${API_BASE_URL}/products`;
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim().toUpperCase(),
        description: productForm.description.trim() || null,
        unit: productForm.unit.trim().toUpperCase(),
        isActive: productForm.isActive,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        logout();
        return;
      }

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Operation failed',
        );
      }

      setIsModalOpen(false);
      setSuccess(
        isEdit
          ? `Product "${payload.name}" updated successfully.`
          : `Product "${payload.name}" created successfully.`,
      );

      await fetchProducts();

      if (selectedProduct && editingProduct?.id === selectedProduct.id) {
        await handleSelectProduct({ ...selectedProduct, ...payload });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canWrite) return;

    setError('');
    setSuccess('');

    try {
      const newStatus = !prod.isActive;
      const res = await fetch(`${API_BASE_URL}/products/${prod.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Failed to update product status',
        );
      }

      setSuccess(`Product "${prod.name}" status updated to ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`);
      await fetchProducts();

      if (selectedProduct?.id === prod.id) {
        setSelectedProduct({ ...selectedProduct, isActive: newStatus });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  // Compute metrics
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const inactiveProducts = totalProducts - activeProducts;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {success && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span>✓ {success}</span>
          <button onClick={() => setSuccess('')} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>⚠ {error}</span>
          <button onClick={() => setError('')} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* KPI Metric Cards (Matching FleetFlow Design System) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total SKUs Managed
            </p>
            <span className="text-lg text-blue-600">▦</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{totalProducts}</p>
          <p className="mt-2 text-[11px] text-slate-400">Master Catalog SKUs</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Catalog
            </p>
            <span className="text-lg text-emerald-600">✓</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-700">{activeProducts}</p>
          <p className="mt-2 text-[11px] text-emerald-600/80 font-medium">Available for operations</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Inactive / Deprecated
            </p>
            <span className="text-lg text-slate-400">⊘</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-600">{inactiveProducts}</p>
          <p className="mt-2 text-[11px] text-slate-400">Archived from active fulfillment</p>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[300px]">
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, Product Name..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All SKUs ({totalProducts})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeProducts})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive ({inactiveProducts})
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {canWrite ? (
            <button
              onClick={handleOpenCreateModal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition"
            >
              + Add Product
            </button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Read-Only Access ({roles[0] || 'Auditor'})
            </span>
          )}

          <button
            onClick={() => fetchProducts()}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Main Grid: Products Table & Details Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Products Table */}
        <div className={`${selectedProduct ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="font-bold text-slate-900">Products Catalog</h3>
                <p className="text-[11px] text-slate-400">
                  {products.length} product{products.length === 1 ? '' : 's'} registered in this tenant
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Inventory Records</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((prod) => {
                    const isSelected = selectedProduct?.id === prod.id;
                    return (
                      <tr
                        key={prod.id}
                        onClick={() => handleSelectProduct(prod)}
                        className={`cursor-pointer transition hover:bg-blue-50/40 ${
                          isSelected ? 'bg-blue-50/80 font-medium' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{prod.name}</div>
                          {prod.description && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                              {prod.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                            {prod.sku}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {prod.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {prod._count?.inventoryBalances ?? 0}
                          </span>{' '}
                          <span className="text-[10px] text-slate-400">facilities</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              prod.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                prod.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {prod.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canWrite && (
                              <>
                                <button
                                  onClick={(e) => handleOpenEditModal(prod, e)}
                                  className="rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100/50"
                                  title="Edit Product"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => handleToggleStatus(prod, e)}
                                  className={`rounded px-2 py-1 text-[11px] font-medium ${
                                    prod.isActive
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={prod.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {prod.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleSelectProduct(prod)}
                              className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                            >
                              Details →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No products found matching current criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Product Details Drawer */}
        {selectedProduct && (
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedProduct.name}
                    </h3>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700">
                      {selectedProduct.sku}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Unit: {selectedProduct.unit} • Status: {selectedProduct.isActive ? 'Active Catalog' : 'Inactive'}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  title="Close Details"
                >
                  ✕
                </button>
              </div>

              {/* Product Metadata */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Description</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {selectedProduct.description || 'No description provided'}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Registered On</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {new Date(selectedProduct.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Inventory Balances by Warehouse */}
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Live Stock Availability</h4>
                    <p className="text-[10px] text-slate-400">
                      Warehouse facilities holding stock of this SKU
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 uppercase text-[10px] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Warehouse</th>
                        <th className="px-3 py-2">Bay</th>
                        <th className="px-3 py-2 text-right">Available</th>
                        <th className="px-3 py-2 text-right">Reserved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailsLoading ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                            Loading inventory balances...
                          </td>
                        </tr>
                      ) : selectedProduct.inventoryBalances && selectedProduct.inventoryBalances.length > 0 ? (
                        selectedProduct.inventoryBalances.map((bal) => (
                          <tr key={bal.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {bal.warehouse?.name || 'Warehouse'}
                              <p className="text-[10px] text-slate-400 font-mono">
                                {bal.warehouse?.code}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {bal.location?.name || 'Bay'}
                              <p className="text-[10px] text-slate-400 font-mono">
                                {bal.location?.code}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">
                              {bal.availableQty}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700">
                              {bal.reservedQty}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                            No active inventory balance found in any warehouse for this SKU.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Edit Catalog Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Cloud Server 2U"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SRV-2U-01"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-lg border border-slate-200 p-2.5 font-mono uppercase outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 p-2.5 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    {STANDARD_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Dual Intel Xeon Scalable processors, 64GB DDR5 RAM, 2x 10GbE SFP+ ports."
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="productIsActive"
                  checked={productForm.isActive}
                  onChange={(e) =>
                    setProductForm({ ...productForm, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="productIsActive" className="font-semibold text-slate-700">
                  Active for catalog receiving, orders, and reservations
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-md shadow-blue-200 disabled:opacity-50"
                >
                  {savingProduct ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

