'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { DronePosition } from '@/store/telemetry.store';
import type { LiveAircraft } from '@/lib/api';
import { detectConflicts, type ConflictPair } from '@/lib/conflict-detection';
import { useAlertsStore } from '@/store/alerts.store';

/**
 * Computes drone↔manned-aircraft proximity conflicts from the live client-side
 * datasets (simulated drone telemetry + ADS-B), and mirrors WARNING-tier
 * conflicts into the alerts store (added when they appear, resolved when they
 * clear) so they surface in the alerts feed. Returns the live conflict pairs
 * for the map to draw.
 */
export function useConflictDetection(
  drones: DronePosition[],
  aircraft: LiveAircraft[],
): ConflictPair[] {
  const conflicts = useMemo(() => detectConflicts(drones, aircraft), [drones, aircraft]);

  const addAlert = useAlertsStore((s) => s.addAlert);
  const resolveAlert = useAlertsStore((s) => s.resolve);
  const activeAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = new Set<string>();
    for (const c of conflicts) {
      if (c.tier !== 'WARNING') continue;
      const alertId = `conflict-${c.pairId}`;
      current.add(alertId);
      if (!activeAlertIds.current.has(alertId)) {
        addAlert({
          id: alertId,
          droneId: c.droneFlightId,
          flightId: c.droneFlightId,
          alertType: 'collision_warning',
          severity: c.severity,
          message: `Air traffic conflict: ${c.droneFlightNumber} vs ${
            c.aircraftCallsign || c.aircraftHex
          } — ${c.horizontalNm} NM / ${c.verticalFt} ft`,
          data: {
            aircraftHex: c.aircraftHex,
            aircraftCallsign: c.aircraftCallsign,
            horizontalNm: c.horizontalNm,
            verticalFt: c.verticalFt,
          },
          acknowledged: false,
          resolved: false,
          createdAt: new Date(),
        });
      }
    }
    // Resolve alerts whose conflict has cleared.
    for (const id of activeAlertIds.current) {
      if (!current.has(id)) resolveAlert(id);
    }
    activeAlertIds.current = current;
  }, [conflicts, addAlert, resolveAlert]);

  return conflicts;
}
