import type { DronePosition } from '@/store/telemetry.store';
import type { LiveAircraft } from '@/lib/api';

export type ConflictTier = 'WARNING' | 'CAUTION';

export interface ConflictPair {
  pairId: string;
  droneFlightId: string;
  droneFlightNumber: string;
  dronePos: [number, number];
  droneAltFt: number;
  aircraftHex: string;
  aircraftCallsign: string | null;
  aircraftType: string | null;
  aircraftPos: [number, number];
  aircraftAltFt: number;
  horizontalNm: number;
  verticalFt: number;
  tier: ConflictTier;
  severity: 'warning' | 'critical';
}

const M_PER_NM = 1852;
const M_TO_FT = 3.28084;

// Tiered separation minima.
const WARN_HORIZ_NM = 1.5;
const WARN_VERT_FT = 1000;
const CAUTION_HORIZ_NM = 3.0;
const CAUTION_VERT_FT = 2000;

// Aircraft above this are never a UAS conflict (airliners at cruise); also saves compute.
const MAX_RELEVANT_ALT_FT = 5000;

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface DetectOpts {
  /** Field elevation (ft) added to convert drone metres-AGL → feet-MSL. Greek hubs ≈ sea level. */
  fieldElevationFt?: number;
}

/**
 * Pairwise proximity screen of simulated drones vs live ADS-B aircraft.
 * Drone altitude is METRES (AGL); ADS-B altitude is FEET (MSL) — normalised here.
 */
export function detectConflicts(
  drones: DronePosition[],
  aircraft: LiveAircraft[],
  opts: DetectOpts = {},
): ConflictPair[] {
  const fieldElev = opts.fieldElevationFt ?? 0;
  const conflicts: ConflictPair[] = [];

  const relevant = aircraft.filter(
    (a) =>
      !a.onGround &&
      typeof a.lat === 'number' &&
      typeof a.lon === 'number' &&
      typeof a.altitude === 'number' &&
      a.altitude <= MAX_RELEVANT_ALT_FT,
  );

  for (const drone of drones) {
    const droneAltFt = drone.altitude * M_TO_FT + fieldElev;
    for (const ac of relevant) {
      const acPos: [number, number] = [ac.lat, ac.lon];
      const horizontalNm = haversineMeters(drone.position, acPos) / M_PER_NM;
      const verticalFt = Math.abs(droneAltFt - (ac.altitude as number));

      let tier: ConflictTier | null = null;
      if (horizontalNm < WARN_HORIZ_NM && verticalFt < WARN_VERT_FT) tier = 'WARNING';
      else if (horizontalNm < CAUTION_HORIZ_NM && verticalFt < CAUTION_VERT_FT) tier = 'CAUTION';
      if (!tier) continue;

      const severity: 'warning' | 'critical' =
        tier === 'WARNING' && (ac.emergency || verticalFt < 400 || horizontalNm < 0.5)
          ? 'critical'
          : tier === 'WARNING'
            ? 'warning'
            : 'warning';

      conflicts.push({
        pairId: `${drone.flightId}:${ac.hex}`,
        droneFlightId: drone.flightId,
        droneFlightNumber: drone.flightNumber,
        dronePos: drone.position,
        droneAltFt: Math.round(droneAltFt),
        aircraftHex: ac.hex,
        aircraftCallsign: ac.callsign,
        aircraftType: ac.type,
        aircraftPos: acPos,
        aircraftAltFt: ac.altitude as number,
        horizontalNm: Math.round(horizontalNm * 100) / 100,
        verticalFt: Math.round(verticalFt),
        tier,
        severity,
      });
    }
  }

  // Most urgent first.
  conflicts.sort((a, b) => a.horizontalNm - b.horizontalNm);
  return conflicts;
}
