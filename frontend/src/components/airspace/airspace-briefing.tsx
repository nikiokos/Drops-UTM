'use client';

import { useEffect, useRef, useState } from 'react';
import { airspaceApi, dagrApi, type AirspaceCheckResult } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, Loader2, MapPin } from 'lucide-react';

interface RoutePoint {
  lat: number;
  lon: number;
  alt?: number;
}

const sevStyle: Record<string, string> = {
  critical: 'text-red-400 border-red-500/40 bg-red-500/10',
  warning: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  info: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
};

export function AirspaceBriefing({
  points,
  title = 'Pre-Flight Airspace Check',
  autoRun = true,
}: {
  points: RoutePoint[];
  title?: string;
  autoRun?: boolean;
}) {
  const [result, setResult] = useState<AirspaceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [dagr, setDagr] = useState<{ hits: number; total: number } | null>(null);
  const [dagrLoading, setDagrLoading] = useState(false);
  const lastKey = useRef<string>('');

  const routeKey = points.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');

  const run = async () => {
    if (points.length < 1) return;
    setLoading(true);
    setError(false);
    try {
      const r = await airspaceApi.checkPath(points);
      setResult(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const runDagr = async () => {
    if (points.length < 1) return;
    setDagrLoading(true);
    try {
      const r = await dagrApi.checkPoints(points.map((p) => ({ lat: p.lat, lon: p.lon })));
      setDagr({ hits: r.data.filter((x) => x.hit).length, total: r.data.length });
    } finally {
      setDagrLoading(false);
    }
  };

  useEffect(() => {
    if (autoRun && routeKey && routeKey !== lastKey.current) {
      lastKey.current = routeKey;
      void run();
      setDagr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, autoRun]);

  const breaches = result?.breaches ?? [];
  const worst = result?.worstSeverity;
  const clear = result && breaches.length === 0;

  return (
    <Card className={worst === 'critical' ? 'border-red-500/40' : worst === 'warning' ? 'border-amber-500/40' : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {clear ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            )}
            {title}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={run} disabled={loading || points.length < 1}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Re-check'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {points.length < 1 && (
          <p className="text-sm text-muted-foreground">No route to check — add waypoints or hubs.</p>
        )}
        {error && <p className="text-sm text-red-400">Airspace check failed. Try Re-check.</p>}
        {loading && !result && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking {points.length} route points against
            local + openAIP airspace…
          </p>
        )}

        {clear && (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm text-emerald-400">
            ✓ No airspace breaches detected along the route ({result?.sampleCount} points sampled).
          </div>
        )}

        {result && breaches.length > 0 && (
          <>
            <div className={`rounded border p-2.5 text-sm ${sevStyle[worst || 'warning']}`}>
              ⚠ {breaches.length} airspace zone{breaches.length > 1 ? 's' : ''} intersected along the route
              ({result.sampleCount} points sampled)
            </div>
            <div className="space-y-1.5 max-h-56 overflow-auto">
              {breaches.map((b, i) => (
                <div
                  key={`${b.source}-${b.zoneId ?? b.name}-${i}`}
                  className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs ${sevStyle[b.severity]}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold uppercase shrink-0">{b.severity}</span>
                    <span className="truncate">{b.name}</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-70 shrink-0 ml-2">
                    {b.zoneType} · {b.source}
                    {b.ceilingM != null ? ` · ≤${Math.round(b.ceilingM)}m` : ''}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Greek DAGR drone zones — on-demand, advisory */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            {dagr
              ? dagr.hits > 0
                ? `${dagr.hits}/${dagr.total} waypoints inside Greek DAGR zones`
                : `No DAGR drone-zone hits (${dagr.total} waypoints)`
              : 'Official Greek drone zones (DAGR/HASP)'}
          </span>
          <Button size="sm" variant="ghost" onClick={runDagr} disabled={dagrLoading || points.length < 1}>
            {dagrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Check DAGR'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
