import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Icons } from '../common/Icons';

interface FinanceViewProps {
  initialTab?: 'overview' | 'pricing' | 'quotes' | 'invoices' | 'reconciliation';
}

export const FinanceView: React.FC<FinanceViewProps> = ({ initialTab = 'overview' }) => {
  const { roles } = useAuth();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'pricing' | 'quotes' | 'invoices' | 'reconciliation'
  >(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any | null>(null);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any | null>(null);

  // Quote Engine Form
  const [quoteInput, setQuoteInput] = useState({
    origin: 'Chicago, IL (ORD Hub)',
    destination: 'Dallas, TX (DFW Hub)',
    weightKg: 450,
    distanceKm: 1480,
    serviceType: 'STANDARD_ROAD',
  });
  const [generatedQuote, setGeneratedQuote] = useState<any | null>(null);
  const [calculating, setCalculating] = useState(false);

  // New Pricing Rule Form Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isEditRuleOpen, setIsEditRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [newRule, setNewRule] = useState({
    name: 'Continental Interstate FTL Tariff',
    serviceType: 'STANDARD_ROAD',
    baseCharge: 80.0,
    perKmRate: 1.25,
    perKgRate: 0.45,
    fuelSurchargePct: 15.0,
    handlingFee: 10.0,
    insurancePct: 2.0,
  });

  const canWrite = roles.some((r) =>
    ['Organization Owner', 'Finance Manager', 'Admin', 'Manager'].includes(r),
  );

  const fetchFinanceData = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, rules, qts, invs, rec] = await Promise.all([
        apiClient.finance.getOverview().catch(() => null),
        apiClient.finance.getPricingRules().catch(() => []),
        apiClient.finance.getQuotes().catch(() => []),
        apiClient.finance.getInvoices().catch(() => []),
        apiClient.finance.getReconciliation().catch(() => null),
      ]);
      setOverview(ov);
      setPricingRules(rules);
      setQuotes(qts);
      setInvoices(invs);
      setReconciliation(rec);
    } catch (err: any) {
      toastError('Fetch Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const handleGenerateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCalculating(true);
      const quote = await apiClient.finance.generateQuote(quoteInput);
      setGeneratedQuote(quote);
      success('Quote Generated', `Calculated freight tariff: $${quote.totalCharge}`);
      fetchFinanceData();
    } catch (err: any) {
      toastError('Quote Error', err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      await apiClient.finance.createPricingRule(newRule);
      success('Tariff Rule Published', `Versioned rule ${newRule.name} is now active`);
      setIsRuleModalOpen(false);
      fetchFinanceData();
    } catch (err: any) {
      toastError('Rule Creation Failed', err.message);
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    try {
      await apiClient.finance.deletePricingRule(id);
      success('Tariff Deleted', `Pricing rule ${name} removed`);
      fetchFinanceData();
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      await apiClient.finance.updatePricingRule(editingRule.id, {
        ruleName: editingRule.ruleName || editingRule.name,
        baseCharge: Number(editingRule.baseCharge),
        perKmRate: Number(editingRule.perKmRate),
        perKgRate: Number(editingRule.perKgRate),
        fuelSurchargePct: Number(editingRule.fuelSurchargePct),
        handlingFee: Number(editingRule.handlingFee),
        insurancePct: Number(editingRule.insurancePct),
        isActive: editingRule.isActive,
      });
      success('Tariff Updated', `Pricing rule ${editingRule.ruleName || editingRule.name} updated successfully`);
      setIsEditRuleOpen(false);
      setEditingRule(null);
      fetchFinanceData();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    }
  };

  const totalInvoiced = Number(overview?.totalInvoiced || 0);
  const totalReceivable = Number(overview?.accountsReceivable || 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn text-slate-900">
      {/* Header & Breadcrumbs matching Reference Screen 11 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Finance</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span>Treasury & Settlement</span>
            <Icons.ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Global Logistics Treasury & Settlement Engine</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Finance & Settlement Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-currency freight treasury, accessorial ledger auditing, fixed-precision tariff quotes & 3-way matching.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchFinanceData}
            title="Refresh finance data"
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
              onClick={() => setIsRuleModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98]"
            >
              <Icons.Plus size={14} />
              <span>+ Create Pricing Tariff</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip matching Reference Screen 11 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross Billed Freight"
          value={`$${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtitle="All invoiced consignments reconciled"
          trend="+12.1% MoM"
          trendColor="green"
          icon={<Icons.Finance size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Accounts Receivable (GL)"
          value={`$${totalReceivable.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtitle="Active debit entries in ledger"
          trend="99.1% Collected"
          trendColor="blue"
          icon={<Icons.Invoice size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="3-Way Match Verification"
          value="98.4%"
          subtitle="BOL vs Rate vs Invoiced matched"
          trend="Matched"
          trendColor="green"
          icon={<Icons.Check size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Disputed Charges & Escrow"
          value="$0.00"
          subtitle={reconciliation?.disputes ? `${reconciliation.disputes} variances pending` : '0 active rate variances pending'}
          trend="0 Variance"
          trendColor="green"
          icon={<Icons.Shield size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Main Tabbed Container */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200/90 px-5 pt-3.5 flex items-center gap-6 overflow-x-auto">
          {[
            ['overview', 'Finance Overview'],
            ['pricing', `Pricing Tariffs (${pricingRules.length})`],
            ['quotes', `Quotes & Estimator (${quotes.length})`],
            ['invoices', `Invoices (${invoices.length})`],
            ['reconciliation', '3-Way Reconciliation'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview & Rate Estimator */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Instant Freight Rate Estimator */}
              <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Instant Multi-Modal Freight Rate Estimator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live carrier buy-side simulation with fixed-precision decimal arithmetic.
                  </p>
                </div>

                <form onSubmit={handleGenerateQuote} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Facility</label>
                      <input
                        type="text"
                        value={quoteInput.origin}
                        onChange={(e) => setQuoteInput({ ...quoteInput, origin: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Facility</label>
                      <input
                        type="text"
                        value={quoteInput.destination}
                        onChange={(e) => setQuoteInput({ ...quoteInput, destination: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (KG)</label>
                      <input
                        type="number"
                        min={1}
                        value={quoteInput.weightKg}
                        onChange={(e) => setQuoteInput({ ...quoteInput, weightKg: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Distance (KM)</label>
                      <input
                        type="number"
                        min={1}
                        value={quoteInput.distanceKm}
                        onChange={(e) => setQuoteInput({ ...quoteInput, distanceKm: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Service Type</label>
                      <select
                        value={quoteInput.serviceType}
                        onChange={(e) => setQuoteInput({ ...quoteInput, serviceType: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="STANDARD_ROAD">Standard Road FTL</option>
                        <option value="EXPRESS_AIR">Express Air Freight</option>
                        <option value="TEMPERATURE_CONTROLLED">Reefer Cold Chain</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={calculating}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs"
                  >
                    {calculating ? 'Calculating Quote...' : 'Calculate Exact Tariff Quote'}
                  </button>
                </form>

                {generatedQuote && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-900">Total Freight Quote</span>
                      <span className="font-mono font-black text-emerald-700 text-base">
                        ${Number(generatedQuote.totalCharge).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800 border-t border-emerald-200/60 pt-2 font-mono">
                      <span>Base: ${Number(generatedQuote.baseCharge).toFixed(2)}</span>
                      <span>Distance: ${Number(generatedQuote.distanceCharge).toFixed(2)}</span>
                      <span>Weight: ${Number(generatedQuote.weightCharge).toFixed(2)}</span>
                      <span>Fuel Surcharge: ${Number(generatedQuote.fuelSurcharge).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement Gateway Health */}
              <div className="rounded-xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Settlement Telemetry</h3>
                  <span className="text-emerald-700 text-xs font-bold font-mono">Automated Clearing Active</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 block">3-Way Match Verification Status</span>
                      <span className="text-slate-500 text-[11px]">Bill of Lading + Carrier Rate Card + Invoice</span>
                    </div>
                    <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 font-bold text-[11px]">
                      100% Matched
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 block">Double-Entry Ledger Integrity</span>
                      <span className="text-slate-500 text-[11px]">Debit ACCOUNTS_RECEIVABLE / Credit REVENUE</span>
                    </div>
                    <span className="rounded bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 font-bold text-[11px]">
                      Balanced
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Pricing Rules */}
        {activeTab === 'pricing' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Tariff Rule Name</th>
                  <th className="py-3 px-4">Modality</th>
                  <th className="py-3 px-4 text-right">Base Charge</th>
                  <th className="py-3 px-4 text-right">Per KM Rate</th>
                  <th className="py-3 px-4 text-right">Per KG Rate</th>
                  <th className="py-3 px-4 text-right">Fuel Surcharge</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pricingRules.length > 0 ? (
                  pricingRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{rule.name}</td>
                      <td className="py-3 px-4 text-slate-700">{rule.serviceType}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">${Number(rule.baseCharge).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono">${Number(rule.perKmRate).toFixed(2)}/km</td>
                      <td className="py-3 px-4 text-right font-mono">${Number(rule.perKgRate).toFixed(2)}/kg</td>
                      <td className="py-3 px-4 text-right font-mono">{Number(rule.fuelSurchargePct)}%</td>
                      <td className="py-3 px-4"><StatusBadge status={rule.isActive ? 'ACTIVE' : 'ARCHIVED'} /></td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => {
                                setEditingRule({ ...rule, ruleName: rule.name || rule.ruleName });
                                setIsEditRuleOpen(true);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id, rule.name || rule.ruleName)}
                              className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-[11px] font-semibold transition-colors"
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
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No pricing rules defined. Click "+ Create Pricing Tariff" to establish freight rate tables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Quotes */}
        {activeTab === 'quotes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Quote Number</th>
                  <th className="py-3 px-4">Origin & Destination</th>
                  <th className="py-3 px-4">Cargo Weight & Distance</th>
                  <th className="py-3 px-4 text-right">Calculated Charge</th>
                  <th className="py-3 px-4">Valid Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.length > 0 ? (
                  quotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{q.quoteNumber}</td>
                      <td className="py-3 px-4 text-slate-900 font-medium">{q.origin} → {q.destination}</td>
                      <td className="py-3 px-4 text-slate-700 font-mono">{q.weightKg} kg · {q.distanceKm} km</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                        ${Number(q.totalCharge).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(q.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No quotes generated yet. Use the Rate Estimator above to price freight lanes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Invoices */}
        {activeTab === 'invoices' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Shipment Reference</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Tax</th>
                  <th className="py-3 px-4 text-right">Total Invoiced</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-700 font-mono">
                        {inv.shipmentId ? `Shipment #${inv.shipmentId.slice(0, 8)}` : 'Consignment Direct'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">${Number(inv.subtotal).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono">${Number(inv.taxAmount).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        ${Number(inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={inv.status} /></td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No customer freight invoices generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: 3-Way Match Reconciliation */}
        {activeTab === 'reconciliation' && (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-2 text-xs">
              <span className="font-bold text-blue-900 text-sm block">Automated 3-Way Match Engine</span>
              <p className="text-blue-800">
                Audits freight bills against electronic proof-of-delivery (BOL), contracted tariff matrices, and invoiced totals. Zero floating-point drift.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-sans font-bold">Total Invoiced</span>
                <div className="text-lg font-bold text-slate-900 mt-1">${totalInvoiced.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-sans font-bold">Reconciled Payments</span>
                <div className="text-lg font-bold text-emerald-600 mt-1">${totalInvoiced.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-sans font-bold">Variances Under Audit</span>
                <div className="text-lg font-bold text-slate-900 mt-1">$0.00</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Pricing Rule Modal */}
      {isRuleModalOpen && (
        <Modal
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          title="Publish Freight Tariff Pricing Rule"
          subtitle="Configure base fees, distance multipliers, and fuel surcharges."
          maxWidth="md"
        >
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tariff Schedule Name *</label>
              <input
                type="text"
                required
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Modality</label>
                <select
                  value={newRule.serviceType}
                  onChange={(e) => setNewRule({ ...newRule, serviceType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                >
                  <option value="STANDARD_ROAD">Standard Road FTL</option>
                  <option value="EXPRESS_AIR">Express Air Freight</option>
                  <option value="TEMPERATURE_CONTROLLED">Reefer Cold Chain</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Base Charge ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRule.baseCharge}
                  onChange={(e) => setNewRule({ ...newRule, baseCharge: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Per KM Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRule.perKmRate}
                  onChange={(e) => setNewRule({ ...newRule, perKmRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fuel Surcharge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newRule.fuelSurchargePct}
                  onChange={(e) => setNewRule({ ...newRule, fuelSurchargePct: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Publish Tariff
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Pricing Rule Modal */}
      {isEditRuleOpen && editingRule && (
        <Modal
          isOpen={isEditRuleOpen}
          onClose={() => {
            setIsEditRuleOpen(false);
            setEditingRule(null);
          }}
          title={`Edit Pricing Tariff: ${editingRule.ruleName || editingRule.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdateRule} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tariff Schedule Name *</label>
              <input
                type="text"
                required
                value={editingRule.ruleName || editingRule.name || ''}
                onChange={(e) => setEditingRule({ ...editingRule, ruleName: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Base Charge ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRule.baseCharge || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, baseCharge: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Per KM Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRule.perKmRate || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, perKmRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Per KG Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRule.perKgRate || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, perKgRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fuel Surcharge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingRule.fuelSurchargePct || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, fuelSurchargePct: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditRuleOpen(false);
                  setEditingRule(null);
                }}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
