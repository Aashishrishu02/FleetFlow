import React from 'react';
import { Icons } from '../common/Icons';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string | number;
}

export interface NavGroupConfig {
  group: string;
  items: NavItemConfig[];
}

export const SIDEBAR_NAV: NavGroupConfig[] = [
  {
    group: 'OVERVIEW',
    items: [
      { id: 'Operations Overview', label: 'Operations Overview', icon: Icons.Dashboard },
    ],
  },
  {
    group: 'ORGANIZATION MANAGEMENT',
    items: [
      { id: 'Organizations', label: 'Organizations', icon: Icons.Building },
      { id: 'Members', label: 'Members', icon: Icons.Users },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { id: 'Orders', label: 'Orders', icon: Icons.Orders },
      { id: 'Inventory', label: 'Inventory', icon: Icons.Inventory },
      { id: 'Warehouses', label: 'Warehouses', icon: Icons.Warehouse },
      { id: 'Products', label: 'Products Master', icon: Icons.Products },
      { id: 'Shipments', label: 'Shipments', icon: Icons.Shipments },
      { id: 'Dispatch', label: 'Dispatch', icon: Icons.Dispatch },
      { id: 'Partners', label: 'Delivery Partners', icon: Icons.Carrier },
      { id: 'Returns', label: 'Returns Hub', icon: Icons.Returns },
    ],
  },
  {
    group: 'FINANCE',
    items: [
      { id: 'Finance Overview', label: 'Finance Overview', icon: Icons.Finance },
      { id: 'Pricing Rules', label: 'Pricing Rules', icon: Icons.Pricing },
      { id: 'Shipping Quotes', label: 'Shipping Quotes', icon: Icons.Quote },
      { id: 'Invoices', label: 'Invoices', icon: Icons.Invoice },
      { id: 'Credit Notes', label: 'Credit Notes', icon: Icons.CreditNote },
      { id: 'Refunds', label: 'Refunds', icon: Icons.Refund },
      { id: 'Partner Payables', label: 'Partner Payables', icon: Icons.Carrier },
      { id: 'Reconciliation', label: 'Reconciliation', icon: Icons.Reconciliation },
    ],
  },
  {
    group: 'SYSTEM',
    items: [
      { id: 'Workflow Monitor', label: 'Workflow Monitor', icon: Icons.Workflow },
      { id: 'Team & Permissions', label: 'Team & Permissions', icon: Icons.Users },
      { id: 'API Keys', label: 'API Keys', icon: Icons.Key },
      { id: 'Audit Logs', label: 'Audit Logs', icon: Icons.Audit },
      { id: 'Settings', label: 'Settings', icon: Icons.Settings },
    ],
  },
];

interface SidebarProps {
  activeId: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  onSelect,
}) => {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-900 bg-[#0c1427] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 font-extrabold text-white text-xs shadow-xs">
            FF
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block leading-none">
              FleetFlow
            </span>
            <span className="text-[9px] text-blue-400 font-mono tracking-wider font-semibold">
              SUPPLY CHAIN OS
            </span>
          </div>
        </div>

        <span className="inline-flex items-center rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 border border-slate-700/60">
          v2.0
        </span>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 text-xs font-medium scrollbar-thin">
        {SIDEBAR_NAV.map((grp) => (
          <div key={grp.group} className="space-y-0.5">
            <div className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/90 font-mono">
              {grp.group}
            </div>

            {grp.items.map((item) => {
              const IconComp = item.icon;
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <IconComp
                      size={15}
                      className={isActive ? 'text-white' : 'text-slate-400'}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                        isActive
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Sync Engine Bar from Reference Screen */}
      <div className="border-t border-slate-800/80 p-3 bg-[#080e1e]">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] text-slate-400">Sync Engine 4.12</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
        </div>
      </div>
    </aside>
  );
};

