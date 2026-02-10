'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon issue - must run before any marker creation
if (typeof window !== 'undefined') {
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

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

function createDroneIcon(heading: number): L.DivIcon {
  // Diamond/arrow shape pointing up, will be rotated by heading
  const svg = `
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg);">
      <path d="M14 2L22 14L14 26L6 14L14 2Z" fill="#06b6d4" stroke="#0e7490" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="3" fill="#0e7490"/>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'drone-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function getBatteryColor(level: number): string {
  if (level > 60) return 'text-emerald-400';
  if (level > 30) return 'text-amber-400';
  return 'text-red-400';
}

export function DroneMarker({ data }: DroneMarkerProps) {
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();

  const icon = useMemo(() => createDroneIcon(data.heading), [data.heading]);

  // Animate position changes
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      const currentLatLng = marker.getLatLng();
      const targetLatLng = L.latLng(data.position[0], data.position[1]);

      // Only animate if position has changed significantly
      const distance = currentLatLng.distanceTo(targetLatLng);
      if (distance > 1) {
        // Use CSS transition for smooth movement
        const element = marker.getElement();
        if (element) {
          element.style.transition = 'transform 0.9s linear';
        }
        marker.setLatLng(targetLatLng);
      }
    }
  }, [data.position]);

  return (
    <Marker
      ref={markerRef}
      position={data.position}
      icon={icon}
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
    </Marker>
  );
}
