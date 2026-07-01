'use client';

import { useEffect, useState } from 'react';
import { BatteryWarning, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { feasibilityApi, type FeasibilityResult } from '@/lib/api';

const STYLES: Record<
  string,
  { ring: string; text: string; Icon: typeof CheckCircle2; label: string }
> = {
  GO: {
    ring: 'border-emerald-500/40 bg-emerald-500/5',
    text: 'text-emerald-500',
    Icon: CheckCircle2,
    label: 'GO',
  },
  MARGINAL: {
    ring: 'border-amber-500/40 bg-amber-500/5',
    text: 'text-amber-500',
    Icon: BatteryWarning,
    label: 'MARGINAL',
  },
  NO_GO: {
    ring: 'border-destructive/40 bg-destructive/5',
    text: 'text-destructive',
    Icon: XCircle,
    label: 'NO-GO',
  },
};

export function FeasibilityCard({
  droneId,
  distanceM,
  hoverTimeS,
  departureHubId,
  payloadKg,
  onVerdict,
}: {
  droneId?: string;
  distanceM?: number;
  hoverTimeS?: number;
  departureHubId?: string;
  payloadKg?: number;
  onVerdict?: (r: FeasibilityResult | null) => void;
}) {
  const [result, setResult] = useState<FeasibilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = !!droneId && !!distanceM && distanceM > 0;

  useEffect(() => {
    if (!ready) {
      setResult(null);
      onVerdict?.(null);
      return;
    }

    // Debounce 500 ms so rapid waypoint additions don't hammer the API.
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      setLoading(true);
      feasibilityApi
        .check({ droneId, distanceM, hoverTimeS, departureHubId, payloadKg })
        .then(({ data }) => {
          if (alive) {
            setResult(data);
            onVerdict?.(data);
          }
        })
        .catch(() => {
          if (alive) {
            setResult(null);
            onVerdict?.(null);
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 500);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // Depend on primitive values only — avoids re-fetch loops from object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droneId, distanceM, hoverTimeS, departureHubId, payloadKg]);

  if (!ready) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Select a drone and draw a route to check feasibility.
      </div>
    );
  }

  if (loading || !result) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking feasibility…
      </div>
    );
  }

  const s = STYLES[result.verdict];
  return (
    <div className={cn('rounded-lg border p-3 text-sm', s.ring)}>
      <div className="flex items-center gap-2">
        <s.Icon className={cn('h-4 w-4', s.text)} />
        <span className={cn('font-bold uppercase tracking-wide', s.text)}>{s.label}</span>
        <span className="ml-1 font-mono text-xs text-muted-foreground">
          {result.marginPct}% reserve
        </span>
        {result.confidence === 'LOW' && (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            LOW CONFIDENCE
          </span>
        )}
      </div>
      <p className="mt-1.5 flex items-start gap-1 text-xs">
        {result.explanationSource === 'ai' && (
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
        )}
        <span>{result.explanation}</span>
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {result.usableWh} Wh usable · {result.requiredWh} Wh required
        {result.windUsed ? ` · wind ${result.windUsed.speedMs} m/s` : ''}
      </p>
      {result.verdict !== 'GO' && result.solutions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.solutions.map((sol, i) => (
            <li key={i} className="text-xs">
              <span className="font-semibold">{sol.label}</span>
              <span className="text-muted-foreground"> — {sol.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
