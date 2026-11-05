import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';
import { useToast } from '../../context/ToastContext';

interface SecurityAuditViewProps {
  initialTab?: 'rbac' | 'keys' | 'audit';
}

const RBAC_PERMISSIONS_MATRIX = [
  { module: 'Tenant & Members', owner: 'Full', ops: 'Read', whMgr: 'None', whOp: 'None', partner: 'None', fin: 'None', auditor: 'Read' },
  { module: 'Warehouses & Zones', owner: 'Full', ops: 'Full', whMgr: 'Manage', whOp: 'Read', partner: 'None', fin: 'Read', auditor: 'Read' },
  { module: 'Products Catalog', owner: 'Full', ops: 'Full', whMgr: 'Read', whOp: 'Read', partner: 'None', fin: 'Read', auditor: 'Read' },
  { module: 'Inventory Movements', owner: 'Full', ops: 'Full', whMgr: 'Full', whOp: 'Execute', partner: 'None', fin: 'Read', auditor: 'Read' },
  { module: 'Orders & Allocation', owner: 'Full', ops: 'Full', whMgr: 'Read', whOp: 'Read', partner: 'None', fin: 'Read', auditor: 'Read' },
  { module: 'Shipments & Tracking', owner: 'Full', ops: 'Full', whMgr: 'Manage', whOp: 'Checkpoints', partner: 'Assigned Only', fin: 'Read', auditor: 'Read' },
  { module: 'Carrier Fleet', owner: 'Full', ops: 'Full', whMgr: 'Read', whOp: 'None', partner: 'Self Fleet', fin: 'Payables', auditor: 'Read' },
  { module: 'Reverse Logistics (RMA)', owner: 'Full', ops: 'Full', whMgr: 'Triage/QA', whOp: 'Receive', partner: 'None', fin: 'Refunds', auditor: 'Read' },
  { module: 'Pricing & Tariffs', owner: 'Full', ops: 'Read', whMgr: 'None', whOp: 'None', partner: 'None', fin: 'Full', auditor: 'Read' },
  { module: 'Invoices & Reconciliation', owner: 'Full', ops: 'Read', whMgr: 'None', whOp: 'None', partner: 'Invoices', fin: 'Full', auditor: 'Read' },
  { module: 'API Keys & Audit Trails', owner: 'Full', ops: 'Audit', whMgr: 'None', whOp: 'None', partner: 'None', fin: 'None', auditor: 'Read' },
];

export const SecurityAuditView: React.FC<SecurityAuditViewProps> = ({
  initialTab = 'keys',
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'rbac' | 'keys' | 'audit'>(initialTab);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Key creation state
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({
    name: 'Logistics WMS Integrator Token',
    scopes: ['read', 'write'],
    expiresDays: 90,
  });
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [keys, logs] = await Promise.all([
        apiClient.security.getApiKeys(),
        apiClient.security.getAuditLogs({ limit: 50 }),
      ]);
      setApiKeys(keys);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch security credentials');
      addToast('error', err.message || 'Failed to load security audit data');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingKey(true);
      const res = await apiClient.security.createApiKey(keyForm);
      setCreatedKeySecret(res.token);
      addToast('success', 'API key generated and hashed via SHA-256');
      fetchData();
    } catch (err: any) {
      addToast('error', `API key generation failed: ${err.message}`);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string, name: string) => {
    try {
      await apiClient.security.revokeApiKey(id);
      addToast('info', `Revoked access token: ${name}`);
      fetchData();
    } catch (err: any) {
      addToast('error', `Revoke failed: ${err.message}`);
    }
  };

  if (loading && apiKeys.length === 0 && auditLogs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading security & forensic credentials...</p>
        </div>
      </div>
    );
  }

  if (error && apiKeys.length === 0) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
        <p className="text-sm font-semibold text-rose-800">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Security, RBAC & Forensic Audit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold">
              <Icons.Shield size={12} className="text-blue-600" />
              SHA-256 Hashed Tokens
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Role-Based Access Control matrix, machine-to-machine API credentials, and append-only forensic compliance audit trails.
          </p>
        </div>

        {/* Tab Controls & Action Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('keys')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'keys'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              API Keys ({apiKeys.length})
            </button>
            <button
              onClick={() => setActiveTab('rbac')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'rbac'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RBAC Matrix
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
          </div>

          {activeTab === 'keys' && (
            <button
              onClick={() => {
                setCreatedKeySecret(null);
                setIsKeyModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Icons.Plus size={14} />
              <span>Provision API Key</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Active Machine Keys"
          value={apiKeys.filter((k) => k.isActive).length}
          subtitle="Provisioned service integration tokens"
          icon={<Icons.Key size={18} className="text-blue-600" />}
          color="blue"
          trend={`${apiKeys.filter((k) => k.isActive).length} active`}
          trendDirection="up"
        />
        <StatCard
          title="Forensic Audit Records"
          value={auditLogs.length}
          subtitle="Immutable recorded mutations"
          icon={<Icons.Audit size={18} className="text-emerald-600" />}
          color="emerald"
          trend="Append-only"
        />
        <StatCard
          title="Hashing Algorithm"
          value="SHA-256"
          subtitle="Salted at rest; unrecoverable plaintexts"
          icon={<Icons.Shield size={18} className="text-purple-600" />}
          color="violet"
        />
      </div>

      {/* TAB 1: API KEYS TABLE */}
      {activeTab === 'keys' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Machine-to-Machine API Tokens</h2>
              <p className="text-xs text-slate-500">
                Authorized credentials for external WMS, ERP, and delivery carrier telematics ingestion.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Key Identifier</th>
                  <th className="py-3 px-4">Token Prefix</th>
                  <th className="py-3 px-4">Granted Scopes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Icons.Key size={14} className="text-slate-400" />
                        <span className="font-semibold text-slate-900">{key.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {key.keyPrefix}••••••••
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1">
                        {(key.scopes || []).map((s: string) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono uppercase"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={key.isActive ? 'ACTIVE' : 'REVOKED'} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {key.isActive && (
                        <button
                          onClick={() => handleRevokeApiKey(key.id, key.name)}
                          className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md text-[11px] font-semibold transition-colors"
                        >
                          Revoke Key
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200/80">
            <h2 className="text-sm font-bold text-slate-900">
              Role-Based Access Control (RBAC) Governance Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly enforced across all NestJS controller endpoints via TenantRolesGuard & JwtAuthGuard.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Subsystem Module</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Ops Mgr</th>
                  <th className="py-3 px-3">WH Mgr</th>
                  <th className="py-3 px-3">WH Operator</th>
                  <th className="py-3 px-3">Delivery Partner</th>
                  <th className="py-3 px-3">Finance Mgr</th>
                  <th className="py-3 px-3">Auditor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {RBAC_PERMISSIONS_MATRIX.map((row) => (
                  <tr key={row.module} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{row.module}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold">
                        {row.owner}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                        {row.ops}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                        {row.whMgr}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                        {row.whOp}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                        {row.partner}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                        {row.fin}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-semibold">
                        {row.auditor}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAILS */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Append-Only Forensic Mutation Trail (Last 50 Events)
              </h2>
              <p className="text-xs text-slate-500">
                Tamper-evident logs recording state transitions, inventory adjustments, and carrier dispatches.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              Live Stream
            </span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No audit log entries recorded in this window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource Target</th>
                    <th className="py-3 px-4">Origin IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {log.actorEmail || log.actorId || 'SYSTEM'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-sans">
                        <span className="font-semibold text-slate-900">{log.resourceType}:</span>{' '}
                        <span className="font-mono text-slate-500">{log.resourceId?.slice(0, 10) || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Generate API Key Modal */}
      {isKeyModalOpen && (
        <Modal
          isOpen={isKeyModalOpen}
          onClose={() => setIsKeyModalOpen(false)}
          title="Provision Machine API Token"
          maxWidth="md"
        >
          {createdKeySecret ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                  <Icons.Check size={16} />
                  <span>API Key Generated & Stored as SHA-256 Hash</span>
                </div>
                <p className="text-xs text-slate-700">
                  Copy this key now. For your security, this plain-text secret token will <strong>never be shown again</strong>:
                </p>
                <div className="p-3 bg-white rounded-lg border border-emerald-300 font-mono text-xs text-emerald-900 break-all select-all font-semibold">
                  {createdKeySecret}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  I Have Stored the Key Safely
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateApiKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Key Description / Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ERP Ingestion Service"
                  value={keyForm.name}
                  onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expiration Validity Period
                </label>
                <select
                  value={keyForm.expiresDays}
                  onChange={(e) => setKeyForm({ ...keyForm, expiresDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={365}>1 Year</option>
                  <option value={0}>Never Expire</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {creatingKey && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Generate Hashed Key</span>
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
