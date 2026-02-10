'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';
import { Waypoint } from '@/store/missions.store';

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

export type EditorMode = 'select' | 'add' | 'draw' | 'hub-to-hub';

interface MissionMapEditorProps {
  waypoints: Waypoint[];
  selectedWaypointId?: string | null;
  mode: EditorMode;
  departureHub?: { id: string; name: string; location: { latitude: number; longitude: number } } | null;
  arrivalHub?: { id: string; name: string; location: { latitude: number; longitude: number } } | null;
  hubs?: Array<{ id: string; name: string; location: { latitude: number; longitude: number } }>;
  onWaypointClick?: (waypoint: Waypoint) => void;
  onWaypointMove?: (waypointId: string, lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onHubSelect?: (hubId: string, type: 'departure' | 'arrival') => void;
  className?: string;
}

const MissionMapInner = dynamic(
  () => import('./mission-map-inner').then((mod) => mod.MissionMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-card rounded-lg border">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);

export function MissionMapEditor({
  waypoints,
  selectedWaypointId,
  mode,
  departureHub,
  arrivalHub,
  hubs = [],
  onWaypointClick,
  onWaypointMove,
  onMapClick,
  onHubSelect,
  className,
}: MissionMapEditorProps) {
  // Calculate center based on waypoints or default to San Francisco
  const center: [number, number] = waypoints.length > 0
    ? [
        waypoints.reduce((sum, wp) => sum + wp.latitude, 0) / waypoints.length,
        waypoints.reduce((sum, wp) => sum + wp.longitude, 0) / waypoints.length,
      ]
    : departureHub?.location
    ? [departureHub.location.latitude, departureHub.location.longitude]
    : [37.7749, -122.4194];

  return (
    <div className={className}>
      <MapErrorBoundary>
        <MissionMapInner
          center={center}
          zoom={13}
          waypoints={waypoints}
          selectedWaypointId={selectedWaypointId}
          mode={mode}
          departureHub={departureHub}
          arrivalHub={arrivalHub}
          hubs={hubs}
          onWaypointClick={onWaypointClick}
          onWaypointMove={onWaypointMove}
          onMapClick={onMapClick}
          onHubSelect={onHubSelect}
        />
      </MapErrorBoundary>
    </div>
  );
}

export type { MissionMapEditorProps };
