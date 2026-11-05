import React from 'react';

export type StatusVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  showDot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  showDot = true,
  size = 'md',
  className = '',
}) => {
  // Infer variant from status name if not explicitly provided
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  let computedVariant: StatusVariant = variant || 'neutral';

  if (!variant) {
    if (
      [
        'ACTIVE',
        'DELIVERED',
        'COMPLETED',
        'RESOLVED',
        'SETTLED',
        'HEALTHY',
        'ONLINE',
        'ON_SCHEDULE',
        'VERIFIED',
        'APPROVED',
        'PAID',
        'OPTIMAL',
      ].includes(normalized)
    ) {
      computedVariant = 'success';
    } else if (
      [
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'PENDING',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'CONFIRMED',
        'ALLOCATING_INVENTORY',
        'PARTIALLY_FULFILLED',
        'LOW_STOCK',
        'NEEDS_REVIEW',
        'WEATHER_DELAY',
      ].includes(normalized)
    ) {
      computedVariant = 'warning';
    } else if (
      [
        'FAILED',
        'CANCELLED',
        'DELIVERY_FAILED',
        'DAMAGED',
        'OVERDUE',
        'DISPUTE',
        'OUT_OF_STOCK',
        'CRITICAL',
        'REJECTED',
        'QUARANTINED',
        'BLOCKED',
      ].includes(normalized)
    ) {
      computedVariant = 'danger';
    } else if (
      ['CREATED', 'REQUESTED', 'INSPECTED', 'ASSIGNED', 'ISSUED', 'CUSTOMS_HOLD'].includes(
        normalized,
      )
    ) {
      computedVariant = 'info';
    }
  }

  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/90',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/90',
    info: 'bg-blue-50 text-blue-700 border-blue-200/90',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200/90',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    neutral: 'bg-slate-400',
    purple: 'bg-indigo-500',
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} font-semibold tracking-tight transition-colors ${styles[computedVariant]} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColors[computedVariant]}`}
        />
      )}
      <span>{status}</span>
    </span>
  );
};
