'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';

// Error boundary to catch Leaflet cleanup errors
class MapErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Silently handle Leaflet cleanup errors
    if (error.message?.includes('removeChild')) {
      console.warn('Leaflet cleanup error caught:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex h-full items-center justify-center bg-card rounded-lg border">
          <p className="text-sm text-muted-foreground">Map unavailable</p>
        </div>
      );
    }
    return this.props.children;
  }
}

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

interface DroneMarkerData {
  id: string;
  position: [number, number];
  heading: number;
  flightNumber: string;
  altitude: number;
  groundSpeed: number;
  batteryLevel: number;
}

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  polylines?: PolylineData[];
  polygons?: PolygonData[];
  circles?: CircleData[];
  droneMarkers?: DroneMarkerData[];
  className?: string;
  trackingId?: string; // Pass this to only recenter when tracking target changes
}

const MapInner = dynamic(
  () => import('./map-inner').then((mod) => mod.MapInner),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-card rounded-lg border"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> },
);

export function MapView({ center = [38.5, 23.8], zoom = 10, markers = [], polylines = [], polygons = [], circles = [], droneMarkers = [], className, trackingId }: MapViewProps) {
  return (
    <div className={className}>
      <MapErrorBoundary>
        <MapInner center={center} zoom={zoom} markers={markers} polylines={polylines} polygons={polygons} circles={circles} droneMarkers={droneMarkers} trackingId={trackingId} />
      </MapErrorBoundary>
    </div>
  );
}

export type { MarkerData, PolylineData, PolygonData, CircleData, DroneMarkerData, MapViewProps };
