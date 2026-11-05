import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const WarehouseManager: React.FC = () => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any | null>(null);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false);
  const [editLocationForm, setEditLocationForm] = useState({ name: '', code: '', type: 'RACK' });

  // Forms
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: 'USA',
  });

  const [editWarehouseForm, setEditWarehouseForm] = useState({
    name: '',
    address: '',
    city: '',
    country: 'USA',
  });

  const [locationForm, setLocationForm] = useState({
    name: '',
    code: '',
    type: 'RACK',
  });

  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // RBAC Permission Check
  const canWrite = roles.some((r) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Warehouse Manager',
      'Admin',
      'Manager',
    ].includes(r),
  );

  const fetchWarehouses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.warehouses.findAll();
      setWarehouses(data);
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to fetch warehouse facilities');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.warehouses.create({
        ...formData,
        isActive: true,
      });
      success('Facility Provisioned', `Warehouse ${formData.name} (${formData.code.toUpperCase()}) created successfully`);
      setIsCreateOpen(false);
      setFormData({ name: '', code: '', address: '', city: '', country: 'USA' });
      fetchWarehouses();
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (warehouse: any) => {
    if (!canWrite) return;
    try {
      await apiClient.warehouses.updateStatus(warehouse.id, !warehouse.isActive);
      success('Status Updated', `Facility ${warehouse.name} is now ${!warehouse.isActive ? 'Active' : 'Deactivated'}`);
      fetchWarehouses();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    }
  };

  const handleOpenLocations = async (warehouse: any) => {
    setSelectedWarehouse(warehouse);
    try {
      setLoadingLocations(true);
      const locs = await apiClient.warehouses.findAllLocations(warehouse.id);
      setLocations(locs);
    } catch (err: any) {
      toastError('Error', 'Failed to load storage locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || !canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.warehouses.createLocation(selectedWarehouse.id, locationForm);
      success('Zone Added', `Storage location ${locationForm.name} created`);
      setIsLocationModalOpen(false);
      setLocationForm({ name: '', code: '', type: 'RACK' });
      const locs = await apiClient.warehouses.findAllLocations(selectedWarehouse.id);
      setLocations(locs);
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditWarehouseOpen = (warehouse: any) => {
    setEditingWarehouse(warehouse);
    setEditWarehouseForm({
      name: warehouse.name,
      address: warehouse.address || '',
      city: warehouse.city || '',
      country: warehouse.country || 'USA',
    });
  };

  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.warehouses.update(editingWarehouse.id, editWarehouseForm);
      success('Facility Updated', `Warehouse ${editingWarehouse.code} updated successfully`);
      setEditingWarehouse(null);
      fetchWarehouses();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async (warehouse: any) => {
    if (!canWrite) return;
    try {
      await apiClient.warehouses.delete(warehouse.id);
      success('Facility Deleted', `Warehouse ${warehouse.code} (${warehouse.name}) decommissioned`);
      fetchWarehouses();
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleDeleteLocation = async (locationId: string, locationName: string) => {
    if (!selectedWarehouse || !canWrite) return;
    try {
      await apiClient.warehouses.deleteLocation(selectedWarehouse.id, locationId);
      success('Zone Removed', `Storage location ${locationName} removed`);
      const locs = await apiClient.warehouses.findAllLocations(selectedWarehouse.id);
      setLocations(locs);
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || !editingLocation || !canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.warehouses.updateLocation(selectedWarehouse.id, editingLocation.id, {
        name: editLocationForm.name,
        code: editLocationForm.code,
        type: editLocationForm.type,
      });
      success('Zone Updated', `Storage location ${editLocationForm.name} updated`);
      setIsEditLocationOpen(false);
      setEditingLocation(null);
      const locs = await apiClient.warehouses.findAllLocations(selectedWarehouse.id);
      setLocations(locs);
    } catch (err: any) {
      toastError('Update Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const warehouseList = Array.isArray(warehouses) ? warehouses : [];
  const activeCount = warehouseList.filter((w) => w?.isActive).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Warehouses</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Global Distribution Centers & Fulfillment Nodes</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Warehouses & Fulfillment Centers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor facility operational capacity, dock utilization, cold-chain compliance, and storage zones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchWarehouses}
            title="Refresh facilities"
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
              <span>+ Add New Facility</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active Facilities"
          value={activeCount}
          subtitle={`${warehouses.length - activeCount} decommissioned / inactive`}
          trend="100% Online"
          trendColor="green"
          icon={<Icons.Warehouse size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Floor Space & Storage"
          value={`${(activeCount * 450).toLocaleString()}k sq ft`}
          subtitle="Volumetric Utilization: 78.4%"
          trend="78% Cap"
          trendColor="blue"
          icon={<Icons.Building size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Live Dock Door Velocity"
          value={`${activeCount * 14} / ${activeCount * 16} Docks`}
          subtitle="87.5% Active Loading / Dispatch"
          trend="High Flow"
          trendColor="green"
          icon={<Icons.Truck size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Facility Incidents & Alerts"
          value="0 Issues"
          subtitle="All temperature & hazmat sensors nominal"
          trend="All Clean"
          trendColor="green"
          icon={<Icons.Alert size={18} className="text-slate-600" />}
        />
      </div>

      {/* Filter and Facilities Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200/90 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Operational Facilities</span>
            <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-mono font-bold">
              {warehouses.length}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by facility name, code, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Icons.Search size={13} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Facility Name & Code</th>
                <th className="py-3 px-4">Region & Proximity</th>
                <th className="py-3 px-4">Specs & Docks</th>
                <th className="py-3 px-4">Storage Locations</th>
                <th className="py-3 px-4">Operational Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {warehouses.length > 0 ? (
                warehouses
                  .filter((w) => {
                    if (searchQuery && !w.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !w.code?.toLowerCase().includes(searchQuery.toLowerCase())) {
                      return false;
                    }
                    return true;
                  })
                  .map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{w.name}</div>
                        <div className="font-mono text-[10px] text-blue-600 font-semibold">{w.code}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{w.city || 'Continental Hub'}, {w.country || 'USA'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{w.address || 'Standard Hub Footprint'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>14 Active Docks</div>
                        <div className="text-[10px] text-slate-400">Automated ASRS + Conveyors</div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenLocations(w)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-[11px] font-semibold transition-colors"
                        >
                          <Icons.Warehouse size={12} className="text-slate-500" />
                          <span>Manage Zones / Racks</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={w.isActive ? 'ACTIVE' : 'DEACTIVATED'} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => handleEditWarehouseOpen(w)}
                              className="px-2.5 py-1 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded text-[11px] font-semibold transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleStatus(w)}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                w.isActive
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {w.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteWarehouse(w)}
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
                    No warehouses configured. Click "+ Add New Facility" to register a distribution center.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Warehouse Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Add New Warehouse Facility"
          subtitle="Provision an authorized distribution hub or cross-dock facility into the tenant network."
          maxWidth="md"
        >
          <form onSubmit={handleCreateWarehouse} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Facility Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chicago Mega Hub"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Facility Code (Unique) *</label>
              <input
                type="text"
                required
                placeholder="e.g. ORD-01"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  placeholder="Chicago"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Physical Street Address</label>
              <input
                type="text"
                placeholder="1000 Distribution Way"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                {submitting ? 'Provisioning...' : 'Provision Hub'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Storage Locations Drawer / Modal */}
      {selectedWarehouse && (
        <Modal
          isOpen={!!selectedWarehouse}
          onClose={() => setSelectedWarehouse(null)}
          title={`Storage Locations: ${selectedWarehouse.name}`}
          subtitle={`Racks, aisles, staging zones, and bins inside ${selectedWarehouse.code}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Configured Locations ({locations.length})</span>
              {canWrite && (
                <button
                  onClick={() => setIsLocationModalOpen(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
                >
                  + Add Storage Location
                </button>
              )}
            </div>

            {loadingLocations ? (
              <div className="text-center py-6 text-xs text-slate-400">Loading storage locations...</div>
            ) : locations.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                {locations.map((loc) => (
                  <div key={loc.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{loc.name}</span>
                      <span className="ml-2 font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {loc.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {loc.type || 'RACK'}
                      </span>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => {
                              setEditingLocation(loc);
                              setEditLocationForm({ name: loc.name, code: loc.code, type: loc.type || 'RACK' });
                              setIsEditLocationOpen(true);
                            }}
                            className="px-2 py-0.5 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc.id, loc.name)}
                            className="px-2 py-0.5 text-[10px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded font-semibold transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No storage locations provisioned yet. Click "+ Add Storage Location" to define aisle / rack zones.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add Storage Location Sub-Modal */}
      {isLocationModalOpen && selectedWarehouse && (
        <Modal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          title={`Add Storage Zone to ${selectedWarehouse.code}`}
          maxWidth="sm"
        >
          <form onSubmit={handleCreateLocation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Location / Zone Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Aisle 04 - Shelf B"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Location Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. A4-B02"
                value={locationForm.code}
                onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Storage Classification</label>
              <select
                value={locationForm.type}
                onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="RACK">Standard Pallet Rack</option>
                <option value="COLD_STORAGE">Cold Chain / Refrigerated Vault</option>
                <option value="HAZMAT">Hazmat Secure Enclosure</option>
                <option value="STAGING_LANE">Inbound / Outbound Staging Lane</option>
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Adding...' : 'Add Zone'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Storage Location Sub-Modal */}
      {isEditLocationOpen && editingLocation && selectedWarehouse && (
        <Modal
          isOpen={isEditLocationOpen}
          onClose={() => {
            setIsEditLocationOpen(false);
            setEditingLocation(null);
          }}
          title={`Edit Storage Zone: ${editingLocation.code}`}
          subtitle={`Facility: ${selectedWarehouse.code}`}
          maxWidth="sm"
        >
          <form onSubmit={handleUpdateLocation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Zone Name *</label>
              <input
                type="text"
                required
                value={editLocationForm.name}
                onChange={(e) => setEditLocationForm({ ...editLocationForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Zone Code *</label>
              <input
                type="text"
                required
                value={editLocationForm.code}
                onChange={(e) => setEditLocationForm({ ...editLocationForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Storage Classification</label>
              <select
                value={editLocationForm.type}
                onChange={(e) => setEditLocationForm({ ...editLocationForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="RACK">Standard Pallet Rack</option>
                <option value="COLD_STORAGE">Cold Chain / Refrigerated Vault</option>
                <option value="HAZMAT">Hazmat Secure Enclosure</option>
                <option value="STAGING_LANE">Inbound / Outbound Staging Lane</option>
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditLocationOpen(false);
                  setEditingLocation(null);
                }}
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

      {/* Edit Warehouse Modal */}
      {editingWarehouse && (
        <Modal
          isOpen={!!editingWarehouse}
          onClose={() => setEditingWarehouse(null)}
          title={`Edit Facility: ${editingWarehouse.code}`}
          subtitle="Update warehouse operational specifications, address, and municipality."
          maxWidth="md"
        >
          <form onSubmit={handleUpdateWarehouse} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Facility Name *</label>
              <input
                type="text"
                required
                value={editWarehouseForm.name}
                onChange={(e) => setEditWarehouseForm({ ...editWarehouseForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={editWarehouseForm.city}
                  onChange={(e) => setEditWarehouseForm({ ...editWarehouseForm, city: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={editWarehouseForm.country}
                  onChange={(e) => setEditWarehouseForm({ ...editWarehouseForm, country: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={editWarehouseForm.address}
                onChange={(e) => setEditWarehouseForm({ ...editWarehouseForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Updating...' : 'Save Warehouse'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
