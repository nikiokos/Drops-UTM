import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OpenaipAirspace {
  _id?: string;
  id?: string;
  name?: string;
  type?: number;
  icaoClass?: number;
  upperLimit?: unknown;
  lowerLimit?: unknown;
  geometry?: { type: string; coordinates: unknown };
}

/**
 * openAIP integration — Greek airspace structure (CTR/TMA/restricted/…) and a
 * raster map-tile overlay. The API key is read from config and never leaves the
 * server: REST is called server-side and tiles are proxied so the key is not
 * exposed to the browser. Data is CC BY-NC-SA (non-commercial; needs a paid
 * openAIP licence for production).
 */
@Injectable()
export class OpenaipService {
  private readonly logger = new Logger(OpenaipService.name);
  private readonly REST = 'https://api.core.openaip.net/api';
  private readonly TILES = 'https://api.tiles.openaip.net/api/data/openaip';
  private readonly AIRSPACE_TTL = 60 * 60 * 1000; // 1h — airspace rarely changes
  private airspaceCache: { at: number; data: OpenaipAirspace[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get key(): string {
    return this.config.get<string>('openaip.apiKey') || '';
  }

  hasKey(): boolean {
    return !!this.key;
  }

  async getAirspaces(): Promise<OpenaipAirspace[]> {
    if (this.airspaceCache && Date.now() - this.airspaceCache.at < this.AIRSPACE_TTL) {
      return this.airspaceCache.data;
    }
    if (!this.key) return [];
    try {
      const res = await fetch(`${this.REST}/airspaces?country=GR&limit=1000`, {
        headers: { 'x-openaip-api-key': this.key },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        this.logger.warn(`openAIP airspaces -> HTTP ${res.status}`);
        return this.airspaceCache?.data ?? [];
      }
      const json = (await res.json()) as { items?: OpenaipAirspace[] };
      const data = (json.items ?? []).map((a) => ({
        id: a._id ?? a.id,
        name: a.name,
        type: a.type,
        icaoClass: a.icaoClass,
        upperLimit: a.upperLimit,
        lowerLimit: a.lowerLimit,
        geometry: a.geometry,
      }));
      this.airspaceCache = { at: Date.now(), data };
      this.logger.log(`openAIP: ${data.length} Greek airspaces loaded`);
      return data;
    } catch (e) {
      this.logger.warn(`openAIP airspaces fetch failed: ${(e as Error).message}`);
      return this.airspaceCache?.data ?? [];
    }
  }

  /** Proxy an openAIP raster tile (keeps the API key server-side). */
  async getTile(z: string, x: string, y: string): Promise<Buffer | null> {
    if (!this.key) return null;
    try {
      const res = await fetch(`${this.TILES}/${z}/${x}/${y}.png?apiKey=${this.key}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      this.logger.warn(`openAIP tile ${z}/${x}/${y}: ${(e as Error).message}`);
      return null;
    }
  }
}
