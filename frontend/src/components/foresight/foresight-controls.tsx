'use client';

import { useEffect } from 'react';
import { Eye, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { foresightApi } from '@/lib/api';
import { useForesightStore } from '@/store/foresight.store';
import { AirTrafficDirectorPanel } from './air-traffic-director-panel';

export function ForesightControls() {
  const { engaged, timeline, playheadSec, focusConflict, set, reset } = useForesightStore();
  const advice = useForesightStore((s) => s.advice);
  const resolved = useForesightStore((s) => s.resolved);

  // Poll predictions while engaged (every 3s, matching ADS-B cadence).
  useEffect(() => {
    if (!engaged) return;
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await foresightApi.predict(600, 5);
        if (!alive) return;
        const conflict = data.predictedConflicts[0] ?? null;
        set({ timeline: data, focusConflict: conflict });
      } catch {
        /* best-effort */
      }
    };
    tick();
    const h = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [engaged, set]);

  useEffect(() => {
    if (!focusConflict || advice) return;
    let alive = true;
    foresightApi.advise(focusConflict).then(({ data }) => { if (alive) set({ advice: data }); }).catch(() => {});
    return () => { alive = false; };
  }, [focusConflict, advice, set]);

  const runDemo = async () => {
    await foresightApi.startDemo();
    set({ engaged: true, resolved: false, playheadSec: 480 });
  };

  const stop = async () => {
    await foresightApi.resetDemo();
    reset();
  };

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-border bg-card/90 p-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={engaged ? 'default' : 'outline'}
          className="gap-1.5"
          onClick={() => set({ engaged: !engaged })}
        >
          <Eye className="h-3.5 w-3.5" /> FORESIGHT
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={runDemo}>
          <Play className="h-3.5 w-3.5" /> Run Demo
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={stop}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>

      {engaged && timeline && (
        <div className="flex items-center gap-2 px-1">
          <span className="font-mono text-xs text-muted-foreground">
            +{Math.floor(playheadSec / 60)}:{String(playheadSec % 60).padStart(2, '0')}
          </span>
          <input
            type="range"
            min={0}
            max={timeline.horizonSec}
            step={timeline.stepSec}
            value={playheadSec}
            onChange={(e) => set({ playheadSec: Number(e.target.value) })}
            className={cn('h-1 flex-1 cursor-pointer appearance-none rounded bg-border accent-primary')}
          />
          <span className="font-mono text-xs text-primary">
            {timeline.predictedConflicts.length} conflict
            {timeline.predictedConflicts.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {resolved && (
        <div className="rounded bg-emerald-500/10 px-2 py-1 text-center text-xs font-semibold text-emerald-500">
          RESOLVED — separation restored
        </div>
      )}
      {!resolved && advice && <AirTrafficDirectorPanel advice={advice} />}
    </div>
  );
}
