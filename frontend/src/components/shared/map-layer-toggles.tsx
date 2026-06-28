'use client';

import { PlaneTakeoff, Layers, ShieldAlert } from 'lucide-react';

interface MapLayerTogglesProps {
  showAircraft: boolean;
  setShowAircraft: (fn: (v: boolean) => boolean) => void;
  showAirspace: boolean;
  setShowAirspace: (fn: (v: boolean) => boolean) => void;
  showDroneZones: boolean;
  setShowDroneZones: (fn: (v: boolean) => boolean) => void;
}

const base =
  'flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors';

export function MapLayerToggles({
  showAircraft,
  setShowAircraft,
  showAirspace,
  setShowAirspace,
  showDroneZones,
  setShowDroneZones,
}: MapLayerTogglesProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowAircraft((v) => !v)}
        className={`${base} ${showAircraft ? 'border-amber-400/40 bg-amber-400/10 text-amber-400' : 'border-border text-muted-foreground hover:text-foreground'}`}
        title="Live manned-aircraft traffic (ADS-B / adsb.lol)"
      >
        <PlaneTakeoff className="h-3 w-3" /> Live Traffic
      </button>
      <button
        type="button"
        onClick={() => setShowAirspace((v) => !v)}
        className={`${base} ${showAirspace ? 'border-blue-400/40 bg-blue-400/10 text-blue-400' : 'border-border text-muted-foreground hover:text-foreground'}`}
        title="Airspace structure: CTR/TMA/restricted zones + aerodromes (openAIP)"
      >
        <Layers className="h-3 w-3" /> Airspace
      </button>
      <button
        type="button"
        onClick={() => setShowDroneZones((v) => !v)}
        className={`${base} ${showDroneZones ? 'border-red-400/40 bg-red-400/10 text-red-400' : 'border-border text-muted-foreground hover:text-foreground'}`}
        title="Official Greek drone geographical zones (DAGR / HASP)"
      >
        <ShieldAlert className="h-3 w-3" /> Drone Zones
      </button>
    </div>
  );
}
