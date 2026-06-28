'use client';

import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

export interface AircraftMarkerData {
  id: string;
  position: [number, number];
  callsign: string | null;
  altitude: number | null;
  groundSpeed: number | null;
  track: number | null;
  type: string | null;
  registration: string | null;
  onGround: boolean;
  emergency: boolean;
}

function planeIcon(track: number | null, emergency: boolean, onGround: boolean): L.DivIcon {
  const rot = track ?? 0;
  const fill = emergency ? '#ef4444' : onGround ? '#94a3b8' : '#fbbf24';
  const stroke = emergency ? '#7f1d1d' : '#78350f';
  // Plane silhouette pointing north (up); rotated clockwise by track degrees.
  const svg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round">
    <path d="M12 2c.6 0 1 .9 1 2v5.2l8 4.8v1.8l-8-2.4V19l2.4 1.6V22L12 21l-3.4 1v-1.4L11 19v-5.6l-8 2.4v-1.8l8-4.8V4c0-1.1.4-2 1-2z"/>
  </svg>`;
  return L.divIcon({
    className: 'aircraft-icon',
    html: `<div style="transform: rotate(${rot}deg); transform-origin: 50% 50%; display:flex; filter: drop-shadow(0 0 1px rgba(0,0,0,0.6));">${svg}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function AircraftMarker({ data }: { data: AircraftMarkerData }) {
  const icon = useMemo(
    () => planeIcon(data.track, data.emergency, data.onGround),
    [data.track, data.emergency, data.onGround],
  );

  return (
    <Marker position={data.position} icon={icon} zIndexOffset={500}>
      <Tooltip direction="top" offset={[0, -10]} className="map-tooltip-lg">
        <div className="space-y-1 min-w-[150px]">
          <div className="font-bold text-sm border-b border-current/20 pb-1 flex items-center gap-1.5">
            {data.callsign || data.id.toUpperCase()}
            {data.emergency && <span className="text-red-500 font-mono text-[10px]">EMERG</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">TYPE</span>
            <span className="font-mono">{data.type || '—'}</span>
            <span className="text-muted-foreground">REG</span>
            <span className="font-mono">{data.registration || '—'}</span>
            <span className="text-muted-foreground">ALT</span>
            <span className="font-mono">{data.altitude != null ? `${data.altitude} ft` : '—'}</span>
            <span className="text-muted-foreground">SPD</span>
            <span className="font-mono">{data.groundSpeed != null ? `${Math.round(data.groundSpeed)} kt` : '—'}</span>
            <span className="text-muted-foreground">HDG</span>
            <span className="font-mono">{data.track != null ? `${Math.round(data.track)}°` : '—'}</span>
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
