import type { ForesightObject } from './foresight.types';

const EARTH_RADIUS = 6371000; // meters

/** Great-circle horizontal distance between two lat/lon points, in meters. */
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Advance an object dtSec seconds along its heading/speed (great-circle) and vertical speed. */
export function advance(o: ForesightObject, dtSec: number): ForesightObject {
  const distance = o.speedMps * dtSec; // meters
  const angular = distance / EARTH_RADIUS;
  const brng = (o.headingDeg * Math.PI) / 180;
  const lat1 = (o.lat * Math.PI) / 180;
  const lon1 = (o.lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    ...o,
    lat: (lat2 * 180) / Math.PI,
    lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
    altitudeM: o.altitudeM + o.verticalSpeedMps * dtSec,
  };
}
