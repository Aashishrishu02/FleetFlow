import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const PartnersView: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isEditPartnerOpen, setIsEditPartnerOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [newPartner, setNewPartner] = useState({
    name: '',
    code: '',
    contactEmail: '',
    contactPhone: '',
    partnerType: 'CARRIER_3PL',
    serviceableRegions: ['Midwest', 'North America'],
    maxActiveShipments: 50,
  });

  const [newVehicle, setNewVehicle] = useState({
    vehicleNumber: '',
    vehicleType: 'TRAILER_53FT',
    maxWeightCapacityKg: 18000,
  });

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.partners.findAll();
      setPartners(data);
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to load carriers');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient.partners.create({
        name: newPartner.name,
        code: newPartner.code,
        contactEmail: newPartner.contactEmail,
        contactPhone: newPartner.contactPhone,
        serviceType: newPartner.partnerType || 'STANDARD_ROAD',
        contractedRatePerKm: 1.45,
        activeCapacity: newPartner.maxActiveShipments || 50,
      });
      success('Carrier Onboarded', `Delivery partner ${newPartner.name} (${newPartner.code.toUpperCase()}) registered`);
      setIsAddPartnerOpen(false);
      setNewPartner({
        name: '',
        code: '',
        contactEmail: '',
        contactPhone: '',
        partnerType: 'CARRIER_3PL',
        serviceableRegions: ['Midwest', 'North America'],
        maxActiveShipments: 50,
      });
      fetchPartners();
    } catch (err: any) {
      toastError('Onboarding Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner) return;
    try {
      setSubmitting(true);
      await apiClient.partners.createVehicle(selectedPartner.id, {
        licensePlate: newVehicle.vehicleNumber,
        vehicleType: newVehicle.vehicleType,
        capacityKg: newVehicle.maxWeightCapacityKg,
      });
      success('Vehicle Registered', `Vehicle ${newVehicle.vehicleNumber} added to carrier fleet`);
      setIsAddVehicleOpen(false);
      setNewVehicle({
        vehicleNumber: '',
        vehicleType: 'TRAILER_53FT',
        maxWeightCapacityKg: 18000,
      });
      fetchPartners();
    } catch (err: any) {
      toastError('Vehicle Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePartner = async (partner: any) => {
    try {
      await apiClient.partners.delete(partner.id);
      success('Carrier Deleted', `Delivery partner ${partner.name} removed from fleet network`);
      fetchPartners();
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    try {
      setSubmitting(true);
      await apiClient.partners.update(editingPartner.id, {
        name: editingPartner.name,
        contactEmail: editingPartner.contactEmail,
        contactPhone: editingPartner.contactPhone,
        partnerType: editingPartner.partnerType,
        maxActiveShipments: Number(editingPartner.maxActiveShipments),
        status: editingPartner.status,
      });
      success('Carrier Updated', `Delivery partner ${editingPartner.name} updated successfully`);
      setIsEditPartnerOpen(false);
      setEditingPartner(null);
      fetchPartners();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalVehicles = partners.reduce((acc, p) => acc + (p.vehicles?.length || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs matching Reference Screen 9 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Delivery Partners</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">3PL & Dedicated Carrier Network</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Delivery Partners & Carrier Network</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage third-party logistics carriers, contracted freight partners, fleet vehicle capacities, and rate agreements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPartners}
            title="Refresh carriers"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Icons.Refresh size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAddPartnerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98]"
          >
            <Icons.Plus size={14} />
            <span>+ Onboard Delivery Partner</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip matching Reference Screen 9 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active Carriers"
          value={partners.length}
          subtitle="Contracted 3PL and dedicated fleet partners"
          trend="100% Verified"
          trendColor="green"
          icon={<Icons.Carrier size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Network On-Time SLA"
          value="98.2%"
          subtitle="Target: 97.5% across corridor"
          trend="Optimal"
          trendColor="green"
          icon={<Icons.Check size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Registered Fleet Vehicles"
          value={totalVehicles}
          subtitle="Tractors, box trucks & reefer trailers"
          trend={`${totalVehicles} Units`}
          trendColor="blue"
          icon={<Icons.Truck size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Avg Claims / Damage Ratio"
          value="0.14%"
          subtitle="Far below 0.5% industry benchmark"
          trend="Tier 1 Safe"
          trendColor="green"
          icon={<Icons.Shield size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Carriers Table Container */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200/90 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Contracted Carrier Directory</span>
            <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-mono font-bold">
              {partners.length}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search carrier by name or code..."
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
                <th className="py-3 px-4">Carrier Name & SCAC</th>
                <th className="py-3 px-4">Partner Classification</th>
                <th className="py-3 px-4">Active Capacity</th>
                <th className="py-3 px-4">Fleet Vehicles</th>
                <th className="py-3 px-4">On-Time Performance</th>
                <th className="py-3 px-4">Compliance Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.length > 0 ? (
                partners
                  .filter((p) => {
                    if (searchQuery && !p.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !p.code?.toLowerCase().includes(searchQuery.toLowerCase())) {
                      return false;
                    }
                    return true;
                  })
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[10px] text-blue-600 font-semibold">{p.code}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {p.partnerType || 'CARRIER_3PL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {p.maxActiveShipments || 50} Concurrent Loads
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {p.vehicles?.length || 0} Registered Units
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                        {p.onTimeRate || '98.50'}%
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status || 'ACTIVE'} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedPartner(p);
                            setIsAddVehicleOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors"
                        >
                          + Vehicle
                        </button>
                        <button
                          onClick={() => {
                            setEditingPartner({ ...p });
                            setIsEditPartnerOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePartner(p)}
                          className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-[11px] font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No delivery partners registered yet. Click "+ Onboard Delivery Partner" to add contracted carriers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Partner Modal */}
      {isAddPartnerOpen && (
        <Modal
          isOpen={isAddPartnerOpen}
          onClose={() => setIsAddPartnerOpen(false)}
          title="Onboard Delivery Partner Carrier"
          subtitle="Provision a contracted carrier into the regional dispatch network."
          maxWidth="md"
        >
          <form onSubmit={handleCreatePartner} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Carrier Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Swift Road Freight Express"
                value={newPartner.name}
                onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Carrier Code / SCAC *</label>
                <input
                  type="text"
                  required
                  placeholder="SWFT"
                  value={newPartner.code}
                  onChange={(e) => setNewPartner({ ...newPartner, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Classification</label>
                <select
                  value={newPartner.partnerType}
                  onChange={(e) => setNewPartner({ ...newPartner, partnerType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="CARRIER_3PL">3PL Contracted Carrier</option>
                  <option value="DEDICATED">Dedicated Private Fleet</option>
                  <option value="LAST_MILE_COURIER">Last-Mile Courier</option>
                  <option value="FREIGHT_FORWARDER">Freight Forwarder</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Email *</label>
                <input
                  type="email"
                  required
                  placeholder="dispatch@swiftlogistics.com"
                  value={newPartner.contactEmail}
                  onChange={(e) => setNewPartner({ ...newPartner, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Active Capacity (Loads) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newPartner.maxActiveShipments}
                  onChange={(e) => setNewPartner({ ...newPartner, maxActiveShipments: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddPartnerOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Onboarding...' : 'Onboard Partner'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Vehicle Modal */}
      {isAddVehicleOpen && selectedPartner && (
        <Modal
          isOpen={isAddVehicleOpen}
          onClose={() => setIsAddVehicleOpen(false)}
          title={`Register Fleet Vehicle`}
          subtitle={`Assign an active power unit or trailer to ${selectedPartner.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleCreateVehicle} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">License Plate / Vehicle # *</label>
              <input
                type="text"
                required
                placeholder="IL-TX-8821"
                value={newVehicle.vehicleNumber}
                onChange={(e) => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Classification *</label>
                <select
                  value={newVehicle.vehicleType}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vehicleType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="TRAILER_53FT">53ft Dry Van Trailer</option>
                  <option value="REEFER">53ft Refrigerated Trailer</option>
                  <option value="FLATBED">Flatbed Heavy Hauler</option>
                  <option value="BOX_TRUCK">26ft Box Truck</option>
                  <option value="SPRINTER">Sprinter Courier Van</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payload Capacity (KG) *</label>
                <input
                  type="number"
                  required
                  min={100}
                  value={newVehicle.maxWeightCapacityKg}
                  onChange={(e) => setNewVehicle({ ...newVehicle, maxWeightCapacityKg: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddVehicleOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Registering...' : 'Register Vehicle'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Partner Modal */}
      {isEditPartnerOpen && editingPartner && (
        <Modal
          isOpen={isEditPartnerOpen}
          onClose={() => {
            setIsEditPartnerOpen(false);
            setEditingPartner(null);
          }}
          title={`Edit Carrier: ${editingPartner.name}`}
          subtitle={`SCAC Code: ${editingPartner.code}`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdatePartner} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Carrier Name *</label>
              <input
                type="text"
                required
                value={editingPartner.name || ''}
                onChange={(e) => setEditingPartner({ ...editingPartner, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Email *</label>
                <input
                  type="email"
                  required
                  value={editingPartner.contactEmail || ''}
                  onChange={(e) => setEditingPartner({ ...editingPartner, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={editingPartner.contactPhone || ''}
                  onChange={(e) => setEditingPartner({ ...editingPartner, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Classification *</label>
                <select
                  value={editingPartner.partnerType || 'CARRIER_3PL'}
                  onChange={(e) => setEditingPartner({ ...editingPartner, partnerType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="CARRIER_3PL">3PL Carrier</option>
                  <option value="DEDICATED_FLEET">Dedicated Fleet</option>
                  <option value="FREIGHT_FORWARDER">Freight Forwarder</option>
                  <option value="LAST_MILE_COURIER">Last-Mile Courier</option>
                  <option value="RAIL_INTERMODAL">Rail Intermodal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Shipments</label>
                <input
                  type="number"
                  min={1}
                  value={editingPartner.maxActiveShipments || 50}
                  onChange={(e) => setEditingPartner({ ...editingPartner, maxActiveShipments: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={editingPartner.status || 'ACTIVE'}
                  onChange={(e) => setEditingPartner({ ...editingPartner, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditPartnerOpen(false);
                  setEditingPartner(null);
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
    </div>
  );
};
