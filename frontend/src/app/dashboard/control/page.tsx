'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapView } from '@/components/shared/map-view';
import { TelemetryPanel } from '@/components/control/telemetry-panel';
import { ControlPanel } from '@/components/control/control-panel';
import { CommandHistory } from '@/components/control/command-history';
import { AlertsPanel } from '@/components/control/alerts-panel';
import { DroneSelector } from '@/components/control/drone-selector';
import { flightsApi, hubsApi, commandsApi, alertsApi } from '@/lib/api';
import { getTelemetrySimulator } from '@/lib/telemetry-simulator';
import { useTelemetryStore, type DronePosition } from '@/store/telemetry.store';
import { useCommandsStore, type CommandType, type DroneCommandLog } from '@/store/commands.store';
import { useAlertsStore, type DroneAlert } from '@/store/alerts.store';
import { Building2, Radio } from 'lucide-react';
import type { MarkerData, PolylineData, DroneMarkerData } from '@/components/shared/map-view';

export default function ControlCenterPage() {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  // Fetch data
  const { data: flights } = useQuery({
    queryKey: ['flights'],
    queryFn: () => flightsApi.getAll().then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: hubs } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll().then((r) => r.data),
  });

  const flightList = useMemo(() => Array.isArray(flights) ? flights : flights?.data || [], [flights]);
  const hubList = useMemo(() => Array.isArray(hubs) ? hubs : hubs?.data || [], [hubs]);

  const activeFlightsList = useMemo(
    () => flightList.filter((f: Record<string, unknown>) => f.status === 'active'),
    [flightList],
  );

  // Telemetry store
  const telemetryDrones = useTelemetryStore((state) => state.drones);
  const simulatorRef = useRef(getTelemetrySimulator());

  // Commands store
  const commandsHistory = useCommandsStore((state) => state.history);
  const pendingCommands = useCommandsStore((state) => state.pending);
  const addCommand = useCommandsStore((state) => state.addCommand);
  const updateCommandStatus = useCommandsStore((state) => state.updateStatus);

  // Alerts store
  const alerts = useAlertsStore((state) => state.alerts);
  const addAlert = useAlertsStore((state) => state.addAlert);
  const acknowledgeAlert = useAlertsStore((state) => state.acknowledge);
  const resolveAlert = useAlertsStore((state) => state.resolve);

  // Build hub location map
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

  // Hub markers
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
        color: h.status === 'active' ? '#10b981' : '#6b7280',
      };
    });

  // Flight polylines
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
      const isSelected = f.id === selectedFlightId;
      return {
        id: f.id as string,
        positions: [hubLocationMap.get(depId)!, hubLocationMap.get(arrId)!],
        color: isSelected ? '#06b6d4' : '#3b82f6',
        weight: isSelected ? 4 : 2,
        opacity: isSelected ? 1 : 0.5,
        label: f.flightNumber as string,
      };
    });

  // Telemetry simulator effect
  useEffect(() => {
    const simulator = simulatorRef.current;
    const currentFlightIds = new Set(simulator.getFlightIds());

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

    currentFlightIds.forEach((flightId) => {
      simulator.removeFlight(flightId);
    });

    if (activeFlightsList.length > 0) {
      simulator.start();
    }

    return () => {
      simulator.stop();
    };
  }, [activeFlightsList, hubLocationMap]);

  // Auto-select first active flight if none selected
  useEffect(() => {
    if (!selectedFlightId && activeFlightsList.length > 0) {
      setSelectedFlightId(activeFlightsList[0].id as string);
    }
  }, [selectedFlightId, activeFlightsList]);

  // Generate simulated alerts based on telemetry
  useEffect(() => {
    if (!selectedFlightId) return;

    const drone = telemetryDrones[selectedFlightId];
    if (!drone) return;

    // Check for low battery
    if (drone.batteryLevel < 30 && drone.batteryLevel >= 15) {
      const existingAlert = alerts.find(
        (a) => a.droneId === drone.droneId && a.alertType === 'low_battery' && !a.resolved,
      );
      if (!existingAlert) {
        const alert: DroneAlert = {
          id: `alert-${Date.now()}`,
          droneId: drone.droneId,
          flightId: drone.flightId,
          alertType: 'low_battery',
          severity: 'warning',
          message: `Battery at ${Math.round(drone.batteryLevel)}%. Consider returning to base.`,
          acknowledged: false,
          resolved: false,
          createdAt: new Date(),
        };
        addAlert(alert);
      }
    } else if (drone.batteryLevel < 15) {
      const existingAlert = alerts.find(
        (a) =>
          a.droneId === drone.droneId &&
          a.alertType === 'low_battery' &&
          a.severity === 'critical' &&
          !a.resolved,
      );
      if (!existingAlert) {
        const alert: DroneAlert = {
          id: `alert-${Date.now()}`,
          droneId: drone.droneId,
          flightId: drone.flightId,
          alertType: 'low_battery',
          severity: 'critical',
          message: `CRITICAL: Battery at ${Math.round(drone.batteryLevel)}%! Immediate landing required.`,
          acknowledged: false,
          resolved: false,
          createdAt: new Date(),
        };
        addAlert(alert);
      }
    }
  }, [selectedFlightId, telemetryDrones, alerts, addAlert]);

  // Drone markers from telemetry
  const droneMarkers: DroneMarkerData[] = Object.values(telemetryDrones).map((drone) => ({
    id: drone.flightId,
    position: drone.position,
    heading: drone.heading,
    flightNumber: drone.flightNumber,
    altitude: drone.altitude,
    groundSpeed: drone.groundSpeed,
    batteryLevel: drone.batteryLevel,
  }));

  // Get selected drone's telemetry
  const selectedDrone: DronePosition | null = selectedFlightId
    ? telemetryDrones[selectedFlightId] || null
    : null;

  // Active flights for selector
  const activeFlightsForSelector = useMemo(
    () =>
      activeFlightsList.map((f: Record<string, unknown>) => {
        const telemetry = telemetryDrones[f.id as string];
        return {
          flightId: f.id as string,
          droneId: ((f.drone as Record<string, unknown>)?.id ?? f.droneId ?? 'unknown') as string,
          flightNumber: (f.flightNumber ?? 'Unknown') as string,
          batteryLevel: telemetry?.batteryLevel,
        };
      }),
    [activeFlightsList, telemetryDrones],
  );

  // Handle command sending
  const handleCommand = useCallback(
    async (commandType: CommandType) => {
      if (!selectedDrone) return;

      const cmd: DroneCommandLog = {
        id: `cmd-${Date.now()}`,
        droneId: selectedDrone.droneId,
        flightId: selectedDrone.flightId,
        commandType,
        status: 'pending',
        message: 'Command queued',
        issuedAt: new Date(),
      };

      addCommand(cmd);

      try {
        await commandsApi.send(selectedDrone.droneId, {
          commandType,
          flightId: selectedDrone.flightId,
        });

        // Simulate command execution lifecycle
        setTimeout(() => updateCommandStatus(cmd.id, 'acknowledged', 'Command acknowledged'), 500);
        setTimeout(() => updateCommandStatus(cmd.id, 'executing', `Executing ${commandType}`), 2000);
        setTimeout(
          () => updateCommandStatus(cmd.id, 'completed', `${commandType} completed`),
          commandType === 'emergency_stop' ? 3000 : 8000,
        );

        // Execute command in simulator
        const simulator = getTelemetrySimulator();
        simulator.executeCommand(selectedDrone.flightId, commandType);
      } catch {
        updateCommandStatus(cmd.id, 'failed', 'Command failed to send');
      }
    },
    [selectedDrone, addCommand, updateCommandStatus],
  );

  // Handle alert acknowledgment
  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      acknowledgeAlert(alertId);
      try {
        await alertsApi.acknowledge(alertId);
      } catch {
        // Local state already updated
      }
    },
    [acknowledgeAlert],
  );

  // Handle alert resolution
  const handleResolve = useCallback(
    async (alertId: string) => {
      resolveAlert(alertId);
      try {
        await alertsApi.resolve(alertId);
      } catch {
        // Local state already updated
      }
    },
    [resolveAlert],
  );

  // Filter commands for selected drone
  const filteredCommands = useMemo(
    () =>
      selectedDrone
        ? commandsHistory.filter((c) => c.droneId === selectedDrone.droneId)
        : commandsHistory,
    [commandsHistory, selectedDrone],
  );

  // Filter alerts for selected drone
  const filteredAlerts = useMemo(
    () =>
      selectedDrone
        ? alerts.filter((a) => a.droneId === selectedDrone.droneId)
        : alerts,
    [alerts, selectedDrone],
  );

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (selectedDrone) {
      return selectedDrone.position;
    }
    if (hubMarkers.length > 0) {
      return [
        hubMarkers.reduce((sum, m) => sum + m.position[0], 0) / hubMarkers.length,
        hubMarkers.reduce((sum, m) => sum + m.position[1], 0) / hubMarkers.length,
      ] as [number, number];
    }
    return [37.7749, -122.4194] as [number, number];
  }, [selectedDrone, hubMarkers]);

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-wide uppercase">Control Center</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time drone monitoring and command interface
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DroneSelector
            flights={activeFlightsForSelector}
            selectedFlightId={selectedFlightId}
            onSelect={setSelectedFlightId}
          />
          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left column: Map */}
        <Card className="min-h-[500px]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <CardTitle>Tactical View</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground font-mono tracking-wider">
                {hubMarkers.length} HUBS | {droneMarkers.length} ACTIVE
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {hubMarkers.length > 0 ? (
              <MapView
                markers={hubMarkers}
                polylines={flightPolylines}
                droneMarkers={droneMarkers}
                center={mapCenter}
                zoom={selectedDrone ? 12 : 6}
                trackingId={selectedFlightId || undefined}
                className="h-[440px] rounded overflow-hidden"
              />
            ) : (
              <div className="h-[440px] rounded border border-dashed border-border flex flex-col items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
                  NO HUBS REGISTERED
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Telemetry */}
        <TelemetryPanel
          data={
            selectedDrone
              ? {
                  altitude: selectedDrone.altitude,
                  groundSpeed: selectedDrone.groundSpeed,
                  heading: selectedDrone.heading,
                  batteryLevel: selectedDrone.batteryLevel,
                  flightMode: 'AUTO',
                }
              : null
          }
        />
      </div>

      {/* Bottom row: Controls, History, Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <ControlPanel
          droneId={selectedDrone?.droneId || null}
          flightId={selectedDrone?.flightId || null}
          onCommand={handleCommand}
          pendingCommands={pendingCommands}
        />
        <CommandHistory commands={filteredCommands} />
        <AlertsPanel
          alerts={filteredAlerts}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
      </div>
    </div>
  );
}
