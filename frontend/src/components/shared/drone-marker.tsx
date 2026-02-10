'use client';

import { useEffect, useRef } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';

export interface DroneMarkerData {
  id: string;
  position: [number, number];
  heading: number;
  flightNumber: string;
  altitude: number;
  groundSpeed: number;
  batteryLevel: number;
}

interface DroneMarkerProps {
  data: DroneMarkerData;
}

function getBatteryColor(level: number): string {
  if (level > 60) return 'text-emerald-400';
  if (level > 30) return 'text-amber-400';
  return 'text-red-400';
}

export function DroneMarker({ data }: DroneMarkerProps) {
  const markerRef = useRef<L.CircleMarker>(null);

  // Animate position changes
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      marker.setLatLng(data.position);
    }
  }, [data.position]);

  return (
    <CircleMarker
      ref={markerRef}
      center={data.position}
      radius={10}
      pathOptions={{
        color: '#0e7490',
        fillColor: '#06b6d4',
        fillOpacity: 0.9,
        weight: 2,
      }}
    >
      <Popup>
        <div className="space-y-1.5 min-w-[140px]">
          <div className="font-bold text-base border-b border-current/20 pb-1">
            {data.flightNumber}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">ALT</span>
            <span className="font-mono">{data.altitude}m</span>
            <span className="text-muted-foreground">SPD</span>
            <span className="font-mono">{data.groundSpeed} km/h</span>
            <span className="text-muted-foreground">HDG</span>
            <span className="font-mono">{Math.round(data.heading)}&deg;</span>
            <span className="text-muted-foreground">BAT</span>
            <span className={`font-mono font-semibold ${getBatteryColor(data.batteryLevel)}`}>
              {data.batteryLevel}%
            </span>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}
