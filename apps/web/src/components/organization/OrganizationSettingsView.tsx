import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';
import { useToast } from '../../context/ToastContext';

interface OrganizationSettingsViewProps {
  initialTab?: 'organizations' | 'members' | 'settings';
}

export const OrganizationSettingsView: React.FC<OrganizationSettingsViewProps> = ({
  initialTab = 'organizations',
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'organizations' | 'members' | 'settings'>(initialTab);
  const [orgData, setOrgData] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    defaultCurrency: 'USD',
    operatingTimezone: 'UTC',
    autoAllocationEnabled: true,
    reorderAlertThreshold: 10,
    distanceWeight: 0.40,
    costWeight: 0.40,
    splitWeight: 0.20,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    roleName: 'Operations Manager',
  });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [current, mems] = await Promise.all([
        apiClient.organizations.getCurrent(),
        apiClient.organizations.getMembers(),
      ]);
      setOrgData(current);
      setMembers(mems);

      if (current.settings) {
        setSettingsForm({
          defaultCurrency: current.settings.defaultCurrency || 'USD',
          operatingTimezone: current.settings.operatingTimezone || 'UTC',
          autoAllocationEnabled: current.settings.autoAllocationEnabled ?? true,
          reorderAlertThreshold: current.settings.reorderAlertThreshold ?? 10,
          distanceWeight: Number(current.settings.distanceWeight || 0.4),
          costWeight: Number(current.settings.costWeight || 0.4),
          splitWeight: Number(current.settings.splitWeight || 0.2),
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch organization settings');
      addToast('error', err.message || 'Failed to load organization profile');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum = settingsForm.distanceWeight + settingsForm.costWeight + settingsForm.splitWeight;
    if (Math.abs(sum - 1.0) > 0.05) {
      addToast('warning', `Optimization weights must sum to 1.00 (Current sum: ${sum.toFixed(2)})`);
      return;
    }

    try {
      setSavingSettings(true);
      await apiClient.organizations.updateSettings(settingsForm);
      addToast('success', 'Enterprise allocation parameters and system settings saved successfully');
      fetchData();
    } catch (err: any) {
      addToast('error', `Failed to update settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInviting(true);
      await apiClient.organizations.inviteMember(inviteForm);
      addToast('success', `Team member ${inviteForm.name} provisioned successfully with role ${inviteForm.roleName}`);
      setIsInviteOpen(false);
      setInviteForm({ name: '', email: '', roleName: 'Operations Manager' });
      fetchData();
    } catch (err: any) {
      addToast('error', `Invitation failed: ${err.message}`);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (membershipId: string, memberName: string) => {
    try {
      await apiClient.organizations.removeMember(membershipId);
      addToast('info', `Suspended access for ${memberName}`);
      fetchData();
    } catch (err: any) {
      addToast('error', `Action failed: ${err.message}`);
    }
  };

  if (loading && !orgData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading organization configuration...</p>
        </div>
      </div>
    );
  }

  if (error && !orgData) {
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Organization & Tenant Control
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Tenant: {orgData?.slug || 'fleetflow-primary'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise multi-tenancy management, deterministic allocation optimization weights, and member RBAC directory.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'organizations'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Organizations
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'members'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Global Settings
          </button>
        </div>
      </div>

      {/* Top Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tenant Name"
          value={orgData?.name || 'FleetFlow Corp'}
          subtitle={`Identifier: ${orgData?.id ? orgData.id.slice(0, 12) + '...' : 'active'}`}
          icon={<Icons.Building size={18} className="text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Active Members"
          value={members.length}
          subtitle="Provisioned users across 7 RBAC roles"
          icon={<Icons.Users size={18} className="text-emerald-600" />}
          color="emerald"
          trend={`${members.length} active`}
          trendDirection="up"
        />
        <StatCard
          title="Logistics Hubs"
          value={orgData?.stats?.activeWarehouses ?? 2}
          subtitle="Registered warehouse facilities"
          icon={<Icons.Warehouse size={18} className="text-purple-600" />}
          color="violet"
        />
        <StatCard
          title="Managed Catalog"
          value={orgData?.stats?.activeProducts ?? 3}
          subtitle="Active SKUs under governance"
          icon={<Icons.Products size={18} className="text-amber-600" />}
          color="amber"
        />
      </div>

      {/* TAB 1: ORGANIZATIONS PROFILE */}
      {activeTab === 'organizations' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tenant Legal Entity & Isolation</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tenant boundaries are cryptographically enforced across all PostgreSQL queries via strict multi-tenant isolation.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                Active Organization
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tenant Name</span>
                <p className="text-sm font-bold text-slate-900">{orgData?.name || 'FleetFlow Logistics'}</p>
                <p className="text-[11px] text-slate-400">Registered operating enterprise</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">System Slug</span>
                <p className="text-sm font-mono font-bold text-blue-700">{orgData?.slug || 'fleetflow-primary'}</p>
                <p className="text-[11px] text-slate-400">Subdomain routing key</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Created Timestamp</span>
                <p className="text-sm font-mono font-semibold text-slate-700">
                  {orgData?.createdAt ? new Date(orgData.createdAt).toLocaleDateString() : 'Active'}
                </p>
                <p className="text-[11px] text-slate-400">Platform deployment epoch</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/50 flex items-start gap-3">
              <Icons.Shield size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-blue-900">Multi-Tenant Tenant Isolation Guarantee</p>
                <p className="text-slate-600">
                  Every SQL transaction and Redis Pub/Sub stream enforces foreign key constraints bound to this tenant.
                  Cross-tenant leakage across orders, inventory, consignments, and financial reconciliation is blocked by the backend kernel.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEMBERS & ROLES DIRECTORY */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Provisioned Team Members</h2>
                <p className="text-xs text-slate-500">
                  Members with authorized credentials and tenant-scoped role bindings.
                </p>
              </div>

              <button
                onClick={() => setIsInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Icons.Plus size={14} />
                <span>Invite Team Member</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Assigned Roles</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {members.map((m) => (
                    <tr key={m.membershipId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-700 border border-blue-200/80 flex items-center justify-center font-bold text-xs">
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{m.email}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {m.roles.map((r: string) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={m.status || 'ACTIVE'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRemoveMember(m.membershipId, m.name)}
                          className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md text-[11px] font-semibold transition-colors"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL SETTINGS & DETERMINISTIC OPTIMIZATION SLIDERS */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-200/80 pb-4">
            <h2 className="text-sm font-bold text-slate-900">
              Deterministic Multi-Factor Warehouse Allocation Engine (Assignment Section 3.C)
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              allocation_score = (distance_weight × dist) + (cost_weight × cost) + (split_weight × split_penalty)
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Weights dictate how orders are allocated across warehouse nodes. The sum of all 3 factors must strictly equal 1.00.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Distance Factor */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Distance Weight</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    {settingsForm.distanceWeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settingsForm.distanceWeight}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, distanceWeight: parseFloat(e.target.value) })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Favors facilities physically closest to the recipient delivery postal code.
                </p>
              </div>

              {/* Freight Cost Factor */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Cost Weight</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {settingsForm.costWeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settingsForm.costWeight}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, costWeight: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Favors warehouses with lowest contracted freight rates and handling costs.
                </p>
              </div>

              {/* Split Penalty Factor */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Split Penalty Weight</span>
                  <span className="font-mono font-bold text-amber-600 text-sm">
                    {settingsForm.splitWeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settingsForm.splitWeight}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, splitWeight: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Applies a penalty multiplier when fulfillment requires splitting an order across hubs.
                </p>
              </div>
            </div>

            {/* Total Sum Indicator */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="text-slate-600 font-sans font-medium">Optimization Formula Aggregate Sum:</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full ${
                  Math.abs(
                    settingsForm.distanceWeight + settingsForm.costWeight + settingsForm.splitWeight - 1.0
                  ) < 0.05
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {(
                  settingsForm.distanceWeight +
                  settingsForm.costWeight +
                  settingsForm.splitWeight
                ).toFixed(2)}{' '}
                / 1.00
              </span>
            </div>

            {/* Operational Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Base Operating Currency
                </label>
                <input
                  type="text"
                  value={settingsForm.defaultCurrency}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultCurrency: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operating Timezone
                </label>
                <input
                  type="text"
                  value={settingsForm.operatingTimezone}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, operatingTimezone: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reorder Alert Threshold
                </label>
                <input
                  type="number"
                  value={settingsForm.reorderAlertThreshold}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      reorderAlertThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settingsForm.autoAllocationEnabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, autoAllocationEnabled: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Enable Autonomous Allocation on Order Reservation
                </span>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200/80">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
              >
                {savingSettings && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Save Enterprise Configurations</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <Modal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          title="Provision New Team Member"
          maxWidth="md"
        >
          <form onSubmit={handleInviteMember} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Connor"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Corporate Email Address *</label>
              <input
                type="email"
                required
                placeholder="s.connor@acmelogistics.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assigned RBAC Role *</label>
              <select
                value={inviteForm.roleName}
                onChange={(e) => setInviteForm({ ...inviteForm, roleName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="Operations Manager">Operations Manager</option>
                <option value="Warehouse Manager">Warehouse Manager</option>
                <option value="Warehouse Operator">Warehouse Operator</option>
                <option value="Delivery Partner">Delivery Partner</option>
                <option value="Finance Manager">Finance Manager</option>
                <option value="Auditor">Auditor</option>
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                {inviting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Provision Member</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
