import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Normalized, operator-friendly NOTAM. */
export interface Notam {
  id: number;
  ref: string; // e.g. "A1588/26"
  fir: string;
  itemA: string[]; // affected FIR / aerodrome ICAOs
  qcode: string; // full Q-code subject+condition, e.g. "RDCD"
  subject: string; // human label for code23
  significance: 'critical' | 'warning' | 'info';
  scope: string; // A=aerodrome E=enroute W=nav-warning
  text: string; // item E (free text)
  schedule: string | null; // item D (active schedule), if any
  lowerFt: number | null; // item F lower limit
  upperFt: number | null; // item G upper limit
  center: { lat: number; lon: number } | null;
  radiusNm: number | null;
  start: string; // ISO
  end: string | null; // ISO, null = permanent
  permanent: boolean;
  estimated: boolean;
}

interface AutorouterRow {
  id: number;
  nof: string;
  series: string;
  number: number;
  year: number;
  fir: string;
  code23: string;
  code45: string;
  scope: string;
  lower: number;
  upper: number;
  lon: number;
  lat: number;
  radius: number;
  startvalidity: number;
  endvalidity: number;
  estimation: number | null;
  itema: string[] | null;
  itemd: string | null;
  iteme: string | null;
  itemf: string | null;
  itemg: string | null;
  suppressed: boolean;
}

interface AutorouterResponse {
  total: number;
  rows: AutorouterRow[];
}

const PERM_EPOCH = 2147483647; // autorouter's "permanent" end-validity sentinel

// Human labels for the most common ICAO Q-code subjects (code23, letters 2-3).
const SUBJECTS: Record<string, string> = {
  RA: 'Restricted area',
  RD: 'Danger area',
  RP: 'Prohibited area',
  RR: 'Reserved area',
  RT: 'Temporary restricted area',
  RO: 'Overflying restriction',
  RM: 'Military operating area',
  WU: 'Unmanned aircraft activity',
  WP: 'Parachuting / paragliding',
  WE: 'Aerial exercise',
  WB: 'Aerobatics',
  WS: 'Shooting / blasting',
  WW: 'Significant volcanic activity',
  WV: 'Formation flight',
  WM: 'Missile / gun / rocket firing',
  WA: 'Air display',
  WT: 'Mass movement of aircraft',
  OB: 'Obstacle',
  OL: 'Obstacle lights',
  GG: 'GNSS / GPS outage',
  GA: 'GNSS augmentation outage',
  FA: 'Aerodrome',
  AF: 'Flight information / advisory service',
  AT: 'Terminal control area',
  AC: 'Controlled airspace',
  AD: 'Air defence identification zone',
  AN: 'Area navigation route',
  AE: 'Control area',
};

/**
 * Live NOTAM feed for Greek airspace via the autorouter API (OAuth2
 * client_credentials = account email + password). A bearer token is cached for
 * its lifetime and refreshed lazily. Rows are paginated, normalized into a clean
 * shape, and filtered to NOTAMs in force now. Used by the pre-flight briefing.
 */
@Injectable()
export class NotamService {
  private readonly logger = new Logger(NotamService.name);
  private readonly TOKEN_URL = 'https://api.autorouter.aero/v1.0/oauth2/token';
  private readonly NOTAM_URL = 'https://api.autorouter.aero/v1.0/notam';

  // Athinai FIR + the main Greek aerodromes — the default national scope.
  static readonly GREEK_FIR = 'LGGG';

  private token: { value: string; expiresAt: number } | null = null;
  private cache = new Map<string, { at: number; data: Notam[] }>();
  private readonly TTL = 5 * 60 * 1000; // 5 min — NOTAMs change slowly

  constructor(private readonly config: ConfigService) {}

  private get clientId(): string {
    return this.config.get<string>('autorouter.clientId') || '';
  }
  private get clientSecret(): string {
    return this.config.get<string>('autorouter.clientSecret') || '';
  }

  hasCredentials(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  private async getToken(): Promise<string | null> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }
    if (!this.hasCredentials()) return null;
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });
      const res = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        this.logger.warn(`autorouter token HTTP ${res.status}`);
        return null;
      }
      const json = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!json.access_token) return null;
      this.token = {
        value: json.access_token,
        expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
      };
      return this.token.value;
    } catch (e) {
      this.logger.warn(`autorouter token failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Fetch all NOTAMs for the given ICAO FIR/aerodrome codes, normalized and
   * filtered to those in force at `now`. Returns [] if creds/network fail.
   */
  async getNotams(icaos: string[] = [NotamService.GREEK_FIR]): Promise<Notam[]> {
    const key = icaos.slice().sort().join(',');
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.TTL) return hit.data;

    const token = await this.getToken();
    if (!token) return hit?.data ?? [];

    try {
      const all: AutorouterRow[] = [];
      const limit = 100;
      for (let offset = 0; offset < 1000; offset += limit) {
        const url = new URL(this.NOTAM_URL);
        url.searchParams.set('itemas', JSON.stringify(icaos));
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('limit', String(limit));
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          this.logger.warn(`autorouter notam HTTP ${res.status}`);
          break;
        }
        const json = (await res.json()) as AutorouterResponse;
        const rows = json.rows || [];
        all.push(...rows);
        if (rows.length < limit || all.length >= json.total) break;
      }

      const now = Math.floor(Date.now() / 1000);
      const data = all
        .filter((r) => !r.suppressed && r.startvalidity <= now && r.endvalidity >= now)
        .map((r) => this.normalize(r))
        .sort((a, b) => sevRank(b.significance) - sevRank(a.significance));

      this.cache.set(key, { at: Date.now(), data });
      return data;
    } catch (e) {
      this.logger.warn(`autorouter notam fetch failed: ${(e as Error).message}`);
      return hit?.data ?? [];
    }
  }

  private normalize(r: AutorouterRow): Notam {
    const qcode = `${r.code23}${r.code45}`;
    const permanent = r.endvalidity >= PERM_EPOCH;
    const hasCenter = Number.isFinite(r.lat) && Number.isFinite(r.lon) && !(r.lat === 0 && r.lon === 0);
    return {
      id: r.id,
      ref: `${r.series}${r.number}/${String(r.year).padStart(2, '0')}`,
      fir: r.fir,
      itemA: r.itema || [],
      qcode,
      subject: SUBJECTS[r.code23] || `Q-code ${qcode}`,
      significance: classify(r.code23),
      scope: r.scope.trim(),
      text: (r.iteme || '').trim(),
      schedule: r.itemd ? r.itemd.trim() : null,
      lowerFt: limitToFt(r.itemf, r.lower),
      upperFt: limitToFt(r.itemg, r.upper),
      center: hasCenter ? { lat: r.lat / 1e7, lon: r.lon / 1e7 } : null,
      radiusNm: r.radius > 0 ? r.radius : null,
      start: new Date(r.startvalidity * 1000).toISOString(),
      end: permanent ? null : new Date(r.endvalidity * 1000).toISOString(),
      permanent,
      estimated: !!r.estimation,
    };
  }
}

function sevRank(s: Notam['significance']): number {
  return s === 'critical' ? 2 : s === 'warning' ? 1 : 0;
}

/** Map an ICAO Q-code subject (code23) to operational significance for drones. */
function classify(code23: string): Notam['significance'] {
  const c = (code23 || '').toUpperCase();
  // Active restriction / prohibited / danger areas — highest impact on UAS ops.
  if (c === 'RP' || c === 'RD' || c === 'RT' || c === 'RA' || c === 'RR') return 'critical';
  // Hazards drones must avoid or that degrade flight.
  if (c.startsWith('W')) return 'warning'; // warnings incl. unmanned/parachute/firing
  if (c.startsWith('O')) return 'warning'; // obstacles + obstacle lights
  if (c.startsWith('G')) return 'warning'; // GNSS / GPS outages
  if (c.startsWith('R')) return 'warning'; // other restrictions
  return 'info';
}

/**
 * Parse a NOTAM item F/G altitude limit to feet. autorouter also exposes numeric
 * lower/upper in hundreds of feet (flight levels); use the free-text item when
 * present (handles GND/SFC/UNL), else fall back to the FL number.
 */
function limitToFt(item: string | null, fl: number): number | null {
  if (item) {
    const t = item.toUpperCase();
    if (t.includes('GND') || t.includes('SFC')) return 0;
    if (t.includes('UNL')) return 99999;
    const m = t.match(/(\d+)\s*FT/);
    if (m) return parseInt(m[1], 10);
    const flm = t.match(/FL\s*(\d+)/);
    if (flm) return parseInt(flm[1], 10) * 100;
  }
  if (Number.isFinite(fl)) {
    if (fl >= 999) return 99999; // sentinel for unlimited
    return fl * 100;
  }
  return null;
}
