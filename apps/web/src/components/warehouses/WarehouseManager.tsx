import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Warehouse, StorageLocation } from '../../types/warehouse';

import { API_BASE_URL } from '../../services/api';

export const WarehouseManager: React.FC = () => {
  const { token, roles, logout } = useAuth();

  const canWrite = roles.some((r) =>
    ['Organization Owner', 'Operations Manager', 'Warehouse Manager'].includes(r),
  );

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Selected warehouse for details & storage locations
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  // Warehouse Modal (Create / Edit)
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: '',
    isActive: true,
  });
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  // Storage Location Modal (Create / Edit)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    code: '',
  });
  const [savingLocation, setSavingLocation] = useState(false);

  // Fetch warehouses
  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter === 'ACTIVE') params.append('isActive', 'true');
      if (statusFilter === 'INACTIVE') params.append('isActive', 'false');

      const res = await fetch(`${API_BASE_URL}/warehouses?${params.toString()}`, {
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
        setError('Access Denied (403): You do not have permission to view warehouses.');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch warehouses');
      }

      const data: Warehouse[] = await res.json();
      setWarehouses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Warehouses API');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, logout]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Fetch locations for selected warehouse
  const fetchLocations = useCallback(
    async (warehouseId: string) => {
      setLocationsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}/locations`, {
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
          const data: StorageLocation[] = await res.json();
          setLocations(data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load storage locations');
      } finally {
        setLocationsLoading(false);
      }
    },
    [token, logout],
  );

  // Select a warehouse to inspect details
  const handleSelectWarehouse = async (wh: Warehouse) => {
    setSelectedWarehouse(wh);
    await fetchLocations(wh.id);
  };

  // Open modal to create warehouse
  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setWarehouseForm({
      name: '',
      code: '',
      address: '',
      city: '',
      country: '',
      isActive: true,
    });
    setError('');
    setIsWarehouseModalOpen(true);
  };

  // Open modal to edit warehouse
  const handleOpenEditModal = (wh: Warehouse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWarehouse(wh);
    setWarehouseForm({
      name: wh.name,
      code: wh.code,
      address: wh.address || '',
      city: wh.city || '',
      country: wh.country || '',
      isActive: wh.isActive,
    });
    setError('');
    setIsWarehouseModalOpen(true);
  };

  // Save Warehouse (Create or Update)
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.name.trim() || !warehouseForm.code.trim()) {
      setError('Warehouse Name and Code are required.');
      return;
    }

    setSavingWarehouse(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = !!editingWarehouse;
      const url = isEdit
        ? `${API_BASE_URL}/warehouses/${editingWarehouse.id}`
        : `${API_BASE_URL}/warehouses`;
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = {
        name: warehouseForm.name.trim(),
        code: warehouseForm.code.trim().toUpperCase(),
        address: warehouseForm.address.trim() || null,
        city: warehouseForm.city.trim() || null,
        country: warehouseForm.country.trim() || null,
        isActive: warehouseForm.isActive,
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

      setIsWarehouseModalOpen(false);
      setSuccess(
        isEdit
          ? `Warehouse "${payload.name}" updated successfully.`
          : `Warehouse "${payload.name}" created successfully.`,
      );

      await fetchWarehouses();

      if (selectedWarehouse && editingWarehouse?.id === selectedWarehouse.id) {
        setSelectedWarehouse({ ...selectedWarehouse, ...payload });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save warehouse');
    } finally {
      setSavingWarehouse(false);
    }
  };

  // Toggle Warehouse status
  const handleToggleStatus = async (wh: Warehouse, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canWrite) return;

    setError('');
    setSuccess('');

    try {
      const newStatus = !wh.isActive;
      const res = await fetch(`${API_BASE_URL}/warehouses/${wh.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to update warehouse status');
      }

      setSuccess(`Warehouse "${wh.name}" is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`);
      await fetchWarehouses();

      if (selectedWarehouse?.id === wh.id) {
        setSelectedWarehouse({ ...selectedWarehouse, isActive: newStatus });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  // Open Location Modal (Create)
  const handleOpenCreateLocation = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', code: '' });
    setError('');
    setIsLocationModalOpen(true);
  };

  // Open Location Modal (Edit)
  const handleOpenEditLocation = (loc: StorageLocation) => {
    setEditingLocation(loc);
    setLocationForm({ name: loc.name, code: loc.code });
    setError('');
    setIsLocationModalOpen(true);
  };

  // Save Storage Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;

    if (!locationForm.name.trim() || !locationForm.code.trim()) {
      setError('Location Name and Code are required.');
      return;
    }

    setSavingLocation(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = !!editingLocation;
      const url = isEdit
        ? `${API_BASE_URL}/warehouses/${selectedWarehouse.id}/locations/${editingLocation.id}`
        : `${API_BASE_URL}/warehouses/${selectedWarehouse.id}/locations`;
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = {
        name: locationForm.name.trim(),
        code: locationForm.code.trim().toUpperCase(),
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

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Operation failed',
        );
      }

      setIsLocationModalOpen(false);
      setSuccess(
        isEdit
          ? `Storage location "${payload.name}" updated successfully.`
          : `Storage location "${payload.name}" created successfully.`,
      );

      await fetchLocations(selectedWarehouse.id);
      await fetchWarehouses();
    } catch (err: any) {
      setError(err.message || 'Failed to save storage location');
    } finally {
      setSavingLocation(false);
    }
  };

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

      {/* Action Bar / Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[280px]">
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, city..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {canWrite ? (
            <button
              onClick={handleOpenCreateModal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition"
            >
              + Add Warehouse
            </button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Read-Only Access ({roles[0] || 'Auditor'})
            </span>
          )}

          <button
            onClick={() => fetchWarehouses()}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Main Grid: Warehouse List & Detail Drawer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Warehouse Table */}
        <div className={`${selectedWarehouse ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="font-bold text-slate-900">Warehouses</h3>
                <p className="text-[11px] text-slate-400">
                  {warehouses.length} facility{warehouses.length === 1 ? '' : 'ies'} registered
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Facility</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {warehouses.map((wh) => {
                    const isSelected = selectedWarehouse?.id === wh.id;
                    return (
                      <tr
                        key={wh.id}
                        onClick={() => handleSelectWarehouse(wh)}
                        className={`cursor-pointer transition hover:bg-blue-50/40 ${
                          isSelected ? 'bg-blue-50/80 font-medium' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{wh.name}</div>
                          {wh.address && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {wh.address}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                            {wh.code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {wh.city ? `${wh.city}${wh.country ? `, ${wh.country}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {wh._count?.locations ?? 0}
                          </span>{' '}
                          <span className="text-[10px] text-slate-400">bays</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              wh.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                wh.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {wh.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canWrite && (
                              <>
                                <button
                                  onClick={(e) => handleOpenEditModal(wh, e)}
                                  className="rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100/50"
                                  title="Edit Warehouse"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => handleToggleStatus(wh, e)}
                                  className={`rounded px-2 py-1 text-[11px] font-medium ${
                                    wh.isActive
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={wh.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {wh.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleSelectWarehouse(wh)}
                              className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                            >
                              Details →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && warehouses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No warehouses found matching current criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Warehouse Details & Storage Location Management Drawer */}
        {selectedWarehouse && (
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedWarehouse.name}
                    </h3>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700">
                      {selectedWarehouse.code}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedWarehouse.city || 'No city'}, {selectedWarehouse.country || 'No country'}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedWarehouse(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  title="Close Details"
                >
                  ✕
                </button>
              </div>

              {/* Warehouse Metadata */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Address</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {selectedWarehouse.address || 'Not specified'}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Status</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {selectedWarehouse.isActive ? 'Active Operations' : 'Inactive'}
                  </p>
                </div>
              </div>

              {/* Storage Locations Header */}
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Storage Locations & Bays</h4>
                  <p className="text-[10px] text-slate-400">
                    Racks, shelves, and storage zones
                  </p>
                </div>

                {canWrite && (
                  <button
                    onClick={handleOpenCreateLocation}
                    className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    + Add Location
                  </button>
                )}
              </div>

              {/* Storage Locations Table */}
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 uppercase text-[10px] text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Location / Bay</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {locationsLoading ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                          Loading locations...
                        </td>
                      </tr>
                    ) : locations.length > 0 ? (
                      locations.map((loc) => (
                        <tr key={loc.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-800">{loc.name}</td>
                          <td className="px-3 py-2">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700">
                              {loc.code}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {canWrite && (
                              <button
                                onClick={() => handleOpenEditLocation(loc)}
                                className="text-blue-600 hover:text-blue-800 text-[11px] font-medium"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                          No storage locations configured for this facility yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Warehouse */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingWarehouse ? 'Edit Warehouse Facility' : 'Create New Warehouse'}
              </h3>
              <button
                onClick={() => setIsWarehouseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Warehouse Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bangalore Fulfillment Center"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Warehouse Code (Unique) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BLR-01"
                  value={warehouseForm.code}
                  onChange={(e) =>
                    setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full rounded-lg border border-slate-200 p-2.5 font-mono uppercase outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangalore"
                    value={warehouseForm.city}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="e.g. India"
                    value={warehouseForm.country}
                    onChange={(e) =>
                      setWarehouseForm({ ...warehouseForm, country: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Plot 12, Electronic City Logistics Hub"
                  value={warehouseForm.address}
                  onChange={(e) =>
                    setWarehouseForm({ ...warehouseForm, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="warehouseIsActive"
                  checked={warehouseForm.isActive}
                  onChange={(e) =>
                    setWarehouseForm({ ...warehouseForm, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="warehouseIsActive" className="font-semibold text-slate-700">
                  Active for operational receiving and dispatch
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-md shadow-blue-200 disabled:opacity-50"
                >
                  {savingWarehouse ? 'Saving...' : editingWarehouse ? 'Update Facility' : 'Create Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Storage Location */}
      {isLocationModalOpen && selectedWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingLocation ? 'Edit Storage Location' : 'Add Storage Location'}
                </h3>
                <p className="text-[10px] text-slate-400">Warehouse: {selectedWarehouse.code}</p>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Location / Bay Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aisle 2 - Rack B"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Location Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A2-B"
                  value={locationForm.code}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full rounded-lg border border-slate-200 p-2.5 font-mono uppercase outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-md shadow-blue-200 disabled:opacity-50"
                >
                  {savingLocation ? 'Saving...' : editingLocation ? 'Update Location' : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
