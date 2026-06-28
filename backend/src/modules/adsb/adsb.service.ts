import { Injectable, Logger } from '@nestjs/common';

/** Normalized live aircraft position (ADS-B). */
export interface Aircraft {
  hex: string;
  callsign: string | null;
  lat: number;
  lon: number;
  altitude: number | null; // feet (baro), 0 when on ground
  groundSpeed: number | null; // knots
  track: number | null; // degrees
  verticalRate: number | null; // ft/min
  type: string | null; // aircraft type code
  registration: string | null;
  onGround: boolean;
  squawk: string | null;
  emergency: boolean;
}

interface AdsbLolAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  emergency?: string;
}

interface AdsbLolResponse {
  ac?: AdsbLolAircraft[];
}

/**
 * Live manned-aircraft positions over Greece via adsb.lol (free, no key, ODbL).
 * Polled SERVER-SIDE once per TTL and shared across all clients to respect the
 * ~1 req/sec fair-use limit. Radius is in NAUTICAL MILES (max 250); two centers
 * cover the Greek mainland + Aegean and Crete/southern Aegean.
 */
@Injectable()
export class AdsbService {
  private readonly logger = new Logger(AdsbService.name);
  private readonly BASE = 'https://api.adsb.lol/v2/point';
  private readonly CENTERS = [
    { lat: 38.3, lon: 24.0, r: 250 }, // mainland + Aegean
    { lat: 35.2, lon: 25.5, r: 200 }, // Crete + southern Aegean
  ];
  private readonly TTL = 3000;
  private cache: { at: number; data: Aircraft[] } | null = null;
  private inflight: Promise<Aircraft[]> | null = null;

  async getAircraft(): Promise<Aircraft[]> {
    if (this.cache && Date.now() - this.cache.at < this.TTL) {
      return this.cache.data;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.fetchAll().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchAll(): Promise<Aircraft[]> {
    const byHex = new Map<string, Aircraft>();
    let anySuccess = false;

    for (const c of this.CENTERS) {
      try {
        const res = await fetch(`${this.BASE}/${c.lat}/${c.lon}/${c.r}`, {
          headers: { 'User-Agent': 'DROPS-UTM/0.1 (drone traffic management)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          this.logger.warn(`adsb.lol ${c.lat}/${c.lon} -> HTTP ${res.status}`);
          continue;
        }
        anySuccess = true;
        const json = (await res.json()) as AdsbLolResponse;
        for (const a of json.ac || []) {
          if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
          const hex = (a.hex || '').trim();
          if (!hex || byHex.has(hex)) continue;
          const altRaw = a.alt_baro ?? a.alt_geom;
          const onGround = altRaw === 'ground';
          byHex.set(hex, {
            hex,
            callsign: (a.flight || '').trim() || null,
            lat: a.lat,
            lon: a.lon,
            altitude: onGround ? 0 : typeof altRaw === 'number' ? altRaw : null,
            groundSpeed: typeof a.gs === 'number' ? a.gs : null,
            track:
              typeof a.track === 'number'
                ? a.track
                : typeof a.true_heading === 'number'
                  ? a.true_heading
                  : null,
            verticalRate:
              typeof a.baro_rate === 'number'
                ? a.baro_rate
                : typeof a.geom_rate === 'number'
                  ? a.geom_rate
                  : null,
            type: a.t || null,
            registration: a.r || null,
            onGround,
            squawk: a.squawk || null,
            emergency: !!a.emergency && a.emergency !== 'none',
          });
        }
      } catch (e) {
        this.logger.warn(
          `adsb.lol fetch failed for ${c.lat}/${c.lon}: ${(e as Error).message}`,
        );
      }
    }

    // If every upstream call failed, keep serving the last good snapshot.
    if (!anySuccess && this.cache) {
      this.logger.warn('All ADS-B sources failed; serving cached snapshot');
      return this.cache.data;
    }

    const data = Array.from(byHex.values());
    this.cache = { at: Date.now(), data };
    return data;
  }
}
