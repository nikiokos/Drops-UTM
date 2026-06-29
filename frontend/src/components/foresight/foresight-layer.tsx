'use client';

import { useEffect } from 'react';
import { Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { ForesightTimeline, PredictedConflict } from '@/lib/api';

interface Props {
  timeline: ForesightTimeline;
  playheadSec: number;
  focusConflict: PredictedConflict | null;
}

// Color per object kind.
const colorFor = (id: string, kind?: string) =>
  kind === 'manned' ? '#f59e0b' : id.startsWith('demo:') ? '#22d3ee' : '#22d3ee';

export function ForesightLayer({ timeline, playheadSec, focusConflict }: Props) {
  const map = useMap();

  // Cinematic camera fly-to when a conflict becomes the focus. Keyed on the
  // conflict id (a stable string), NOT the focusConflict object — the 3s poll
  // hands a fresh object every tick, which would otherwise re-fly the camera every
  // poll and fight the operator's pan/zoom for the whole pre-resolution window.
  const focusId = focusConflict?.id ?? null;
  const focusLat = focusConflict?.location.lat;
  const focusLon = focusConflict?.location.lon;
  useEffect(() => {
    if (focusId != null && focusLat != null && focusLon != null) {
      map.flyTo([focusLat, focusLon], 11, { duration: 1.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, map]);

  const framesUpTo = timeline.frames.filter((f) => f.tOffsetSec <= playheadSec);
  const kindById = new Map(timeline.objects.map((o) => [o.id, o.kind]));

  // One ghost trail per object: its positions across frames up to the playhead.
  const trails = timeline.objects.map((o) => {
    const positions = framesUpTo
      .map((f) => f.objects.find((x) => x.id === o.id))
      .filter(Boolean)
      .map((p) => [p!.lat, p!.lon] as [number, number]);
    return { id: o.id, kind: o.kind, label: o.label, positions };
  });

  const headFrame = framesUpTo[framesUpTo.length - 1];

  return (
    <>
      {trails.map((t) => (
        <Polyline
          key={`trail-${t.id}`}
          positions={t.positions}
          pathOptions={{ color: colorFor(t.id, t.kind), weight: 2, opacity: 0.5, dashArray: '4 6' }}
        />
      ))}

      {headFrame?.objects.map((p) => (
        <CircleMarker
          key={`head-${p.id}`}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{ color: colorFor(p.id, kindById.get(p.id)), fillColor: colorFor(p.id, kindById.get(p.id)), fillOpacity: 0.9, weight: 1 }}
        />
      ))}

      {timeline.predictedConflicts.map((c) => (
        <CircleMarker
          key={`conflict-${c.id}`}
          center={[c.location.lat, c.location.lon]}
          radius={10}
          className="foresight-pulse"
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.5, weight: 2 }}
        >
          <Tooltip permanent direction="top">
            {`CONFLICT IN ${Math.floor(c.timeToConflictSec / 60)}:${String(c.timeToConflictSec % 60).padStart(2, '0')} · ${c.minSeparationM}m`}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
