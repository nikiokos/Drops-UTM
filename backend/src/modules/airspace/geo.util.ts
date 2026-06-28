/** Geometry helpers for geofence / airspace-breach checks. */

export type LatLonRing = [number, number][]; // [lat, lon][]

export interface ZoneBreach {
  source: 'local' | 'openaip';
  zoneId?: string;
  name: string;
  zoneType: string;
  floorM: number | null;
  ceilingM: number | null;
  altitudeOverlap: boolean;
  severity: 'critical' | 'warning' | 'info';
  point: { lat: number; lon: number; altM: number };
}

/** Ray-casting point-in-polygon. ring = [[lat,lon], ...] (single outer ring). */
export function pointInRing(lat: number, lon: number, ring: LatLonRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const latI = ring[i][0];
    const lonI = ring[i][1];
    const latJ = ring[j][0];
    const lonJ = ring[j][1];
    const intersect =
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Local AirspaceZone geometry.coordinates ({latitude,longitude}[]) → [lat,lon][] */
export function localRing(
  coords: { latitude: number; longitude: number }[] | undefined,
): LatLonRing {
  return (coords ?? [])
    .filter((c) => c && c.latitude != null && c.longitude != null)
    .map((c) => [Number(c.latitude), Number(c.longitude)] as [number, number]);
}

/** openAIP GeoJSON Polygon coordinates ([[[lon,lat],...]]) → outer ring [lat,lon][] */
export function openaipRing(geometry: { type?: string; coordinates?: unknown } | undefined): LatLonRing {
  if (!geometry || geometry.type !== 'Polygon') return [];
  const coords = geometry.coordinates as number[][][] | undefined;
  const outer = coords?.[0];
  if (!Array.isArray(outer)) return [];
  return outer
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => [Number(p[1]), Number(p[0])] as [number, number]);
}

/** Convert an openAIP vertical limit {value,unit,referenceDatum} to metres (approx; datum ignored). */
export function openaipLimitToM(limit: { value?: number; unit?: number } | undefined): number | null {
  if (!limit || limit.value == null) return null;
  const v = Number(limit.value);
  switch (limit.unit) {
    case 1: // feet
      return v * 0.3048;
    case 6: // flight level (hundreds of feet)
      return v * 100 * 0.3048;
    default: // metres (0) or unknown
      return v;
  }
}

/** True if the sample altitude (m) overlaps the [floor, ceiling] band (nulls = unbounded). */
export function altitudeOverlaps(altM: number, floorM: number | null, ceilingM: number | null): boolean {
  const lo = floorM ?? 0;
  const hi = ceilingM ?? Number.POSITIVE_INFINITY;
  return altM >= lo - 1 && altM <= hi + 1;
}

/** openAIP airspace numeric type → severity + readable label (common ICAO codes). */
export function openaipTypeInfo(type: number | undefined): { label: string; severity: ZoneBreach['severity'] } {
  switch (type) {
    case 3:
      return { label: 'Prohibited', severity: 'critical' };
    case 1:
      return { label: 'Restricted', severity: 'warning' };
    case 2:
      return { label: 'Danger', severity: 'warning' };
    case 4:
      return { label: 'CTR', severity: 'warning' };
    case 21:
      return { label: 'Gliding sector', severity: 'info' };
    default:
      return { label: 'Controlled airspace', severity: 'info' };
  }
}

/** Local zoneType string → severity. */
export function localSeverity(zoneType: string): ZoneBreach['severity'] {
  switch ((zoneType || '').toLowerCase()) {
    case 'prohibited':
      return 'critical';
    case 'restricted':
    case 'danger':
      return 'warning';
    default:
      return 'info';
  }
}

/** Densify a poly-line of waypoints to ~spacingM samples, carrying altitude linearly. */
export function densifyPath(
  points: { lat: number; lon: number; alt?: number }[],
  spacingM = 200,
): { lat: number; lon: number; altM: number }[] {
  const out: { lat: number; lon: number; altM: number }[] = [];
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const hav = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    out.push({ lat: p.lat, lon: p.lon, altM: p.alt ?? 0 });
    const next = points[i + 1];
    if (!next) continue;
    const dist = hav(p, next);
    const steps = Math.floor(dist / spacingM);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({
        lat: p.lat + (next.lat - p.lat) * t,
        lon: p.lon + (next.lon - p.lon) * t,
        altM: (p.alt ?? 0) + ((next.alt ?? 0) - (p.alt ?? 0)) * t,
      });
    }
  }
  return out;
}
