import { Injectable } from '@nestjs/common';
import { FlightsService } from '../flights/flights.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AdsbService } from '../adsb/adsb.service';
import { DemoScenarioService } from './demo-scenario.service';
import { advance, haversineMeters } from './geo';
import type {
  ForesightObject,
  ForesightTimeline,
  PredictedConflict,
  ResolutionManeuver,
} from './foresight.types';

const KNOTS_TO_MPS = 0.514444;
const FTMIN_TO_MPS = 0.00508;
const FT_TO_M = 0.3048;
const HORIZ_THRESHOLD_M = 150;
const VERT_THRESHOLD_M = 30;

// Bounds on client-supplied prediction parameters. The loop is O((horizon/step) × N²),
// so unbounded horizon / tiny step is a denial-of-service vector — clamp both, and
// guard against NaN from bad query parsing.
const MAX_HORIZON_SEC = 1800; // 30 min look-ahead ceiling
const MIN_STEP_SEC = 1;
const MAX_STEP_SEC = 60;
const MAX_MANEUVERS = 16;

/** Clamp to [min, max], falling back to `fallback` for NaN/non-finite input. */
function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

interface PredictOpts {
  horizonSec?: number;
  stepSec?: number;
}

@Injectable()
export class PredictionService {
  constructor(
    private readonly flights: FlightsService,
    private readonly telemetry: TelemetryService,
    private readonly adsb: AdsbService,
    private readonly demo: DemoScenarioService,
  ) {}

  /** Gather current live state, then run the prediction math. */
  async predict(
    opts: PredictOpts = {},
    maneuvers: ResolutionManeuver[] = [],
  ): Promise<ForesightTimeline> {
    const objects = await this.gatherNowState();
    return this.predictFromObjects(objects, opts, maneuvers);
  }

  /** Pure prediction core: propagate objects forward, find CPAs. No I/O. */
  predictFromObjects(
    input: ForesightObject[],
    opts: PredictOpts = {},
    maneuvers: ResolutionManeuver[] = [],
  ): ForesightTimeline {
    const stepSec = clamp(opts.stepSec, MIN_STEP_SEC, MAX_STEP_SEC, 5);
    const horizonSec = clamp(opts.horizonSec, stepSec, MAX_HORIZON_SEC, 600);
    const safeManeuvers = maneuvers.slice(0, MAX_MANEUVERS);
    const objects = input.map((o) => this.applyManeuver(o, safeManeuvers));
    const steps = Math.floor(horizonSec / stepSec);

    // Per-step advanced snapshots, starting from t=0.
    let current = objects.map((o) => ({ ...o }));
    const frames = [] as ForesightTimeline['frames'];
    // Track the minimum separation per object pair across the horizon.
    const best = new Map<string, { sepM: number; tSec: number; lat: number; lon: number; altM: number }>();

    for (let i = 0; i <= steps; i++) {
      const tSec = i * stepSec;

      frames.push({
        tOffsetSec: tSec,
        objects: current.map((o) => ({ id: o.id, lat: o.lat, lon: o.lon, altitudeM: o.altitudeM })),
      });

      for (let a = 0; a < current.length; a++) {
        for (let b = a + 1; b < current.length; b++) {
          const oa = current[a];
          const ob = current[b];
          if (oa.kind === 'manned' && ob.kind === 'manned') continue; // UTM cares about drones
          const horizM = haversineMeters(oa, ob);
          const vertM = Math.abs(oa.altitudeM - ob.altitudeM);
          if (horizM >= HORIZ_THRESHOLD_M || vertM >= VERT_THRESHOLD_M) continue;
          const key = [oa.id, ob.id].sort().join('::');
          const prev = best.get(key);
          if (!prev || horizM < prev.sepM) {
            best.set(key, {
              sepM: horizM,
              tSec,
              lat: (oa.lat + ob.lat) / 2,
              lon: (oa.lon + ob.lon) / 2,
              altM: (oa.altitudeM + ob.altitudeM) / 2,
            });
          }
        }
      }

      // Advance, honoring holds (object stays put until its delay elapses).
      current = current.map((o) => this.advanceWithHold(o, tSec, stepSec, safeManeuvers));
    }

    const byId = new Map(objects.map((o) => [o.id, o]));
    const predictedConflicts: PredictedConflict[] = [...best.entries()].map(([key, v]) => {
      const [idA, idB] = key.split('::');
      const oa = byId.get(idA)!;
      const ob = byId.get(idB)!;
      return {
        id: `pc-${key}`,
        timeToConflictSec: v.tSec,
        minSeparationM: Math.round(v.sepM),
        location: { lat: v.lat, lon: v.lon },
        altitudeM: Math.round(v.altM),
        primary: { id: oa.id, label: oa.label },
        secondary: { id: ob.id, label: ob.label },
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      horizonSec,
      stepSec,
      objects,
      frames,
      predictedConflicts,
    };
  }

  /** Apply maneuvers that change the object's INITIAL state (altitude, lateral offset). */
  private applyManeuver(o: ForesightObject, maneuvers: ResolutionManeuver[]): ForesightObject {
    let out = { ...o };
    for (const m of maneuvers) {
      if (m.objectId !== o.id) continue;
      if (m.kind === 'altitude' && m.altitudeDeltaM != null) {
        out = { ...out, altitudeM: out.altitudeM + m.altitudeDeltaM };
      }
      if (m.kind === 'lateral' && m.lateralOffsetM != null) {
        // Offset perpendicular (90° right of heading) by lateralOffsetM.
        const side: ForesightObject = { ...out, headingDeg: (out.headingDeg + 90) % 360, speedMps: m.lateralOffsetM, verticalSpeedMps: 0 };
        const moved = advance(side, 1); // speed*1s = lateralOffsetM meters
        out = { ...out, lat: moved.lat, lon: moved.lon };
      }
    }
    return out;
  }

  /** Advance one object by stepSec, but keep it stationary while inside an active hold window. */
  private advanceWithHold(
    o: ForesightObject,
    tSec: number,
    stepSec: number,
    maneuvers: ResolutionManeuver[],
  ): ForesightObject {
    const hold = maneuvers.find(
      (m) => m.objectId === o.id && m.kind === 'hold' && m.delaySec != null,
    );
    if (hold && tSec < (hold.delaySec as number)) {
      return { ...o }; // still holding — no movement this step
    }
    return advance(o, stepSec);
  }

  /** Build the live now-state object list from telemetry, ADS-B and the demo scenario. */
  private async gatherNowState(): Promise<ForesightObject[]> {
    const objects: ForesightObject[] = [];

    // 1) Active drone flights → latest telemetry.
    try {
      const flights = await this.flights.findAll({ status: 'active' });
      for (const f of flights) {
        const t = await this.telemetry.getLatest(f.id);
        if (!t || t.latitude == null || t.longitude == null) continue;
        objects.push({
          id: `flight:${f.id}`,
          kind: 'drone',
          label: f.flightNumber ?? f.id,
          lat: t.latitude,
          lon: t.longitude,
          altitudeM: t.altitudeMsl ?? 0,
          headingDeg: t.heading ?? 0,
          speedMps: t.groundSpeed ?? 0, // telemetry already m/s (confirmed in build step)
          verticalSpeedMps: t.verticalSpeed ?? 0,
        });
      }
    } catch {
      // best-effort; live data may be unavailable
    }

    // 2) Live manned aircraft (ADS-B).
    try {
      const aircraft = await this.adsb.getAircraft();
      for (const ac of aircraft) {
        if (ac.onGround || ac.lat == null || ac.lon == null) continue;
        objects.push({
          id: `adsb:${ac.hex}`,
          kind: 'manned',
          label: ac.callsign ?? ac.hex,
          lat: ac.lat,
          lon: ac.lon,
          altitudeM: (ac.altitude ?? 0) * FT_TO_M,
          headingDeg: ac.track ?? 0,
          speedMps: (ac.groundSpeed ?? 0) * KNOTS_TO_MPS,
          verticalSpeedMps: (ac.verticalRate ?? 0) * FTMIN_TO_MPS,
        });
      }
    } catch {
      // best-effort
    }

    // 3) Demo scenario objects (deterministic, advanced to now).
    try {
      objects.push(...this.demo.getObjects());
    } catch {
      // best-effort
    }

    return objects;
  }
}
