import { Injectable, Logger } from '@nestjs/common';
import { FlightsService } from '../flights/flights.service';
import { WeatherService } from '../weather/weather.service';
import { AirspaceService } from '../airspace/airspace.service';
import { AdsbService } from '../adsb/adsb.service';
import { ClaudeService } from '../ai/claude.service';
import { NotamService } from '../notam/notam.service';

type Verdict = 'GREEN' | 'AMBER' | 'RED';

function haversineNm(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return (2 * R * Math.asin(Math.min(1, Math.sqrt(h)))) / 1852;
}

/**
 * Pre-flight briefing orchestrator: fans out to weather go/no-go, airspace
 * geofence, live ADS-B traffic and NOTAM (stub) for a flight's route, then
 * aggregates a single GREEN / AMBER / RED verdict. Uses allSettled so one
 * failing source degrades only its own section.
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly flightsService: FlightsService,
    private readonly weatherService: WeatherService,
    private readonly airspaceService: AirspaceService,
    private readonly adsbService: AdsbService,
    private readonly claudeService: ClaudeService,
    private readonly notamService: NotamService,
  ) {}

  /**
   * Pre-Flight Authorization Agent: builds the deterministic briefing, then asks
   * Claude to reason over the assembled evidence and issue an authorization
   * decision with cited reasoning. Deterministic checks remain the source of
   * truth; the LLM adds judgment over marginal cases + an operator rationale.
   */
  async assessFlight(flightId: string) {
    const briefing = await this.getFlightBriefing(flightId);

    const wx = briefing.sections.weather as Record<string, unknown>;
    const air = briefing.sections.airspace as Record<string, unknown>;
    const traffic = briefing.sections.traffic as Record<string, unknown>;

    const evidence = [
      `FLIGHT: ${briefing.flightNumber} | route ${briefing.route.departureHub ?? '?'} -> ${briefing.route.arrivalHub ?? '?'} at ${briefing.route.altitudeM} m`,
      `DETERMINISTIC VERDICT (rules engine): ${briefing.verdict}`,
      `WEATHER: ${wx.status === 'ok' ? `${wx.verdict} at ${wx.icao} (${wx.flightCategory}), wind ${wx.windMs} m/s. ${(wx.reasons as string[] | undefined)?.join('; ')}` : 'unavailable'}`,
      `AIRSPACE: ${air.status === 'ok' ? `${air.breachCount} zone(s) intersected (worst: ${air.worstSeverity}). ${(air.breaches as Array<{ name: string; zoneType: string; severity: string }> | undefined)?.map((b) => `${b.name} [${b.severity} ${b.zoneType}]`).join('; ')}` : 'unavailable'}`,
      `LIVE TRAFFIC (ADS-B): ${traffic.status === 'ok' ? `${traffic.nearbyCount} manned aircraft near route (${traffic.warningCount} within 1.5NM, ${traffic.cautionCount} within 3NM)${(traffic.nearest as { callsign?: string; distanceNm?: number } | null) ? `, nearest ${(traffic.nearest as { callsign?: string }).callsign} @ ${(traffic.nearest as { distanceNm?: number }).distanceNm} NM` : ''}` : 'unavailable'}`,
      `NOTAM: ${this.notamEvidence(briefing.sections.notam as Record<string, unknown>)}`,
    ].join('\n');

    const system =
      'You are a UAS pre-flight authorization officer for a Greek drone Unmanned Traffic Management (UTM) system. ' +
      'A deterministic rules engine has already gathered live weather, airspace, traffic and NOTAM evidence and computed a verdict. ' +
      'Reason over the evidence and issue an authorization decision: GO, GO_WITH_CONDITIONS, or NO_GO. ' +
      'Safety first and be conservative: any prohibited-zone breach or NO_GO weather is a hard NO_GO. ' +
      'Cite the specific evidence behind each blocking reason or condition. Keep the human summary to 1-3 sentences for an operator.';

    const ai = await this.claudeService.messageJson<{
      decision: 'GO' | 'GO_WITH_CONDITIONS' | 'NO_GO';
      confidence: 'low' | 'medium' | 'high';
      blockingReasons: string[];
      conditions: string[];
      humanSummary: string;
    }>({
      system,
      user: `Assess this flight for authorization based on the live evidence below.\n\n${evidence}`,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          decision: { type: 'string', enum: ['GO', 'GO_WITH_CONDITIONS', 'NO_GO'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          blockingReasons: { type: 'array', items: { type: 'string' } },
          conditions: { type: 'array', items: { type: 'string' } },
          humanSummary: { type: 'string' },
        },
        required: ['decision', 'confidence', 'blockingReasons', 'conditions', 'humanSummary'],
      },
      maxTokens: 2048,
    });

    return {
      flightId,
      flightNumber: briefing.flightNumber,
      enabled: this.claudeService.hasKey(),
      deterministicVerdict: briefing.verdict,
      model: ClaudeService.OPUS,
      ai,
      briefing,
      generatedAt: new Date().toISOString(),
    };
  }

  private notamEvidence(notam: Record<string, unknown>): string {
    if (notam.status !== 'ok') return String(notam.message ?? 'unavailable');
    const items = (notam.items as Array<{ ref: string; subject: string; significance: string }>) || [];
    const head = `${notam.relevantCount} active on route (${notam.criticalCount} restricted/danger, ${notam.warningCount} hazard/obstacle)`;
    const list = items
      .slice(0, 5)
      .map((i) => `${i.ref} [${i.significance}] ${i.subject}`)
      .join('; ');
    return list ? `${head}. ${list}` : head;
  }

  async getFlightBriefing(flightId: string) {
    const flight = await this.flightsService.findById(flightId);
    const dep = flight.departureHub?.location;
    const arr = flight.arrivalHub?.location;
    const alt = flight.maxAltitude || 120;

    const routePoints: { lat: number; lon: number; alt: number }[] = [];
    if (dep?.latitude != null) routePoints.push({ lat: dep.latitude, lon: dep.longitude, alt });
    if (arr?.latitude != null) routePoints.push({ lat: arr.latitude, lon: arr.longitude, alt });

    const [weatherR, airspaceR, trafficR, notamR] = await Promise.allSettled([
      this.weatherService.getGoNoGo(flight.departureHubId),
      routePoints.length >= 1
        ? this.airspaceService.checkPath(routePoints)
        : Promise.resolve(null),
      this.computeTraffic(routePoints),
      this.computeNotam(routePoints, alt),
    ]);

    let verdict: Verdict = 'GREEN';
    const rank = { GREEN: 0, AMBER: 1, RED: 2 } as const;
    const raise = (v: Verdict) => {
      if (rank[v] > rank[verdict]) verdict = v;
    };

    // ── Weather section ──
    let weather: Record<string, unknown>;
    if (weatherR.status === 'fulfilled' && weatherR.value) {
      const w = weatherR.value;
      weather = {
        status: 'ok',
        verdict: w.verdict,
        flightCategory: w.station.flightCategory,
        windMs: w.wind.speedMs,
        icao: w.station.icaoId,
        reasons: w.reasons.map((r) => r.message),
      };
      const wv = w.verdict as string;
      if (wv === 'NO_GO') raise('RED');
      else if (wv === 'CAUTION') raise('AMBER');
    } else {
      weather = { status: 'unavailable' };
      raise('AMBER');
    }

    // ── Airspace section ──
    let airspace: Record<string, unknown>;
    if (airspaceR.status === 'fulfilled' && airspaceR.value) {
      const a = airspaceR.value;
      airspace = {
        status: 'ok',
        breachCount: a.breachCount,
        worstSeverity: a.worstSeverity,
        breaches: a.breaches.map((b) => ({ name: b.name, zoneType: b.zoneType, severity: b.severity, source: b.source })),
      };
      if (a.worstSeverity === 'critical') raise('RED');
      else if (a.worstSeverity === 'warning') raise('AMBER');
    } else {
      airspace = { status: 'unavailable' };
      raise('AMBER');
    }

    // ── Traffic section ──
    let traffic: Record<string, unknown>;
    if (trafficR.status === 'fulfilled') {
      const t = trafficR.value;
      traffic = { status: 'ok', ...t };
      if (t.warningCount > 0) raise('RED');
      else if (t.cautionCount > 0) raise('AMBER');
    } else {
      traffic = { status: 'unavailable' };
    }

    // ── NOTAM section (live autorouter feed) ──
    let notam: Record<string, unknown>;
    if (notamR.status === 'fulfilled' && notamR.value) {
      const n = notamR.value;
      notam = { status: 'ok', ...n };
      if (n.criticalCount > 0) raise('AMBER');
    } else {
      notam = {
        status: 'unavailable',
        message: this.notamService.hasCredentials()
          ? 'NOTAM feed unavailable'
          : 'NOTAM feed not configured',
      };
    }

    return {
      flightId,
      flightNumber: flight.flightNumber,
      verdict,
      route: {
        departureHub: flight.departureHub?.name ?? null,
        arrivalHub: flight.arrivalHub?.name ?? null,
        points: routePoints,
        altitudeM: alt,
      },
      sections: { weather, airspace, traffic, notam },
      generatedAt: new Date().toISOString(),
    };
  }

  private async computeTraffic(routePoints: { lat: number; lon: number; alt: number }[]) {
    if (routePoints.length < 1) {
      return { nearbyCount: 0, cautionCount: 0, warningCount: 0, nearest: null as unknown };
    }
    const aircraft = await this.adsbService.getAircraft().catch(() => []);
    let cautionCount = 0;
    let warningCount = 0;
    let nearest: { callsign: string | null; hex: string; distanceNm: number; altFt: number | null } | null = null;

    for (const ac of aircraft) {
      if (ac.onGround || ac.altitude == null || ac.altitude > 5000) continue;
      let minNm = Infinity;
      for (const p of routePoints) {
        const d = haversineNm([p.lat, p.lon], [ac.lat, ac.lon]);
        if (d < minNm) minNm = d;
      }
      if (minNm <= 1.5) warningCount++;
      else if (minNm <= 3) cautionCount++;
      else continue;
      if (!nearest || minNm < nearest.distanceNm) {
        nearest = { callsign: ac.callsign, hex: ac.hex, distanceNm: Math.round(minNm * 100) / 100, altFt: ac.altitude };
      }
    }
    return { nearbyCount: cautionCount + warningCount, cautionCount, warningCount, nearest };
  }

  /**
   * Live NOTAMs for the Athinai FIR, narrowed to those relevant to this route:
   * within the NOTAM's own radius (+buffer) of a waypoint (or FIR-wide), and
   * reaching the drone's operating band. Advisory — geofence owns hard zone gates.
   */
  private async computeNotam(routePoints: { lat: number; lon: number; alt: number }[], altM: number) {
    const notams = await this.notamService.getNotams([NotamService.GREEK_FIR]);
    const ceilingFt = altM * 3.28084 + 500; // drone operating band + buffer
    const BUFFER_NM = 3;

    const relevant = notams.filter((n) => {
      // Altitude band: skip NOTAMs whose lower limit is above the drone band.
      if (n.lowerFt != null && n.lowerFt > ceilingFt) return false;
      // Geography: FIR-wide / no geometry → relevant; else within radius+buffer.
      if (!n.center || n.radiusNm == null) return true;
      if (routePoints.length === 0) return true;
      const reach = n.radiusNm + BUFFER_NM;
      return routePoints.some(
        (p) => haversineNm([p.lat, p.lon], [n.center!.lat, n.center!.lon]) <= reach,
      );
    });

    const criticalCount = relevant.filter((n) => n.significance === 'critical').length;
    const warningCount = relevant.filter((n) => n.significance === 'warning').length;

    return {
      total: notams.length,
      relevantCount: relevant.length,
      criticalCount,
      warningCount,
      items: relevant.slice(0, 8).map((n) => ({
        ref: n.ref,
        subject: n.subject,
        significance: n.significance,
        scope: n.scope,
        text: n.text.length > 220 ? n.text.slice(0, 220) + '…' : n.text,
        schedule: n.schedule,
        end: n.end,
        permanent: n.permanent,
      })),
      message:
        relevant.length === 0
          ? 'No active NOTAMs affecting this route'
          : `${relevant.length} active NOTAM(s) on route` +
            (criticalCount ? `, ${criticalCount} restricted/danger area` : ''),
    };
  }
}
