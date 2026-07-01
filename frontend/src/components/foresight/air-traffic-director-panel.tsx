'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { foresightApi, type DirectorAdvice, type DirectorOption, type ResolutionManeuver } from '@/lib/api';
import { useForesightStore } from '@/store/foresight.store';

export function AirTrafficDirectorPanel({ advice }: { advice: DirectorAdvice }) {
  const { set } = useForesightStore();
  const [applying, setApplying] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const confirm = async (opt: DirectorOption, idx: number) => {
    setApplying(idx);
    setNote(null);
    try {
      const maneuver: ResolutionManeuver = {
        objectId: opt.objectId,
        kind: opt.kind,
        delaySec: opt.delaySec,
        altitudeDeltaM: opt.altitudeDeltaM,
        lateralOffsetM: opt.lateralOffsetM,
      };
      const { data } = await foresightApi.simulateResolution([maneuver], 600, 5);
      const cleared = data.predictedConflicts.length === 0;
      set({ timeline: data, focusConflict: data.predictedConflicts[0] ?? null, resolved: cleared });
      // If the maneuver reduced but didn't fully clear the conflict, say so — never
      // leave the operator staring at an unchanged panel wondering if it worked.
      if (!cleared) {
        const sep = data.predictedConflicts[0]?.minSeparationM;
        setNote(
          `Maneuver applied, but a conflict remains${sep != null ? ` (separation now ${sep} m)` : ''}. Try another option.`,
        );
      }
    } catch {
      setNote('Could not apply the maneuver — please try again.');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border bg-card/95 p-3 text-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-bold uppercase tracking-wide">Air Traffic Director</span>
        <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-mono', advice.source === 'ai' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
          {advice.source === 'ai' ? 'AI' : 'COMPUTED'}
        </span>
      </div>
      <p className="mt-1">{advice.summary}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{advice.cause}</p>

      <div className="mt-2 space-y-1.5">
        {advice.options.map((opt, idx) => (
          <div key={idx} className={cn('rounded border px-2.5 py-2', idx === advice.recommendedIndex ? 'border-primary/50 bg-primary/5' : 'border-border')}>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{opt.label}</span>
              {idx === advice.recommendedIndex && <span className="rounded bg-primary/15 px-1 text-[10px] font-mono text-primary">RECOMMENDED</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{opt.rationale}</p>
            <Button size="sm" className="mt-1.5 h-7 gap-1 text-xs" disabled={applying !== null} onClick={() => confirm(opt, idx)}>
              {applying === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Confirm
            </Button>
          </div>
        ))}
      </div>

      {note && (
        <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-500">
          {note}
        </p>
      )}
    </div>
  );
}
