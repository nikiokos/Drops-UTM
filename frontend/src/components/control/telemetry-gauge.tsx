'use client';

import { cn } from '@/lib/utils';

interface TelemetryGaugeProps {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  invertWarning?: boolean;
  className?: string;
}

export function TelemetryGauge({
  label,
  value,
  unit,
  min = 0,
  max = 100,
  warningThreshold,
  criticalThreshold,
  invertWarning = false,
  className,
}: TelemetryGaugeProps) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  // Determine color based on thresholds
  const getColor = () => {
    if (criticalThreshold !== undefined) {
      const isCritical = invertWarning ? value > criticalThreshold : value < criticalThreshold;
      if (isCritical) return 'text-red-400';
    }
    if (warningThreshold !== undefined) {
      const isWarning = invertWarning ? value > warningThreshold : value < warningThreshold;
      if (isWarning) return 'text-amber-400';
    }
    return 'text-emerald-400';
  };

  const getStrokeColor = () => {
    if (criticalThreshold !== undefined) {
      const isCritical = invertWarning ? value > criticalThreshold : value < criticalThreshold;
      if (isCritical) return '#f87171';
    }
    if (warningThreshold !== undefined) {
      const isWarning = invertWarning ? value > warningThreshold : value < warningThreshold;
      if (isWarning) return '#fbbf24';
    }
    return '#34d399';
  };

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative w-24 h-24">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-border/30"
          />
          {/* Value arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-xl font-bold font-mono tabular-nums', getColor())}>
            {Math.round(value)}
          </span>
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            {unit}
          </span>
        </div>
      </div>
      <span className="mt-2 text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
