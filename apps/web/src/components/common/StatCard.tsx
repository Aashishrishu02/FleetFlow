import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendColor?: 'green' | 'amber' | 'rose' | 'blue' | 'slate' | string;
  trendDirection?: 'up' | 'down';
  color?: string;
  badge?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendColor,
  color,
  badge,
  className = '',
}) => {
  const effectiveColor = trendColor || color || 'green';
  const trendColorClass =
    effectiveColor === 'green' || effectiveColor === 'emerald'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : effectiveColor === 'amber'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : effectiveColor === 'rose'
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : effectiveColor === 'blue' || effectiveColor === 'violet'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
        </div>

        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-200/80">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend || badge) && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${trendColorClass}`}
            >
              {trend}
            </span>
          )}
          {subtitle && (
            <span className="truncate text-[11px] text-slate-500 font-medium">
              {subtitle}
            </span>
          )}
          {badge && (
            <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
