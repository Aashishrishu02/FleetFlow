import React from 'react';
import { Icons } from '../common/Icons';

interface TopNavbarProps {
  userName?: string;
  userEmail?: string;
  organizationName?: string;
  organizationSlug?: string;
  roleName?: string;
  onLogout: () => void;
  onSearchFocus?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  userName = 'Marcus Vance',
  organizationName = 'FleetFlow Global Logistics',
  organizationSlug = 'fleetflow-global',
  roleName = 'Organization Owner',
  onLogout,
}) => {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-6 select-none shadow-2xs z-10">
      {/* Left: Global Quick-Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Icons.Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Search orders, containers, tracking #, SKUs..."
            className="w-full pl-9 pr-14 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-normal"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-400 shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Region / Facility Scope */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 font-medium px-2.5 py-1 rounded-md hover:bg-slate-50 border border-slate-200/60 cursor-pointer">
          <Icons.Warehouse size={13} className="text-slate-400" />
          <span>All Regions · Global Hubs</span>
          <Icons.ChevronDown size={11} className="text-slate-400" />
        </div>
      </div>

      {/* Right: Operational Telemetry & User Account */}
      <div className="flex items-center gap-4">
        {/* Live SLA SLA Pill from Reference Screen */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>99.98% On-Time SLA</span>
        </div>

        {/* Action icons */}
        <button
          title="Notifications"
          className="relative p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Icons.Bell size={16} />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <button
          title="System Help & Documentation"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors hidden sm:block"
        >
          <Icons.Help size={16} />
        </button>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Card */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shadow-2xs">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{userName}</span>
                <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 border border-blue-200 uppercase tracking-wider">
                  {roleName.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {organizationName} · {organizationSlug}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign out of platform"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
          >
            <Icons.SignOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
};

