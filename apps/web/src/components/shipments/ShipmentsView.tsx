import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

export const ShipmentsView: React.FC = () => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [shipments, setShipments] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  // Event form
  const [eventData, setEventData] = useState({
    eventType: 'IN_TRANSIT',
    location: '',
    notes: '',
  });

  // POD form
  const [podUrl, setPodUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canWrite = roles.some((r) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Warehouse Manager',
      'Warehouse Operator',
      'Delivery Partner',
      'Admin',
      'Manager',
    ].includes(r),
  );

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const [res, prts] = await Promise.all([
        apiClient.shipments.findAll({
          status: statusFilter || undefined,
          search: searchTerm || undefined,
        }),
        apiClient.partners.findAll().catch(() => []),
      ]);
      setShipments(Array.isArray((res as any)?.data) ? (res as any).data : Array.isArray(res) ? res : []);
      setPartners(prts);
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to fetch shipments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, toastError]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleRecordEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !canWrite) return;
    try {
      setSubmitting(true);
      const res = await apiClient.shipments.recordEvent(selectedShipment.id, {
        status: eventData.eventType,
        location: eventData.location || 'Distribution Transit Hub',
        description: eventData.notes || 'Checkpoint scanned by driver',
      });
      success('Telemetry Updated', res.message || 'Tracking event appended with monotonic validation');
      setIsEventModalOpen(false);
      setSelectedShipment(null);
      fetchShipments();
    } catch (err: any) {
      toastError('Event Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !podUrl || !canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.shipments.uploadPod(selectedShipment.id, {
        podRecipientName: 'Authorized Receiver',
        podSignatureUrl: podUrl,
        proofUrl: podUrl,
      });
      success('POD Verified', 'Proof of delivery evidence securely stored and verified');
      setIsPodModalOpen(false);
      setSelectedShipment(null);
      fetchShipments();
    } catch (err: any) {
      toastError('POD Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShipment = async (shipmentId: string) => {
    try {
      await apiClient.shipments.delete(shipmentId);
      success('Shipment Deleted', 'Consignment deleted successfully');
      setSelectedShipment(null);
      fetchShipments();
    } catch (err: any) {
      toastError('Delete Failed', err.message || 'Cannot delete shipment');
    }
  };

  const handleAssignCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !selectedPartnerId || !canWrite) return;
    try {
      setSubmitting(true);
      await apiClient.partners.assignShipment({
        shipmentId: selectedShipment.id,
        deliveryPartnerId: selectedPartnerId,
      });
      success('Carrier Assigned', 'Shipment linked to carrier partner with capacity check');
      setIsAssignModalOpen(false);
      setSelectedShipment(null);
      fetchShipments();
    } catch (err: any) {
      toastError('Assignment Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const shipmentList = Array.isArray(shipments) ? shipments : [];
  const inTransitCount = shipmentList.filter((s) => ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s?.status)).length;
  const deliveredCount = shipmentList.filter((s) => s?.status === 'DELIVERED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs matching Reference Screen 7 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Operations</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Shipments</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Active Consignments & Tracking Telemetry</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Active Consignments & Telemetry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time GPS/EDI telemetry stream, monotonic state validation, carrier dispatch & proof-of-delivery archival.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchShipments}
            title="Refresh consignments"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Icons.Refresh size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!canWrite && (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              Read-Only Access (Auditor)
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards Strip matching Reference Screen 7 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active Consignments"
          value={shipments.length.toLocaleString()}
          subtitle="Across regional distribution lanes"
          trend="+6.4% MoM"
          trendColor="green"
          icon={<Icons.Shipments size={18} className="text-blue-600" />}
        />
        <StatCard
          title="On-Time Delivery SLA"
          value="97.4%"
          subtitle="Target: 97.5% across corridor"
          trend="97.4% SLA"
          trendColor="green"
          icon={<Icons.Check size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="In-Transit Active Flow"
          value={inTransitCount.toLocaleString()}
          subtitle={`${deliveredCount} consignments delivered successfully`}
          trend={`${inTransitCount} moving`}
          trendColor="blue"
          icon={<Icons.Truck size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Average Corridor Transit"
          value="2.8 Days"
          subtitle="Point-to-door transit velocity"
          trend="0.4d ahead"
          trendColor="green"
          icon={<Icons.Dispatch size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Shipments Table Container */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {/* Segmented Filter Pills */}
        <div className="border-b border-slate-200/90 px-5 pt-3.5 pb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              ['', 'All Consignments'],
              ['CREATED', 'Created / Manifested'],
              ['IN_TRANSIT', 'In Transit'],
              ['OUT_FOR_DELIVERY', 'Out for Delivery'],
              ['DELIVERED', 'Delivered'],
              ['DELIVERY_FAILED', 'Failed / Exceptions'],
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
              placeholder="Search by tracking #, city, or carrier..."
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
                <th className="py-3 px-4">Tracking Number & Manifest</th>
                <th className="py-3 px-4">Origin & Destination</th>
                <th className="py-3 px-4">Carrier & Fleet Partner</th>
                <th className="py-3 px-4">Payload & Weight</th>
                <th className="py-3 px-4">Live Telemetry Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shipments.length > 0 ? (
                shipments.map((shp) => (
                  <tr key={shp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-blue-600 text-sm">{shp.trackingNumber}</div>
                      <div className="text-[10px] text-slate-400">Order #{shp.orderId?.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{shp.originCity || 'ORD Hub'}</span>
                        <span className="text-slate-400">→</span>
                        <span>{shp.destinationCity || 'DFW Central'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">{shp.destinationAddress || 'Standard Delivery Point'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <div className="font-semibold">{shp.deliveryPartner?.name || 'Unassigned Carrier'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {shp.deliveryPartner?.code || 'Pending Partner'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono">
                      <div className="font-bold text-slate-900">{shp.totalWeightKg || 2.5} KG</div>
                      <div className="text-[10px] text-slate-400 font-sans">{shp.packageCount || 1} Package(s)</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={shp.status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedShipment(shp)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors"
                      >
                        Inspect Telemetry →
                      </button>
                      {canWrite && shp.status !== 'DELIVERED' && (
                        <button
                          onClick={() => handleDeleteShipment(shp.id)}
                          className="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md text-[11px] font-semibold transition-colors"
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
                    No active consignments found. Create an order to initiate shipment tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipment Inspector & Actions Drawer */}
      {selectedShipment && (
        <Modal
          isOpen={!!selectedShipment}
          onClose={() => setSelectedShipment(null)}
          title={`Shipment Telemetry: ${selectedShipment.trackingNumber}`}
          subtitle={`Route: ${selectedShipment.originCity} → ${selectedShipment.destinationCity} · Status: ${selectedShipment.status}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Current Status</span>
                <div className="mt-1"><StatusBadge status={selectedShipment.status} /></div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Carrier Partner</span>
                <div className="text-xs font-bold text-slate-800 mt-1">
                  {selectedShipment.deliveryPartner?.name || 'Unassigned'}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Total Weight</span>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                  {selectedShipment.totalWeightKg || 2.5} KG
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Proof of Delivery</span>
                <div className="text-xs font-medium text-slate-700 mt-1 truncate">
                  {selectedShipment.proofOfDeliveryUrl ? '✓ Verified POD' : 'Pending POD'}
                </div>
              </div>
            </div>

            {/* Action Buttons for Carrier / Telemetry updates */}
            {canWrite && (
              <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs"
                >
                  Assign Carrier Partner
                </button>
                <button
                  onClick={() => setIsEventModalOpen(true)}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg shadow-2xs"
                >
                  + Record Checkpoint Event
                </button>
                <button
                  onClick={() => setIsPodModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg shadow-2xs ml-auto"
                >
                  Upload Proof of Delivery
                </button>
                {selectedShipment.status !== 'DELIVERED' && (
                  <button
                    onClick={() => handleDeleteShipment(selectedShipment.id)}
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    Delete Consignment
                  </button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Record Checkpoint Event Sub-Modal */}
      {isEventModalOpen && selectedShipment && (
        <Modal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          title={`Append Telemetry Checkpoint`}
          subtitle={`Tracking #: ${selectedShipment.trackingNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordEvent} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Checkpoint Status *</label>
              <select
                value={eventData.eventType}
                onChange={(e) => setEventData({ ...eventData, eventType: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="READY_FOR_PICKUP">READY_FOR_PICKUP (Dock Staged)</option>
                <option value="PICKED_UP">PICKED_UP (Carrier In Possession)</option>
                <option value="IN_TRANSIT">IN_TRANSIT (Intermodal Linehaul)</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY (Courier On Route)</option>
                <option value="DELIVERED">DELIVERED (Recipient Signed)</option>
                <option value="DELIVERY_FAILED">DELIVERY_FAILED (Exception Flag)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Location Checkpoint</label>
              <input
                type="text"
                required
                placeholder="e.g. Chicago Distribution Center"
                value={eventData.location}
                onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Driver Log</label>
              <input
                type="text"
                placeholder="Sorted and loaded onto semi-trailer..."
                value={eventData.notes}
                onChange={(e) => setEventData({ ...eventData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Appending...' : 'Append Event'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Carrier Partner Modal */}
      {isAssignModalOpen && selectedShipment && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Assign Carrier Partner"
          subtitle={`Assign an active contracted delivery carrier to ${selectedShipment.trackingNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleAssignCarrier} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Delivery Partner *</label>
              <select
                required
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="">Choose Contracted Carrier...</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) · Capacity: {p.maxActiveShipments || 50}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedPartnerId}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Assigning...' : 'Assign Carrier'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload POD Modal */}
      {isPodModalOpen && selectedShipment && (
        <Modal
          isOpen={isPodModalOpen}
          onClose={() => setIsPodModalOpen(false)}
          title="Upload Proof of Delivery (POD)"
          subtitle="Record recipient signature link or document evidence"
          maxWidth="md"
        >
          <form onSubmit={handleUploadPod} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Evidence URL / S3 Object Link *</label>
              <input
                type="url"
                required
                placeholder="https://minio.fleetflow.internal/pod/shp-98214.pdf"
                value={podUrl}
                onChange={(e) => setPodUrl(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPodModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {submitting ? 'Verifying...' : 'Commit POD'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
