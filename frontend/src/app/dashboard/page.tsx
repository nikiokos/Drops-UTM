'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plane, Building2, Bot, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { MapView } from '@/components/shared/map-view';
import { flightsApi, hubsApi, dronesApi, conflictsApi, airspaceApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getTelemetrySimulator } from '@/lib/telemetry-simulator';
import { useTelemetryStore } from '@/store/telemetry.store';
import type { MarkerData, PolylineData, PolygonData, DroneMarkerData } from '@/components/shared/map-view';
import type { LucideIcon } from 'lucide-react';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = 'primary',
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  accentColor?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    green: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    red: 'text-red-400 bg-red-400/10 border-red-400/20',
  };
  const colors = colorMap[accentColor] || colorMap.primary;
  const textColor = colors.split(' ')[0];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">
              {title}
            </p>
            <p className={`text-3xl font-bold font-mono tracking-tight ${textColor}`}>
              {String(value).padStart(2, '0')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono tracking-wide uppercase">
              {subtitle}
            </p>
          </div>
          <div className={`flex h-8 w-8 items-center justify-center rounded border ${colors}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RadarWidget() {
  return (
    <div className="relative w-24 h-24 mx-auto">
      {/* Rings */}
      <div className="absolute inset-0 rounded-full border border-primary/10" />
      <div className="absolute inset-3 rounded-full border border-primary/10" />
      <div className="absolute inset-6 rounded-full border border-primary/10" />
      {/* Crosshair */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/10" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/10" />
      {/* Sweep */}
      <div className="absolute inset-0 animate-radar origin-center">
        <div
          className="absolute top-1/2 left-1/2 w-1/2 h-px origin-left"
          style={{
            background: 'linear-gradient(90deg, hsl(185 80% 45% / 0.6), transparent)',
          }}
        />
      </div>
      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
    </div>
  );
}

export default function DashboardPage() {
  const { data: flights } = useQuery({
    queryKey: ['flights'],
    queryFn: () => flightsApi.getAll().then((r) => r.data),
  });

  const { data: hubs } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll().then((r) => r.data),
  });

  const { data: drones } = useQuery({
    queryKey: ['drones'],
    queryFn: () => dronesApi.getAll().then((r) => r.data),
  });

  const { data: conflicts } = useQuery({
    queryKey: ['conflicts-active'],
    queryFn: () => conflictsApi.getActive().then((r) => r.data),
  });

  const { data: zones } = useQuery({
    queryKey: ['airspace-zones'],
    queryFn: () => airspaceApi.getZones().then((r) => r.data),
  });

  const flightList = useMemo(() => Array.isArray(flights) ? flights : flights?.data || [], [flights]);
  const hubList = useMemo(() => Array.isArray(hubs) ? hubs : hubs?.data || [], [hubs]);
  const droneList = useMemo(() => Array.isArray(drones) ? drones : drones?.data || [], [drones]);
  const conflictList = useMemo(() => Array.isArray(conflicts) ? conflicts : conflicts?.data || [], [conflicts]);
  const zoneList: Record<string, unknown>[] = useMemo(() => Array.isArray(zones) ? zones : (zones as unknown as Record<string, unknown>)?.data as Record<string, unknown>[] || [], [zones]);

  const activeFlightsList = useMemo(() => flightList.filter(
    (f: Record<string, unknown>) => f.status === 'active',
  ), [flightList]);
  const activeFlights = activeFlightsList.length;
  const activeHubs = hubList.filter(
    (h: Record<string, unknown>) => h.status === 'active',
  ).length;

  // Telemetry store for live drone positions
  const telemetryDrones = useTelemetryStore((state) => state.drones);
  const simulatorRef = useRef(getTelemetrySimulator());

  const hubMarkers: MarkerData[] = hubList
    .filter((h: Record<string, unknown>) => {
      const loc = h.location as Record<string, unknown> | undefined;
      return loc?.latitude != null && loc?.longitude != null;
    })
    .map((h: Record<string, unknown>) => {
      const loc = h.location as Record<string, unknown>;
      return {
        id: h.id as string,
        position: [Number(loc.latitude), Number(loc.longitude)] as [number, number],
        label: `${h.name} (${h.code})`,
        color: h.status === 'active' ? '#10b981' : h.status === 'maintenance' ? '#f59e0b' : '#6b7280',
      };
    });

  // Build hub location map for flight path lookups
  const hubLocationMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    hubList.forEach((h: Record<string, unknown>) => {
      const loc = h.location as Record<string, unknown> | undefined;
      if (loc?.latitude != null && loc?.longitude != null) {
        map.set(h.id as string, [Number(loc.latitude), Number(loc.longitude)]);
      }
    });
    return map;
  }, [hubList]);

  // Flight polylines
  const flightStatusColors: Record<string, string> = {
    active: '#06b6d4',
    authorized: '#3b82f6',
    planned: '#6b7280',
  };

  const flightPolylines: PolylineData[] = flightList
    .filter((f: Record<string, unknown>) => f.status !== 'completed' && f.status !== 'cancelled')
    .filter((f: Record<string, unknown>) => {
      const depId = (f.departureHub as Record<string, unknown>)?.id ?? f.departureHubId;
      const arrId = (f.arrivalHub as Record<string, unknown>)?.id ?? f.arrivalHubId;
      return depId && arrId && hubLocationMap.has(depId as string) && hubLocationMap.has(arrId as string);
    })
    .map((f: Record<string, unknown>) => {
      const depId = ((f.departureHub as Record<string, unknown>)?.id ?? f.departureHubId) as string;
      const arrId = ((f.arrivalHub as Record<string, unknown>)?.id ?? f.arrivalHubId) as string;
      const status = f.status as string;
      const isActive = status === 'active';
      return {
        id: f.id as string,
        positions: [hubLocationMap.get(depId)!, hubLocationMap.get(arrId)!],
        color: flightStatusColors[status] || '#6b7280',
        weight: isActive ? 3 : 2,
        opacity: isActive ? 0.9 : 0.5,
        dashArray: status === 'planned' ? '8 6' : undefined,
        label: `${f.flightNumber} (${status})`,
      };
    });

  // Airspace zone polygons
  const zoneTypeColors: Record<string, string> = {
    controlled: '#3b82f6',
    restricted: '#f59e0b',
    prohibited: '#ef4444',
    warning: '#eab308',
    corridor: '#06b6d4',
  };

  const airspacePolygons: PolygonData[] = zoneList
    .filter((z: Record<string, unknown>) => {
      const status = z.status as string;
      return status === 'active' || status === 'temporary';
    })
    .filter((z: Record<string, unknown>) => {
      const geo = z.geometry as Record<string, unknown> | undefined;
      const coords = geo?.coordinates as unknown[] | undefined;
      return coords && coords.length >= 3;
    })
    .map((z: Record<string, unknown>) => {
      const geo = z.geometry as Record<string, unknown>;
      const coords = geo.coordinates as { latitude: number; longitude: number }[];
      const zoneType = z.zoneType as string;
      const isProhibited = zoneType === 'prohibited';
      return {
        id: z.id as string,
        positions: coords.map((c) => [Number(c.latitude), Number(c.longitude)] as [number, number]),
        color: zoneTypeColors[zoneType] || '#3b82f6',
        fillColor: zoneTypeColors[zoneType] || '#3b82f6',
        fillOpacity: isProhibited ? 0.25 : 0.12,
        weight: isProhibited ? 2 : 1.5,
        label: `${z.name} (${zoneType})`,
      };
    });

  const recentFlights = flightList.slice(0, 5);

  // Telemetry simulator effect: manage active flight simulations
  useEffect(() => {
    const simulator = simulatorRef.current;
    const currentFlightIds = new Set(simulator.getFlightIds());

    // Add new active flights to simulator
    activeFlightsList.forEach((flight: Record<string, unknown>) => {
      const flightId = flight.id as string;
      if (currentFlightIds.has(flightId)) {
        currentFlightIds.delete(flightId);
        return;
      }

      const depId = ((flight.departureHub as Record<string, unknown>)?.id ?? flight.departureHubId) as string;
      const arrId = ((flight.arrivalHub as Record<string, unknown>)?.id ?? flight.arrivalHubId) as string;

      const startPos = hubLocationMap.get(depId);
      const endPos = hubLocationMap.get(arrId);

      if (startPos && endPos) {
        const droneId = ((flight.drone as Record<string, unknown>)?.id ?? flight.droneId ?? 'unknown') as string;
        const flightNumber = (flight.flightNumber ?? 'Unknown') as string;
        simulator.addFlight(flightId, droneId, flightNumber, startPos, endPos);
      }
    });

    // Remove flights that are no longer active
    currentFlightIds.forEach((flightId) => {
      simulator.removeFlight(flightId);
    });

    // Start simulator if there are active flights
    if (activeFlightsList.length > 0) {
      simulator.start();
    }

    return () => {
      simulator.stop();
    };
  }, [activeFlightsList, hubLocationMap]);

  // Build drone markers from telemetry store
  const droneMarkers: DroneMarkerData[] = Object.values(telemetryDrones).map((drone) => ({
    id: drone.flightId,
    position: drone.position,
    heading: drone.heading,
    flightNumber: drone.flightNumber,
    altitude: drone.altitude,
    groundSpeed: drone.groundSpeed,
    batteryLevel: drone.batteryLevel,
  }));

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-wide uppercase">Operations Center</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time system overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span>{new Date().toISOString().split('T')[0]}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 stagger-children">
        <StatCard
          title="Active Flights"
          value={activeFlights}
          subtitle="Airborne"
          icon={Plane}
          accentColor="primary"
        />
        <StatCard
          title="Hubs Online"
          value={activeHubs}
          subtitle={`of ${hubList.length} total`}
          icon={Building2}
          accentColor="green"
        />
        <StatCard
          title="Fleet"
          value={droneList.length}
          subtitle="Registered"
          icon={Bot}
          accentColor="amber"
        />
        <StatCard
          title="Conflicts"
          value={conflictList.length}
          subtitle={conflictList.length > 0 ? 'Action Required' : 'All Clear'}
          icon={AlertTriangle}
          accentColor={conflictList.length > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Map section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Tactical Map</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono tracking-wider">
              {hubMarkers.length} HUBS | {flightPolylines.length} FLIGHTS | {droneMarkers.length} DRONES | {airspacePolygons.length} ZONES
            </p>
          </div>
          <RadarWidget />
        </CardHeader>
        <CardContent>
          {hubMarkers.length > 0 ? (
            <MapView
              markers={hubMarkers}
              polylines={flightPolylines}
              polygons={airspacePolygons}
              droneMarkers={droneMarkers}
              center={
                hubMarkers.length > 1
                  ? [
                      hubMarkers.reduce((sum, m) => sum + m.position[0], 0) / hubMarkers.length,
                      hubMarkers.reduce((sum, m) => sum + m.position[1], 0) / hubMarkers.length,
                    ] as [number, number]
                  : hubMarkers[0]?.position
              }
              zoom={hubMarkers.length > 1 ? 6 : 10}
              className="h-[380px] rounded overflow-hidden"
            />
          ) : (
            <div className="h-[380px] rounded border border-dashed border-border flex flex-col items-center justify-center">
              <div className="text-muted-foreground/30 mb-2">
                <Building2 className="h-8 w-8" />
              </div>
              <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
                NO HUBS REGISTERED
              </p>
              <p className="text-xs text-muted-foreground/30 mt-0.5">
                Add hubs to see them on the map
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom panels */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Recent flights */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <CardTitle>Flight Log</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentFlights.length === 0 ? (
              <div className="py-8 text-center">
                <Plane className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
                  NO FLIGHT DATA
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentFlights.map((flight: Record<string, unknown>, i: number) => (
                  <div
                    key={flight.id as string}
                    className="flex items-center justify-between rounded px-3 py-2 hover:bg-accent/30 transition-colors"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-primary/70 w-6">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-base font-medium font-mono">{flight.flightNumber as string}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {flight.plannedDeparture
                            ? formatDate(flight.plannedDeparture as string)
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={flight.status as string} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <CardTitle>System Diagnostics</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[
                { label: 'API SERVER', status: 'CONNECTED', ok: true },
                { label: 'HUBS ONLINE', status: `${activeHubs}/${hubList.length}`, ok: activeHubs > 0 || hubList.length === 0 },
                { label: 'FLEET SIZE', status: `${droneList.length} UNITS`, ok: true },
                { label: 'THREAT LEVEL', status: conflictList.length > 0 ? 'ELEVATED' : 'NOMINAL', ok: conflictList.length === 0 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded px-3 py-2 hover:bg-accent/30 transition-colors"
                >
                  <span className="text-sm text-muted-foreground font-mono tracking-wider">
                    {item.label}
                  </span>
                  <span className={`text-sm font-mono tracking-wider font-semibold ${item.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
