'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { briefingApi, aiBriefingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Cloud, Layers, PlaneTakeoff, FileText, Sparkles } from 'lucide-react';

const aiDecisionStyle: Record<string, string> = {
  GO: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  GO_WITH_CONDITIONS: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  NO_GO: 'border-red-500/50 bg-red-500/10 text-red-400',
};

const verdictStyle: Record<string, { box: string; label: string }> = {
  GREEN: { box: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400', label: 'GO' },
  AMBER: { box: 'border-amber-500/40 bg-amber-500/10 text-amber-400', label: 'CAUTION' },
  RED: { box: 'border-red-500/50 bg-red-500/10 text-red-400', label: 'NO-GO' },
};

const sevColor: Record<string, string> = {
  critical: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
};

export function PreFlightBriefingDialog({
  flightId,
  open,
  onOpenChange,
}: {
  flightId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['briefing', flightId],
    queryFn: () => briefingApi.getFlightBriefing(flightId!).then((r) => r.data),
    enabled: open && !!flightId,
  });

  const [runAi, setRunAi] = useState(false);
  const { data: assessment, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-assess', flightId],
    queryFn: () => aiBriefingApi.assessFlight(flightId!).then((r) => r.data),
    enabled: open && runAi && !!flightId,
  });

  const v = data ? verdictStyle[data.verdict] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pre-Flight Briefing</DialogTitle>
          <DialogDescription>
            {data ? `${data.flightNumber} · ${data.route.departureHub ?? '?'} → ${data.route.arrivalHub ?? '?'}` : 'Composing weather, airspace, traffic & NOTAM checks…'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Running checks…
          </div>
        )}
        {isError && <p className="py-6 text-center text-sm text-red-400">Briefing failed to load.</p>}

        {data && v && (
          <div className="space-y-3">
            {/* Overall verdict */}
            <div className={`rounded border p-3 text-center ${v.box}`}>
              <div className="text-2xl font-bold font-mono tracking-wider">{v.label}</div>
              <div className="text-xs opacity-70 mt-0.5">Overall recommendation</div>
            </div>

            {/* Weather */}
            <Section icon={<Cloud className="h-4 w-4" />} title="Weather">
              {data.sections.weather.status === 'ok' ? (
                <span>
                  <b>{data.sections.weather.verdict?.replace('_', '-')}</b> · {data.sections.weather.icao}{' '}
                  {data.sections.weather.flightCategory} · wind {data.sections.weather.windMs ?? '—'} m/s
                  {data.sections.weather.reasons?.[0] ? ` — ${data.sections.weather.reasons[0]}` : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">unavailable</span>
              )}
            </Section>

            {/* Airspace */}
            <Section icon={<Layers className="h-4 w-4" />} title="Airspace">
              {data.sections.airspace.status === 'ok' ? (
                (data.sections.airspace.breachCount ?? 0) === 0 ? (
                  <span className="text-emerald-400">No breaches along route</span>
                ) : (
                  <div className="space-y-0.5">
                    <span className={sevColor[data.sections.airspace.worstSeverity || 'info']}>
                      {data.sections.airspace.breachCount} zone(s) intersected
                    </span>
                    <div className="text-[11px] text-muted-foreground">
                      {(data.sections.airspace.breaches || [])
                        .slice(0, 4)
                        .map((b) => `${b.name} (${b.severity})`)
                        .join(', ')}
                    </div>
                  </div>
                )
              ) : (
                <span className="text-muted-foreground">unavailable</span>
              )}
            </Section>

            {/* Traffic */}
            <Section icon={<PlaneTakeoff className="h-4 w-4" />} title="Live Traffic (ADS-B)">
              {data.sections.traffic.status === 'ok' ? (
                (data.sections.traffic.nearbyCount ?? 0) === 0 ? (
                  <span className="text-emerald-400">No manned traffic near route</span>
                ) : (
                  <span className={data.sections.traffic.warningCount ? 'text-red-400' : 'text-amber-400'}>
                    {data.sections.traffic.nearbyCount} aircraft near route
                    {data.sections.traffic.nearest
                      ? ` — nearest ${data.sections.traffic.nearest.callsign || data.sections.traffic.nearest.hex} @ ${data.sections.traffic.nearest.distanceNm} NM`
                      : ''}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">unavailable</span>
              )}
            </Section>

            {/* NOTAM */}
            <Section icon={<FileText className="h-4 w-4" />} title="NOTAM">
              {data.sections.notam.status === 'ok' ? (
                (data.sections.notam.relevantCount ?? 0) === 0 ? (
                  <span className="text-emerald-400">No active NOTAMs affecting this route</span>
                ) : (
                  <div className="space-y-1">
                    <span className={data.sections.notam.criticalCount ? 'text-red-400' : 'text-amber-400'}>
                      {data.sections.notam.relevantCount} active NOTAM(s) on route
                      {data.sections.notam.criticalCount
                        ? ` · ${data.sections.notam.criticalCount} restricted/danger`
                        : ''}
                    </span>
                    <ul className="space-y-1">
                      {(data.sections.notam.items || []).slice(0, 5).map((n) => (
                        <li key={n.ref} className="text-[11px] leading-tight">
                          <span className={`font-mono font-semibold ${sevColor[n.significance]}`}>{n.ref}</span>{' '}
                          <span className="text-muted-foreground">{n.subject}</span>
                          {n.permanent ? <span className="text-muted-foreground"> · PERM</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              ) : (
                <span className="text-muted-foreground">{data.sections.notam.message || 'unavailable'}</span>
              )}
            </Section>

            {/* AI Authorization Agent (Claude) */}
            <div className="rounded border border-violet-500/30 bg-violet-500/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
                  <Sparkles className="h-4 w-4" />
                  AI Authorization (Claude)
                </div>
                {!runAi && (
                  <Button size="sm" variant="outline" onClick={() => setRunAi(true)}>
                    Run AI assessment
                  </Button>
                )}
              </div>

              {runAi && aiLoading && (
                <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claude is reasoning over the briefing…
                </p>
              )}

              {assessment && assessment.ai && (
                <div className="mt-2 space-y-2">
                  <div className={`rounded border px-2.5 py-1.5 text-center font-mono font-bold ${aiDecisionStyle[assessment.ai.decision]}`}>
                    {assessment.ai.decision.replace(/_/g, ' ')}
                    <span className="ml-2 text-[10px] font-normal opacity-70">
                      {assessment.ai.confidence} confidence · {assessment.model}
                    </span>
                  </div>
                  <p className="text-sm">{assessment.ai.humanSummary}</p>
                  {assessment.ai.blockingReasons.length > 0 && (
                    <div className="text-xs">
                      <span className="text-red-400 font-semibold">Blocking:</span>
                      <ul className="list-disc list-inside text-muted-foreground mt-0.5">
                        {assessment.ai.blockingReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {assessment.ai.conditions.length > 0 && (
                    <div className="text-xs">
                      <span className="text-amber-400 font-semibold">Conditions:</span>
                      <ul className="list-disc list-inside text-muted-foreground mt-0.5">
                        {assessment.ai.conditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {assessment && !assessment.ai && (
                <p className="mt-2 text-sm text-muted-foreground">
                  AI assessment unavailable {assessment.enabled ? '(model call failed)' : '(no API key configured)'}.
                </p>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-right">
              Generated {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
