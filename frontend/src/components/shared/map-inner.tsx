'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Polyline, Polygon, Circle, Tooltip } from 'react-leaflet';
import { useTheme } from 'next-themes';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DroneMarker, type DroneMarkerData } from './drone-marker';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const tooltipStyle = { className: 'map-tooltip-lg' } as const;

const TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};

interface MarkerData {
  id: string;
  position: [number, number];
  label?: string;
  color?: string;
}

interface PolylineData {
  id: string;
  positions: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  label?: string;
}

interface PolygonData {
  id: string;
  positions: [number, number][];
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  label?: string;
}

interface CircleData {
  id: string;
  center: [number, number];
  radius: number;
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  label?: string;
}

interface MapInnerProps {
  center: [number, number];
  zoom: number;
  markers: MarkerData[];
  polylines?: PolylineData[];
  polygons?: PolygonData[];
  circles?: CircleData[];
  droneMarkers?: DroneMarkerData[];
  trackingId?: string; // ID of entity to track - only recenter when this changes
}

// Track user interaction and only recenter when tracking target changes
function MapController({
  center,
  zoom,
  trackingId
}: {
  center: [number, number];
  zoom: number;
  trackingId?: string;
}) {
  const map = useMap();
  const hasUserInteracted = useRef(false);
  const lastTrackingId = useRef<string | undefined>(trackingId);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);

  // Keep refs updated with latest values
  centerRef.current = center;
  zoomRef.current = zoom;

  // Listen for user interactions
  useMapEvents({
    zoomstart: () => {
      hasUserInteracted.current = true;
    },
    dragstart: () => {
      hasUserInteracted.current = true;
    },
  });

  // Initial center on mount
  useEffect(() => {
    map.setView(centerRef.current, zoomRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Recenter only when trackingId changes (e.g., selecting a different drone)
  useEffect(() => {
    if (trackingId !== lastTrackingId.current) {
      hasUserInteracted.current = false;
      lastTrackingId.current = trackingId;
      map.setView(centerRef.current, zoomRef.current);
    }
  }, [map, trackingId]);

  return null;
}

export function MapInner({ center, zoom, markers, polylines = [], polygons = [], circles = [], droneMarkers = [], trackingId }: MapInnerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tileUrl = mounted && resolvedTheme === 'light' ? TILE_URLS.light : TILE_URLS.dark;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full rounded-lg"
      style={{ minHeight: '300px' }}
    >
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url={tileUrl}
      />
      <MapController center={center} zoom={zoom} trackingId={trackingId} />
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={marker.position}
          radius={8}
          pathOptions={{
            color: marker.color || '#06b6d4',
            fillColor: marker.color || '#06b6d4',
            fillOpacity: 0.7,
          }}
        >
          {marker.label && <Popup>{marker.label}</Popup>}
        </CircleMarker>
      ))}
      {polygons.map((polygon) => (
        <Polygon
          key={polygon.id}
          positions={polygon.positions}
          pathOptions={{
            color: polygon.color || '#3b82f6',
            fillColor: polygon.fillColor || polygon.color || '#3b82f6',
            fillOpacity: polygon.fillOpacity ?? 0.15,
            weight: polygon.weight ?? 1.5,
          }}
        >
          {polygon.label && <Tooltip sticky {...tooltipStyle}>{polygon.label}</Tooltip>}
        </Polygon>
      ))}
      {circles.map((circle) => (
        <Circle
          key={circle.id}
          center={circle.center}
          radius={circle.radius}
          pathOptions={{
            color: circle.color || '#06b6d4',
            fillColor: circle.fillColor || circle.color || '#06b6d4',
            fillOpacity: circle.fillOpacity ?? 0.08,
            weight: circle.weight ?? 1,
          }}
        >
          {circle.label && <Tooltip sticky {...tooltipStyle}>{circle.label}</Tooltip>}
        </Circle>
      ))}
      {polylines.map((polyline) => (
        <Polyline
          key={polyline.id}
          positions={polyline.positions}
          pathOptions={{
            color: polyline.color || '#06b6d4',
            weight: polyline.weight ?? 2,
            opacity: polyline.opacity ?? 0.7,
            dashArray: polyline.dashArray,
          }}
        >
          {polyline.label && <Tooltip sticky {...tooltipStyle}>{polyline.label}</Tooltip>}
        </Polyline>
      ))}
      {droneMarkers.map((drone) => (
        <DroneMarker key={drone.id} data={drone} />
      ))}
    </MapContainer>
  );
}
