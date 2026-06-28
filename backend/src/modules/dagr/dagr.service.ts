import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * DAGR — the official Greek UAS geographical-zones service (HCAA / HASP),
 * served as an OGC WMS 1.3.0 (UMN MapServer). The raster tiles are loaded
 * directly by Leaflet (no CORS needed for <img> tiles); only GetFeatureInfo
 * (click-to-query) is proxied here because the WMS server lacks CORS headers
 * and only emits text/html | GML (no GeoJSON).
 */
@Injectable()
export class DagrService {
  private readonly logger = new Logger(DagrService.name);

  constructor(private readonly config: ConfigService) {}

  get wmsUrl(): string {
    return (
      this.config.get<string>('dagr.wmsUrl') ||
      'https://dagr.hasp.gov.gr/cgi-bin/mapserv.exe?map=C:/ms4w_3.1.4/MAPFILES/dagr_public_wms.map'
    );
  }

  getConfig() {
    return {
      wmsUrl: this.wmsUrl,
      version: '1.3.0',
      layers: {
        limitations: 'all_limitation_layer',
        approvedFlightsHeatmap: 'allowed_all_flight_layer_heatmap',
      },
      attribution: 'HCAA / HASP — DAGR (Greek UAS geographical zones)',
    };
  }

  private toMercator(lat: number, lon: number): { x: number; y: number } {
    const x = (lon * 20037508.34) / 180;
    const y =
      (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
      (20037508.34 / 180);
    return { x, y };
  }

  /**
   * On-demand check of discrete points (e.g. mission waypoints) against the DAGR
   * Greek UAS zones via WMS GetFeatureInfo. RASTER-only source → advisory, not
   * an authoritative geofence. Capped to bound the slow per-point HTML queries.
   */
  async checkPoints(
    points: { lat: number; lon: number }[],
  ): Promise<{ lat: number; lon: number; hit: boolean }[]> {
    const capped = (points ?? []).slice(0, 12);
    const results: { lat: number; lon: number; hit: boolean }[] = [];
    for (const p of capped) {
      const m = this.toMercator(p.lat, p.lon);
      const d = 300; // metres half-box
      const bbox = `${m.x - d},${m.y - d},${m.x + d},${m.y + d}`;
      const { html } = await this.getFeatureInfo({
        bbox,
        width: '256',
        height: '256',
        i: '128',
        j: '128',
      });
      results.push({ lat: p.lat, lon: p.lon, hit: /<(table|tr|td)/i.test(html) });
    }
    return results;
  }

  /** Proxy a WMS GetFeatureInfo request (returns HTML the server produces). */
  async getFeatureInfo(q: Record<string, string>): Promise<{ html: string }> {
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: q.layers || 'all_limitation_layer',
      QUERY_LAYERS: q.query_layers || q.layers || 'all_limitation_layer',
      CRS: q.crs || 'EPSG:3857',
      BBOX: q.bbox || '',
      WIDTH: q.width || '256',
      HEIGHT: q.height || '256',
      I: q.i || '128',
      J: q.j || '128',
      INFO_FORMAT: 'text/html',
      FEATURE_COUNT: q.feature_count || '10',
    });
    const url = `${this.wmsUrl}&${params.toString()}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const html = await res.text();
      return { html };
    } catch (e) {
      this.logger.warn(`DAGR GetFeatureInfo failed: ${(e as Error).message}`);
      return { html: '' };
    }
  }
}
