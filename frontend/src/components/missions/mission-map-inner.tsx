'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';
import { Waypoint } from '@/store/missions.store';
import { EditorMode } from './mission-map-editor';

const TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};

interface Hub {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
}

interface MissionMapInnerProps {
  center: [number, number];
  zoom: number;
  waypoints: Waypoint[];
  selectedWaypointId?: string | null;
  mode: EditorMode;
  departureHub?: Hub | null;
  arrivalHub?: Hub | null;
  hubs?: Hub[];
  onWaypointClick?: (waypoint: Waypoint) => void;
  onWaypointMove?: (waypointId: string, lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onHubSelect?: (hubId: string, type: 'departure' | 'arrival') => void;
}

// Create waypoint icons
function createWaypointIcon(index: number, isSelected: boolean, isFirst: boolean, isLast: boolean) {
  const bgColor = isFirst ? '#22c55e' : isLast ? '#ef4444' : isSelected ? '#3b82f6' : '#6366f1';
  const size = isSelected ? 32 : 28;

  return L.divIcon({
    className: 'custom-waypoint-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${bgColor};
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: ${isSelected ? '14px' : '12px'};
        cursor: ${isSelected ? 'move' : 'pointer'};
        transition: all 0.15s ease;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Create hub icon
function createHubIcon(isSelected: boolean, isDeparture: boolean) {
  const color = isDeparture ? '#22c55e' : '#ef4444';
  const size = 36;

  return L.divIcon({
    className: 'custom-hub-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 6px;
        background: ${isSelected ? color : 'rgba(0,0,0,0.6)'};
        border: 2px solid ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${isSelected ? 'white' : color};
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function MapClickHandler({
  mode,
  onMapClick,
}: {
  mode: EditorMode;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      if ((mode === 'add' || mode === 'draw') && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function DraggableWaypoint({
  waypoint,
  index,
  isSelected,
  isFirst,
  isLast,
  mode,
  onWaypointClick,
  onWaypointMove,
}: {
  waypoint: Waypoint;
  index: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  mode: EditorMode;
  onWaypointClick?: (waypoint: Waypoint) => void;
  onWaypointMove?: (waypointId: string, lat: number, lng: number) => void;
}) {
  const eventHandlers = {
    click: () => onWaypointClick?.(waypoint),
    dragend: (e: L.DragEndEvent) => {
      const marker = e.target;
      const position = marker.getLatLng();
      onWaypointMove?.(waypoint.id, position.lat, position.lng);
    },
  };

  return (
    <Marker
      position={[waypoint.latitude, waypoint.longitude]}
      icon={createWaypointIcon(index, isSelected, isFirst, isLast)}
      draggable={mode === 'select' && isSelected}
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" offset={[0, -16]} opacity={0.9}>
        <div className="text-xs">
          <div className="font-semibold">{waypoint.name || `Waypoint ${index + 1}`}</div>
          <div className="text-muted-foreground">Alt: {waypoint.altitude}m</div>
          {waypoint.speedToWaypoint && (
            <div className="text-muted-foreground">Speed: {waypoint.speedToWaypoint} m/s</div>
          )}
        </div>
      </Tooltip>
    </Marker>
  );
}

export function MissionMapInner({
  center,
  zoom,
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
}: MissionMapInnerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tileUrl = mounted && resolvedTheme === 'light' ? TILE_URLS.light : TILE_URLS.dark;

  // Sort waypoints by sequence
  const sortedWaypoints = [...waypoints].sort((a, b) => a.sequence - b.sequence);

  // Create flight path polyline
  const flightPath: [number, number][] = sortedWaypoints.map((wp) => [
    wp.latitude,
    wp.longitude,
  ]);

  // Add departure hub to start if exists
  if (departureHub) {
    flightPath.unshift([departureHub.location.latitude, departureHub.location.longitude]);
  }

  // Add arrival hub to end if exists
  if (arrivalHub) {
    flightPath.push([arrivalHub.location.latitude, arrivalHub.location.longitude]);
  }

  // Get cursor style based on mode
  const getCursorClass = () => {
    switch (mode) {
      case 'add':
        return 'cursor-crosshair';
      case 'draw':
        return 'cursor-crosshair';
      case 'hub-to-hub':
        return 'cursor-pointer';
      default:
        return '';
    }
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`h-full w-full rounded-lg ${getCursorClass()}`}
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url={tileUrl}
      />
      <RecenterMap center={center} zoom={zoom} />
      <MapClickHandler mode={mode} onMapClick={onMapClick} />

      {/* Show available hubs in hub-to-hub mode */}
      {mode === 'hub-to-hub' &&
        hubs.map((hub) => (
          <Marker
            key={hub.id}
            position={[hub.location.latitude, hub.location.longitude]}
            icon={createHubIcon(
              hub.id === departureHub?.id || hub.id === arrivalHub?.id,
              hub.id === departureHub?.id
            )}
            eventHandlers={{
              click: () => {
                if (!departureHub) {
                  onHubSelect?.(hub.id, 'departure');
                } else if (!arrivalHub && hub.id !== departureHub.id) {
                  onHubSelect?.(hub.id, 'arrival');
                }
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -20]}>
              <div className="text-xs font-semibold">{hub.name}</div>
            </Tooltip>
          </Marker>
        ))}

      {/* Departure hub marker (when not in hub-to-hub mode) */}
      {mode !== 'hub-to-hub' && departureHub && (
        <>
          <Circle
            center={[departureHub.location.latitude, departureHub.location.longitude]}
            radius={100}
            pathOptions={{
              color: '#22c55e',
              fillColor: '#22c55e',
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
          <Marker
            position={[departureHub.location.latitude, departureHub.location.longitude]}
            icon={createHubIcon(true, true)}
          >
            <Tooltip direction="top" offset={[0, -20]}>
              <div className="text-xs">
                <div className="font-semibold">{departureHub.name}</div>
                <div className="text-green-600">Departure Hub</div>
              </div>
            </Tooltip>
          </Marker>
        </>
      )}

      {/* Arrival hub marker (when not in hub-to-hub mode) */}
      {mode !== 'hub-to-hub' && arrivalHub && (
        <>
          <Circle
            center={[arrivalHub.location.latitude, arrivalHub.location.longitude]}
            radius={100}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
          <Marker
            position={[arrivalHub.location.latitude, arrivalHub.location.longitude]}
            icon={createHubIcon(true, false)}
          >
            <Tooltip direction="top" offset={[0, -20]}>
              <div className="text-xs">
                <div className="font-semibold">{arrivalHub.name}</div>
                <div className="text-red-600">Arrival Hub</div>
              </div>
            </Tooltip>
          </Marker>
        </>
      )}

      {/* Flight path polyline */}
      {flightPath.length > 1 && (
        <Polyline
          positions={flightPath}
          pathOptions={{
            color: '#6366f1',
            weight: 3,
            opacity: 0.8,
            dashArray: mode === 'draw' ? '10, 10' : undefined,
          }}
        />
      )}

      {/* Waypoint markers */}
      {sortedWaypoints.map((waypoint, index) => (
        <DraggableWaypoint
          key={waypoint.id}
          waypoint={waypoint}
          index={index}
          isSelected={waypoint.id === selectedWaypointId}
          isFirst={index === 0}
          isLast={index === sortedWaypoints.length - 1}
          mode={mode}
          onWaypointClick={onWaypointClick}
          onWaypointMove={onWaypointMove}
        />
      ))}
    </MapContainer>
  );
}
