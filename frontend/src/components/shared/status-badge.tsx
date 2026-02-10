'use client';

import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  // Flight statuses
  planned: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  authorized: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  pre_flight: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  active: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25 animate-pulse-cyan',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/25',
  emergency: 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse-red',

  // Drone statuses
  available: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  in_flight: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  charging: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  maintenance: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  retired: 'bg-gray-500/10 text-gray-500 border-gray-500/25',

  // Hub statuses
  offline: 'bg-red-500/10 text-red-400 border-red-500/25',

  // Conflict statuses
  detected: 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse-red',
  notified: 'bg-red-500/10 text-red-400 border-red-500/25',
  resolving: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  false_alarm: 'bg-gray-500/10 text-gray-500 border-gray-500/25',

  // Zone statuses / types
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/25',
  temporary: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  controlled: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  restricted: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  prohibited: 'bg-red-500/10 text-red-400 border-red-500/25',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  corridor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',

  // Severity
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  critical: 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse-red',

  // Flight categories
  VFR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  MVFR: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  IFR: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  LIFR: 'bg-red-500/10 text-red-400 border-red-500/25',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const safeStatus = status || 'unknown';
  const style = statusStyles[safeStatus] || 'bg-gray-500/10 text-gray-500 border-gray-500/25';
  const label = safeStatus.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold font-mono tracking-wider uppercase',
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
