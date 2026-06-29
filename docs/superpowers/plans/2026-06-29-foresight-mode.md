# Foresight Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a predictive look-ahead layer that extrapolates drone + live ADS-B trajectories, detects conflicts before they occur (CPA), has a Claude "Air Traffic Director" propose explainable resolutions, and lets the operator confirm by voice — dramatized on the live tactical map.

**Architecture:** New backend `foresight/` module with a pure-function geo util, a `PredictionService` (gather now-state → propagate forward → pairwise CPA), a `DemoScenarioService` (in-memory scripted 2-drone conflict), and an `AirTrafficDirectorService` (Claude `messageJson` + deterministic fallback). New read-only/preview endpoints. Frontend adds a react-leaflet `ForesightLayer` (ghost trails, pulsing conflict, camera fly-to), controls (toggle/slider/demo button + polling), an Air Traffic Director panel, and a Web Speech voice hook.

**Tech Stack:** NestJS + TypeORM (backend), Jest (backend tests), Next.js 15 + React 19 + react-leaflet v5 + Tailwind (frontend), Web Speech API (voice), Playwright (E2E).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-29-foresight-mode-design.md`.
- All foresight endpoints are **read-only / preview**: none creates, authorizes, aborts, deletes, or calls any real write-endpoint. No DB writes.
- All internal units are **m/s** for speed and **meters** for altitude. ADS-B is knots + ft/min (convert: `knots*0.514444` → m/s, `ftPerMin*0.00508` → m/s); demo-scenario objects are authored in m/s and meters.
- Conflict thresholds: horizontal separation **< 150 m** AND vertical separation **< 30 m**. Only pairs involving at least one non-`manned` object count.
- Prediction defaults: horizon **600 s**, step **5 s**.
- Backend model default for the Director: `ClaudeService.SONNET`. Missing `ANTHROPIC_API_KEY` → deterministic fallback options (the demo must still work).
- Backend tests run with: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest <pattern>`.
- Branch: `feat/live-data-and-utm-safety`. Commit after each task.

---

## File Structure

**Backend (new `backend/src/modules/foresight/`):**
- `foresight.types.ts` — shared types (objects, frames, timeline, conflict, maneuver, director advice).
- `geo.ts` — pure geo helpers (`haversineMeters`, `advance`).
- `prediction.service.ts` — `PredictionService`: gather → propagate → CPA.
- `demo-scenario.service.ts` — `DemoScenarioService`: in-memory scripted conflict.
- `air-traffic-director.service.ts` — `AirTrafficDirectorService`: Claude + fallback.
- `foresight.controller.ts` — endpoints.
- `foresight.module.ts` — wiring.
- Tests: `geo.spec.ts`, `prediction.service.spec.ts`, `air-traffic-director.service.spec.ts`.
- Modify: `backend/src/app.module.ts` (register module).

**Frontend:**
- `frontend/src/lib/api.ts` — add `foresightApi` + types (modify).
- `frontend/src/components/shared/map-inner.tsx`, `map-view.tsx` — forward `children` into `MapContainer` (modify).
- `frontend/src/components/foresight/foresight-layer.tsx` — react-leaflet overlay.
- `frontend/src/components/foresight/foresight-controls.tsx` — toggle/slider/demo + state + polling.
- `frontend/src/components/foresight/air-traffic-director-panel.tsx` — reasoning + option cards.
- `frontend/src/hooks/use-voice-command.ts` — Web Speech hook.
- Mount on the dashboard page (modify the page that renders the map).

---

## Task 1: Geo util + shared types

**Files:**
- Create: `backend/src/modules/foresight/foresight.types.ts`
- Create: `backend/src/modules/foresight/geo.ts`
- Test: `backend/src/modules/foresight/geo.spec.ts`

**Interfaces:**
- Produces: `ForesightObject`, `ForesightFrame`, `PredictedConflict`, `ResolutionManeuver`, `ForesightTimeline`, `DirectorOption`, `DirectorAdvice` (types); `haversineMeters(a, b): number`, `advance(o: ForesightObject, dtSec: number): ForesightObject`.

- [ ] **Step 1: Write the shared types**

Create `backend/src/modules/foresight/foresight.types.ts`:

```ts
/** A single tracked object in the foresight world (drone, manned aircraft, or demo). */
export interface ForesightObject {
  id: string;
  kind: 'drone' | 'manned' | 'demo';
  label: string;
  lat: number;
  lon: number;
  altitudeM: number;
  headingDeg: number;
  speedMps: number;
  verticalSpeedMps: number;
}

/** All object positions at one future time offset. */
export interface ForesightFrame {
  tOffsetSec: number;
  objects: Array<{ id: string; lat: number; lon: number; altitudeM: number }>;
}

/** A conflict predicted to occur in the future. */
export interface PredictedConflict {
  id: string;
  timeToConflictSec: number;
  minSeparationM: number;
  location: { lat: number; lon: number };
  altitudeM: number;
  primary: { id: string; label: string };
  secondary: { id: string; label: string };
}

/** A resolution maneuver applied (as a preview) to one object. */
export interface ResolutionManeuver {
  objectId: string;
  kind: 'hold' | 'altitude' | 'lateral';
  delaySec?: number;
  altitudeDeltaM?: number;
  lateralOffsetM?: number;
}

/** The full prediction result returned to the client. */
export interface ForesightTimeline {
  generatedAt: string;
  horizonSec: number;
  stepSec: number;
  objects: ForesightObject[];
  frames: ForesightFrame[];
  predictedConflicts: PredictedConflict[];
}

/** One resolution option proposed by the Air Traffic Director. */
export interface DirectorOption {
  kind: 'hold' | 'altitude' | 'lateral';
  label: string;
  delaySec?: number;
  altitudeDeltaM?: number;
  lateralOffsetM?: number;
  objectId: string;
  rationale: string;
  sideEffects: string;
}

/** The Director's full assessment of a predicted conflict. */
export interface DirectorAdvice {
  summary: string;
  cause: string;
  options: DirectorOption[];
  recommendedIndex: number;
  source: 'ai' | 'deterministic';
}
```

- [ ] **Step 2: Write the failing geo test**

Create `backend/src/modules/foresight/geo.spec.ts`:

```ts
import { haversineMeters, advance } from './geo';
import type { ForesightObject } from './foresight.types';

const obj = (over: Partial<ForesightObject>): ForesightObject => ({
  id: 'x', kind: 'drone', label: 'X', lat: 36.4, lon: 28.08,
  altitudeM: 120, headingDeg: 0, speedMps: 0, verticalSpeedMps: 0, ...over,
});

describe('geo', () => {
  it('haversineMeters ~111km per degree of latitude', () => {
    const d = haversineMeters({ lat: 36, lon: 28 }, { lat: 37, lon: 28 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('advance moves north by speed*dt when heading is 0', () => {
    const moved = advance(obj({ headingDeg: 0, speedMps: 100 }), 10); // 1000 m north
    const dist = haversineMeters({ lat: 36.4, lon: 28.08 }, moved);
    expect(dist).toBeGreaterThan(950);
    expect(dist).toBeLessThan(1050);
    expect(moved.lat).toBeGreaterThan(36.4); // moved north
  });

  it('advance applies vertical speed to altitude', () => {
    const moved = advance(obj({ verticalSpeedMps: 2 }), 10);
    expect(moved.altitudeM).toBeCloseTo(140, 1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest geo.spec`
Expected: FAIL — cannot find module `./geo`.

- [ ] **Step 4: Implement the geo util**

Create `backend/src/modules/foresight/geo.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest geo.spec`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/foresight/foresight.types.ts backend/src/modules/foresight/geo.ts backend/src/modules/foresight/geo.spec.ts
git commit -m "feat(foresight): geo util + shared types"
```

---

## Task 2: PredictionService (propagate + CPA)

**Files:**
- Create: `backend/src/modules/foresight/prediction.service.ts`
- Test: `backend/src/modules/foresight/prediction.service.spec.ts`

**Interfaces:**
- Consumes: `haversineMeters`, `advance`, types from Task 1; `TelemetryService.getLatest(flightId): Promise<FlightTelemetry | null>`; `AdsbService.getAircraft(): Promise<Aircraft[]>`; `FlightsService.findAll(filters?): Promise<Flight[]>`; `DemoScenarioService.getObjects(): ForesightObject[]` (Task 3 — injected, but the prediction MATH is independent and tested directly here via `predictFromObjects`).
- Produces: `PredictionService.predictFromObjects(objects, opts?, maneuvers?): ForesightTimeline` (pure, no I/O — the unit-tested core); `PredictionService.predict(opts?, maneuvers?): Promise<ForesightTimeline>` (gathers live state then calls `predictFromObjects`).

- [ ] **Step 1: Write the failing prediction test**

Create `backend/src/modules/foresight/prediction.service.spec.ts`:

```ts
import { PredictionService } from './prediction.service';
import type { ForesightObject } from './foresight.types';

// Build the service with no NestJS deps for the pure math path.
const svc = new PredictionService(
  null as never, // flights
  null as never, // telemetry
  null as never, // adsb
  null as never, // demo
);

const headOn = (): ForesightObject[] => [
  { id: 'a', kind: 'demo', label: 'A', lat: 36.30, lon: 28.08, altitudeM: 120, headingDeg: 0, speedMps: 20, verticalSpeedMps: 0 },
  { id: 'b', kind: 'demo', label: 'B', lat: 36.50, lon: 28.08, altitudeM: 120, headingDeg: 180, speedMps: 20, verticalSpeedMps: 0 },
];

describe('PredictionService.predictFromObjects', () => {
  it('detects a head-on conflict and reports time + separation', () => {
    const t = svc.predictFromObjects(headOn(), { horizonSec: 900, stepSec: 5 });
    expect(t.predictedConflicts.length).toBeGreaterThanOrEqual(1);
    const c = t.predictedConflicts[0];
    expect(c.timeToConflictSec).toBeGreaterThan(200);
    expect(c.timeToConflictSec).toBeLessThan(700);
    expect(c.minSeparationM).toBeLessThan(150);
    expect([c.primary.id, c.secondary.id].sort()).toEqual(['a', 'b']);
  });

  it('produces frames spanning the horizon', () => {
    const t = svc.predictFromObjects(headOn(), { horizonSec: 600, stepSec: 5 });
    expect(t.frames.length).toBe(121); // 0..600 inclusive
    expect(t.frames[0].objects.length).toBe(2);
  });

  it('ignores manned-vs-manned pairs', () => {
    const manned: ForesightObject[] = headOn().map((o) => ({ ...o, kind: 'manned' }));
    const t = svc.predictFromObjects(manned, { horizonSec: 900, stepSec: 5 });
    expect(t.predictedConflicts.length).toBe(0);
  });

  it('vertical separation > 30m prevents a conflict', () => {
    const objs = headOn();
    objs[1].altitudeM = 300; // 180 m apart vertically, never converges
    const t = svc.predictFromObjects(objs, { horizonSec: 900, stepSec: 5 });
    expect(t.predictedConflicts.length).toBe(0);
  });

  it('applies an altitude maneuver that clears the conflict', () => {
    const cleared = svc.predictFromObjects(headOn(), { horizonSec: 900, stepSec: 5 }, [
      { objectId: 'a', kind: 'altitude', altitudeDeltaM: 100 },
    ]);
    expect(cleared.predictedConflicts.length).toBe(0);
  });

  it('applies a hold maneuver (object waits, then resumes)', () => {
    // Holding B long enough that A passes first should clear the head-on.
    const cleared = svc.predictFromObjects(headOn(), { horizonSec: 900, stepSec: 5 }, [
      { objectId: 'b', kind: 'hold', delaySec: 600 },
    ]);
    // With a 600s hold, B barely moves while A passes its start latitude → min sep grows.
    const c = cleared.predictedConflicts[0];
    expect(c === undefined || c.minSeparationM >= 150).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest prediction.service.spec`
Expected: FAIL — cannot find module `./prediction.service`.

- [ ] **Step 3: Implement PredictionService**

Create `backend/src/modules/foresight/prediction.service.ts`:

```ts
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
    const horizonSec = opts.horizonSec ?? 600;
    const stepSec = opts.stepSec ?? 5;
    const objects = input.map((o) => this.applyManeuver(o, maneuvers));
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
      current = current.map((o) => this.advanceWithHold(o, tSec, stepSec, maneuvers));
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
    objects.push(...this.demo.getObjects());

    return objects;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest prediction.service.spec`
Expected: PASS (6 tests). The constructor is called with nulls — that is fine because the tested methods (`predictFromObjects`, `applyManeuver`, `advanceWithHold`) never touch the injected deps.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/foresight/prediction.service.ts backend/src/modules/foresight/prediction.service.spec.ts
git commit -m "feat(foresight): prediction service with CPA + maneuver preview"
```

---

## Task 3: DemoScenarioService (scripted conflict)

**Files:**
- Create: `backend/src/modules/foresight/demo-scenario.service.ts`
- Test: append to `backend/src/modules/foresight/prediction.service.spec.ts` (a new describe block) OR a dedicated `demo-scenario.service.spec.ts`. Use a dedicated file.
- Test: `backend/src/modules/foresight/demo-scenario.service.spec.ts`

**Interfaces:**
- Consumes: types from Task 1; `advance` from `geo`.
- Produces: `DemoScenarioService.start(): void`, `.reset(): void`, `.isActive(): boolean`, `.getObjects(): ForesightObject[]` (the two drones advanced to "now" via an injected clock), `.applyResolution(maneuver: ResolutionManeuver): void` (stretch — diverge a demo drone).

- [ ] **Step 1: Write the failing demo test**

Create `backend/src/modules/foresight/demo-scenario.service.spec.ts`:

```ts
import { DemoScenarioService } from './demo-scenario.service';
import { PredictionService } from './prediction.service';

describe('DemoScenarioService', () => {
  it('is inactive until started, then returns two drones', () => {
    let now = 1_000_000;
    const demo = new DemoScenarioService(() => now);
    expect(demo.isActive()).toBe(false);
    expect(demo.getObjects()).toEqual([]);
    demo.start();
    expect(demo.isActive()).toBe(true);
    expect(demo.getObjects().length).toBe(2);
  });

  it('the two demo drones are on a predicted collision course near Rhodes', () => {
    let now = 1_000_000;
    const demo = new DemoScenarioService(() => now);
    demo.start();
    const pred = new PredictionService(null as never, null as never, null as never, demo);
    const t = pred.predictFromObjects(demo.getObjects(), { horizonSec: 900, stepSec: 5 });
    expect(t.predictedConflicts.length).toBeGreaterThanOrEqual(1);
    const c = t.predictedConflicts[0];
    expect(c.timeToConflictSec).toBeGreaterThan(180);
    expect(c.timeToConflictSec).toBeLessThan(600);
    expect(c.minSeparationM).toBeLessThan(150);
    expect(c.location.lat).toBeGreaterThan(36.2);
    expect(c.location.lat).toBeLessThan(36.6);
  });

  it('reset clears the scenario', () => {
    let now = 1_000_000;
    const demo = new DemoScenarioService(() => now);
    demo.start();
    demo.reset();
    expect(demo.isActive()).toBe(false);
    expect(demo.getObjects()).toEqual([]);
  });

  it('objects advance as wall-clock time passes', () => {
    let now = 1_000_000;
    const demo = new DemoScenarioService(() => now);
    demo.start();
    const before = demo.getObjects()[0];
    now += 30_000; // 30 seconds later
    const after = demo.getObjects()[0];
    expect(after.lat !== before.lat || after.lon !== before.lon).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest demo-scenario.service.spec`
Expected: FAIL — cannot find module `./demo-scenario.service`.

- [ ] **Step 3: Implement DemoScenarioService**

Create `backend/src/modules/foresight/demo-scenario.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { advance } from './geo';
import type { ForesightObject, ResolutionManeuver } from './foresight.types';

/**
 * Holds a scripted two-drone conflict near Rhodes (LGRP ~36.40, 28.08) entirely in
 * memory. Two drones converge on a meeting point so their straight-line propagation
 * yields a predicted loss of separation at ~T+6min, ~<150m. No DB, no sim sessions.
 *
 * The clock is injected so tests are deterministic; production passes Date.now.
 */
@Injectable()
export class DemoScenarioService {
  private startedAtMs: number | null = null;
  // Per-object resolution overrides applied to the live scenario (stretch).
  private overrides = new Map<string, ResolutionManeuver>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  start(): void {
    this.startedAtMs = this.clock();
    this.overrides.clear();
  }

  reset(): void {
    this.startedAtMs = null;
    this.overrides.clear();
  }

  isActive(): boolean {
    return this.startedAtMs !== null;
  }

  /** Stretch: diverge a demo drone for real (so it moves on the map, not just preview). */
  applyResolution(maneuver: ResolutionManeuver): void {
    this.overrides.set(maneuver.objectId, maneuver);
  }

  /** The two drones, advanced to "now" (elapsed since start). */
  getObjects(): ForesightObject[] {
    if (this.startedAtMs === null) return [];
    const elapsedSec = Math.max(0, (this.clock() - this.startedAtMs) / 1000);
    return this.seed().map((o) => {
      const ov = this.overrides.get(o.id);
      let base = o;
      if (ov?.kind === 'altitude' && ov.altitudeDeltaM != null) {
        base = { ...base, altitudeM: base.altitudeM + ov.altitudeDeltaM };
      }
      return advance(base, elapsedSec);
    });
  }

  /** Initial state of the two demo drones at T+0. */
  private seed(): ForesightObject[] {
    return [
      {
        id: 'demo:DRN-FORESIGHT-1',
        kind: 'demo',
        label: 'DRN-FORESIGHT-1',
        lat: 36.3637,
        lon: 28.0349,
        altitudeM: 120,
        headingDeg: 45, // NE toward the meeting point
        speedMps: 15,
        verticalSpeedMps: 0,
      },
      {
        id: 'demo:DRN-FORESIGHT-2',
        kind: 'demo',
        label: 'DRN-FORESIGHT-2',
        lat: 36.3637,
        lon: 28.1251,
        altitudeM: 80,
        headingDeg: 315, // NW toward the meeting point
        speedMps: 15,
        verticalSpeedMps: 0.105, // climbs to ~120m by the crossing (within 30m vertical)
      },
    ];
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest demo-scenario.service.spec`
Expected: PASS (4 tests). If the conflict assertion fails (coordinates slightly off), nudge `speedMps` or start lon of drone 2 by ±0.005 until the conflict lands in 180–600 s with sep < 150 m — the test is the guard.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/foresight/demo-scenario.service.ts backend/src/modules/foresight/demo-scenario.service.spec.ts
git commit -m "feat(foresight): in-memory scripted demo conflict scenario"
```

---

## Task 4: AirTrafficDirectorService (Claude + deterministic fallback)

**Files:**
- Create: `backend/src/modules/foresight/air-traffic-director.service.ts`
- Test: `backend/src/modules/foresight/air-traffic-director.service.spec.ts`

**Interfaces:**
- Consumes: `ClaudeService` (`hasKey(): boolean`, `messageJson<T>(opts): Promise<T | null>`, `ClaudeService.SONNET`); `PredictedConflict`, `DirectorAdvice`, `DirectorOption` types.
- Produces: `AirTrafficDirectorService.advise(conflict: PredictedConflict): Promise<DirectorAdvice>`.

- [ ] **Step 1: Write the failing director test**

Create `backend/src/modules/foresight/air-traffic-director.service.spec.ts`:

```ts
import { AirTrafficDirectorService } from './air-traffic-director.service';
import { ClaudeService } from '../ai/claude.service';
import type { PredictedConflict } from './foresight.types';

const conflict: PredictedConflict = {
  id: 'pc-1',
  timeToConflictSec: 380,
  minSeparationM: 140,
  location: { lat: 36.4, lon: 28.08 },
  altitudeM: 120,
  primary: { id: 'demo:DRN-FORESIGHT-1', label: 'DRN-FORESIGHT-1' },
  secondary: { id: 'demo:DRN-FORESIGHT-2', label: 'DRN-FORESIGHT-2' },
};

describe('AirTrafficDirectorService', () => {
  it('returns deterministic options when no API key is configured', async () => {
    const claude = { hasKey: () => false, messageJson: jest.fn() } as unknown as ClaudeService;
    const svc = new AirTrafficDirectorService(claude);
    const advice = await svc.advise(conflict);
    expect(advice.source).toBe('deterministic');
    expect(advice.options.length).toBe(3);
    expect(advice.recommendedIndex).toBeGreaterThanOrEqual(0);
    expect(advice.recommendedIndex).toBeLessThan(advice.options.length);
    expect(claude.messageJson).not.toHaveBeenCalled();
  });

  it('falls back to deterministic options when the AI call returns null', async () => {
    const claude = { hasKey: () => true, messageJson: jest.fn().mockResolvedValue(null) } as unknown as ClaudeService;
    const svc = new AirTrafficDirectorService(claude);
    const advice = await svc.advise(conflict);
    expect(advice.source).toBe('deterministic');
    expect(advice.options.length).toBe(3);
  });

  it('uses the AI advice when the AI call succeeds', async () => {
    const aiAdvice = {
      summary: 'Predicted loss of separation in 6:20.',
      cause: 'DRN-FORESIGHT-2 climbing into the corridor.',
      options: [
        { kind: 'altitude', label: 'Descend DRN-FORESIGHT-1 by 60m', altitudeDeltaM: -60, objectId: 'demo:DRN-FORESIGHT-1', rationale: 'Minimal delay.', sideEffects: 'None.' },
      ],
      recommendedIndex: 0,
    };
    const claude = { hasKey: () => true, messageJson: jest.fn().mockResolvedValue(aiAdvice) } as unknown as ClaudeService;
    const svc = new AirTrafficDirectorService(claude);
    const advice = await svc.advise(conflict);
    expect(advice.source).toBe('ai');
    expect(advice.summary).toContain('6:20');
    expect(advice.options[0].altitudeDeltaM).toBe(-60);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest air-traffic-director.service.spec`
Expected: FAIL — cannot find module `./air-traffic-director.service`.

- [ ] **Step 3: Implement AirTrafficDirectorService**

Create `backend/src/modules/foresight/air-traffic-director.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import type { DirectorAdvice, DirectorOption, PredictedConflict } from './foresight.types';

const ADVICE_SCHEMA = {
  type: 'object',
  required: ['summary', 'cause', 'options', 'recommendedIndex'],
  properties: {
    summary: { type: 'string' },
    cause: { type: 'string' },
    recommendedIndex: { type: 'integer' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'label', 'objectId', 'rationale', 'sideEffects'],
        properties: {
          kind: { type: 'string', enum: ['hold', 'altitude', 'lateral'] },
          label: { type: 'string' },
          objectId: { type: 'string' },
          delaySec: { type: 'number' },
          altitudeDeltaM: { type: 'number' },
          lateralOffsetM: { type: 'number' },
          rationale: { type: 'string' },
          sideEffects: { type: 'string' },
        },
      },
    },
  },
};

@Injectable()
export class AirTrafficDirectorService {
  constructor(private readonly claude: ClaudeService) {}

  async advise(conflict: PredictedConflict): Promise<DirectorAdvice> {
    if (this.claude.hasKey()) {
      const ai = await this.claude.messageJson<Omit<DirectorAdvice, 'source'>>({
        system:
          'You are the Air Traffic Director for a drone UTM system. Given a predicted ' +
          'conflict, propose exactly 3 ranked, concrete resolution options (hold / altitude / ' +
          'lateral), each grounded in the geometry, with a short rationale citing the numbers ' +
          'and a one-line side effect. Recommend the option with least operational impact.',
        user: this.prompt(conflict),
        schema: ADVICE_SCHEMA,
        model: ClaudeService.SONNET,
        maxTokens: 1200,
      });
      if (ai && Array.isArray(ai.options) && ai.options.length > 0) {
        return { ...ai, source: 'ai' };
      }
    }
    return this.deterministic(conflict);
  }

  private prompt(c: PredictedConflict): string {
    const mins = Math.floor(c.timeToConflictSec / 60);
    const secs = c.timeToConflictSec % 60;
    return [
      `Predicted conflict between ${c.primary.label} and ${c.secondary.label}.`,
      `Time to conflict: ${mins}:${String(secs).padStart(2, '0')} (${c.timeToConflictSec}s).`,
      `Minimum predicted separation: ${c.minSeparationM} m.`,
      `Location: lat ${c.location.lat.toFixed(4)}, lon ${c.location.lon.toFixed(4)}, ~${c.altitudeM} m altitude (near Rhodes / LGRP).`,
      `objectId for ${c.primary.label} is "${c.primary.id}", for ${c.secondary.label} is "${c.secondary.id}".`,
      'Propose 3 options; set objectId to the drone the maneuver applies to.',
    ].join('\n');
  }

  /** Computed options used when the AI is unavailable — the demo never breaks. */
  private deterministic(c: PredictedConflict): DirectorAdvice {
    const options: DirectorOption[] = [
      {
        kind: 'hold',
        label: `Hold ${c.secondary.label} for 90s`,
        delaySec: 90,
        objectId: c.secondary.id,
        rationale: `Delaying ${c.secondary.label} 90s lets ${c.primary.label} clear the crossing point first.`,
        sideEffects: '90s added to the held flight.',
      },
      {
        kind: 'altitude',
        label: `Descend ${c.primary.label} by 60m`,
        altitudeDeltaM: -60,
        objectId: c.primary.id,
        rationale: `A 60m descent restores >30m vertical separation at the crossing (predicted ${c.minSeparationM}m horizontal).`,
        sideEffects: 'Minimal delay; stays clear of CTR RODOS.',
      },
      {
        kind: 'lateral',
        label: `Offset ${c.secondary.label} 1km west`,
        lateralOffsetM: 1000,
        objectId: c.secondary.id,
        rationale: `A 1km lateral offset opens horizontal separation well beyond 150m.`,
        sideEffects: 'Slightly longer route.',
      },
    ];
    return {
      summary: `Predicted loss of separation (${c.minSeparationM}m) between ${c.primary.label} and ${c.secondary.label} in ${c.timeToConflictSec}s.`,
      cause: `${c.secondary.label} converging with ${c.primary.label} near the crossing point.`,
      options,
      recommendedIndex: 1,
      source: 'deterministic',
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest air-traffic-director.service.spec`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/foresight/air-traffic-director.service.ts backend/src/modules/foresight/air-traffic-director.service.spec.ts
git commit -m "feat(foresight): Air Traffic Director (Claude + deterministic fallback)"
```

---

## Task 5: Controller + module wiring + live verification

**Files:**
- Create: `backend/src/modules/foresight/foresight.controller.ts`
- Create: `backend/src/modules/foresight/foresight.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PredictionService.predict()`, `DemoScenarioService.start/reset`, `AirTrafficDirectorService.advise()`.
- Produces HTTP API:
  - `GET /api/v1/foresight/predict?horizon=600&step=5` → `ForesightTimeline`
  - `POST /api/v1/foresight/advise` body `{ conflict: PredictedConflict }` → `DirectorAdvice`
  - `POST /api/v1/foresight/simulate-resolution` body `{ maneuvers: ResolutionManeuver[], horizon?, step? }` → `ForesightTimeline`
  - `POST /api/v1/foresight/demo/start` → `{ active: true }`
  - `POST /api/v1/foresight/demo/reset` → `{ active: false }`

- [ ] **Step 1: Write the controller**

Create `backend/src/modules/foresight/foresight.controller.ts`:

```ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { DemoScenarioService } from './demo-scenario.service';
import { AirTrafficDirectorService } from './air-traffic-director.service';
import type { PredictedConflict, ResolutionManeuver } from './foresight.types';

@ApiTags('Foresight')
@ApiBearerAuth()
@Controller('foresight')
export class ForesightController {
  constructor(
    private readonly prediction: PredictionService,
    private readonly demo: DemoScenarioService,
    private readonly director: AirTrafficDirectorService,
  ) {}

  @Get('predict')
  @ApiOperation({ summary: 'Predict the airspace N seconds ahead and surface CPA conflicts' })
  async predict(@Query('horizon') horizon?: string, @Query('step') step?: string) {
    return this.prediction.predict({
      horizonSec: horizon ? Number(horizon) : undefined,
      stepSec: step ? Number(step) : undefined,
    });
  }

  @Post('advise')
  @ApiOperation({ summary: 'Air Traffic Director: ranked resolution options for a predicted conflict' })
  async advise(@Body() body: { conflict: PredictedConflict }) {
    return this.director.advise(body.conflict);
  }

  @Post('simulate-resolution')
  @ApiOperation({ summary: 'Re-predict with maneuvers applied (preview only — executes nothing)' })
  async simulateResolution(
    @Body() body: { maneuvers: ResolutionManeuver[]; horizon?: number; step?: number },
  ) {
    return this.prediction.predict(
      { horizonSec: body.horizon, stepSec: body.step },
      body.maneuvers ?? [],
    );
  }

  @Post('demo/start')
  @ApiOperation({ summary: 'Activate the scripted demo conflict scenario' })
  startDemo() {
    this.demo.start();
    return { active: true };
  }

  @Post('demo/reset')
  @ApiOperation({ summary: 'Clear the scripted demo scenario' })
  resetDemo() {
    this.demo.reset();
    return { active: false };
  }
}
```

- [ ] **Step 2: Write the module**

Create `backend/src/modules/foresight/foresight.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ForesightController } from './foresight.controller';
import { PredictionService } from './prediction.service';
import { DemoScenarioService } from './demo-scenario.service';
import { AirTrafficDirectorService } from './air-traffic-director.service';
import { AiModule } from '../ai/ai.module';
import { FlightsModule } from '../flights/flights.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AdsbModule } from '../adsb/adsb.module';

@Module({
  imports: [AiModule, FlightsModule, TelemetryModule, AdsbModule],
  providers: [
    PredictionService,
    AirTrafficDirectorService,
    { provide: DemoScenarioService, useFactory: () => new DemoScenarioService(() => Date.now()) },
  ],
  controllers: [ForesightController],
})
export class ForesightModule {}
```

Note: confirm `TelemetryModule` exports `TelemetryService` and `AdsbModule` exports `AdsbService` and `FlightsModule` exports `FlightsService` (the Copilot module already imports FlightsModule/AdsbModule/Telemetry-adjacent providers — follow that). If any does not export its service, add it to that module's `exports` array (same one-line change as `briefing.module.ts` exporting `BriefingService`).

- [ ] **Step 3: Register the module**

Modify `backend/src/app.module.ts`: add the import near the other module imports and add `ForesightModule` to the `imports` array (right after `CopilotModule`).

```ts
import { ForesightModule } from './modules/foresight/foresight.module';
```
```ts
    CopilotModule,
    ForesightModule,
```

- [ ] **Step 4: Typecheck and run all foresight tests**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx tsc --noEmit -p tsconfig.json && npx jest foresight`
Expected: tsc clean; all foresight specs PASS.

- [ ] **Step 5: Boot the backend and verify live**

Run (in `backend/`): `npm run build && node dist/main` (fast boot, no source maps — see startup notes). Then in another shell:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"operator@drops-utm.com","password":"password123"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).accessToken))')
curl -s -X POST http://localhost:3001/api/v1/foresight/demo/start -H "authorization: Bearer $TOKEN" ; echo
curl -s "http://localhost:3001/api/v1/foresight/predict?horizon=600&step=5" -H "authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log("objects",j.objects.length,"conflicts",j.predictedConflicts.length);console.log(JSON.stringify(j.predictedConflicts[0],null,1))})'
```
Expected: a predicted conflict between the two `DRN-FORESIGHT-*` drones with `timeToConflictSec` ~300–450 and `minSeparationM` < 150.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/foresight/foresight.controller.ts backend/src/modules/foresight/foresight.module.ts backend/src/app.module.ts
git commit -m "feat(foresight): controller + module wiring + endpoints"
```

---

## Task 6: Frontend API client + types

**Files:**
- Modify: `frontend/src/lib/api.ts` (append, following the `copilotApi` pattern near the end)

**Interfaces:**
- Produces: `foresightApi.predict()`, `foresightApi.simulateResolution(maneuvers)`, `foresightApi.advise(conflict)`, `foresightApi.startDemo()`, `foresightApi.resetDemo()`; exported types `ForesightObject`, `ForesightFrame`, `PredictedConflict`, `ResolutionManeuver`, `ForesightTimeline`, `DirectorOption`, `DirectorAdvice`.

- [ ] **Step 1: Append the client + types**

Add to the end of `frontend/src/lib/api.ts`:

```ts
// ── Foresight Mode (predictive look-ahead) ──
export interface ForesightObject {
  id: string;
  kind: 'drone' | 'manned' | 'demo';
  label: string;
  lat: number;
  lon: number;
  altitudeM: number;
  headingDeg: number;
  speedMps: number;
  verticalSpeedMps: number;
}
export interface ForesightFrame {
  tOffsetSec: number;
  objects: Array<{ id: string; lat: number; lon: number; altitudeM: number }>;
}
export interface PredictedConflict {
  id: string;
  timeToConflictSec: number;
  minSeparationM: number;
  location: { lat: number; lon: number };
  altitudeM: number;
  primary: { id: string; label: string };
  secondary: { id: string; label: string };
}
export interface ResolutionManeuver {
  objectId: string;
  kind: 'hold' | 'altitude' | 'lateral';
  delaySec?: number;
  altitudeDeltaM?: number;
  lateralOffsetM?: number;
}
export interface ForesightTimeline {
  generatedAt: string;
  horizonSec: number;
  stepSec: number;
  objects: ForesightObject[];
  frames: ForesightFrame[];
  predictedConflicts: PredictedConflict[];
}
export interface DirectorOption {
  kind: 'hold' | 'altitude' | 'lateral';
  label: string;
  delaySec?: number;
  altitudeDeltaM?: number;
  lateralOffsetM?: number;
  objectId: string;
  rationale: string;
  sideEffects: string;
}
export interface DirectorAdvice {
  summary: string;
  cause: string;
  options: DirectorOption[];
  recommendedIndex: number;
  source: 'ai' | 'deterministic';
}

export const foresightApi = {
  predict: (horizon = 600, step = 5) =>
    api.get<ForesightTimeline>('/foresight/predict', { params: { horizon, step } }),
  simulateResolution: (maneuvers: ResolutionManeuver[], horizon = 600, step = 5) =>
    api.post<ForesightTimeline>('/foresight/simulate-resolution', { maneuvers, horizon, step }),
  advise: (conflict: PredictedConflict) =>
    api.post<DirectorAdvice>('/foresight/advise', { conflict }),
  startDemo: () => api.post<{ active: boolean }>('/foresight/demo/start'),
  resetDemo: () => api.post<{ active: boolean }>('/foresight/demo/reset'),
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(foresight): frontend API client + types"
```

---

## Task 7: Forward children into the Leaflet MapContainer (enabler)

**Files:**
- Modify: `frontend/src/components/shared/map-inner.tsx`
- Modify: `frontend/src/components/shared/map-view.tsx`

**Interfaces:**
- Produces: `MapView` and its inner component accept an optional `children?: React.ReactNode` rendered **inside** `<MapContainer>`, so callers can mount react-leaflet child layers (the Foresight overlay).

- [ ] **Step 1: Read both files to find the prop interfaces and the `<MapContainer>` JSX**

Run: open `frontend/src/components/shared/map-inner.tsx` and `map-view.tsx`. Identify the props interface of each component and the `<MapContainer ...>...</MapContainer>` element in `map-inner.tsx`.

- [ ] **Step 2: Add `children` to `map-inner.tsx`**

In the inner component's props type, add:
```ts
  children?: React.ReactNode;
```
Destructure `children` from props, and render it as the last child inside `<MapContainer>`:
```tsx
      {/* existing layers ... */}
      {children}
    </MapContainer>
```

- [ ] **Step 3: Forward `children` through `map-view.tsx`**

In `MapView`'s props type add `children?: React.ReactNode;`, destructure it, and pass it down to the dynamically-imported inner map component:
```tsx
      <MapInner /* ...existing props... */>{children}</MapInner>
```
(If `MapInner` is rendered via `next/dynamic`, ensure the JSX passes `children` as normal React children.)

- [ ] **Step 4: Typecheck**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Expected: clean (existing callers that pass no children are unaffected — the prop is optional).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/shared/map-inner.tsx frontend/src/components/shared/map-view.tsx
git commit -m "feat(map): forward children into MapContainer for overlay layers"
```

---

## Task 8: ForesightLayer overlay (ghost trails, conflict pulse, camera)

**Files:**
- Create: `frontend/src/components/foresight/foresight-layer.tsx`
- Modify: `frontend/src/app/globals.css` (add a `.foresight-pulse` keyframe class)

**Interfaces:**
- Consumes: `ForesightTimeline`, `PredictedConflict` types; react-leaflet `Polyline`, `CircleMarker`, `useMap`.
- Produces: `<ForesightLayer timeline={...} playheadSec={...} focusConflict={...} />` — a react-leaflet child rendering one ghost trail per object up to `playheadSec`, a marker at each object's playhead position, and a pulsing marker at the conflict; flies the camera to `focusConflict` when it changes.

- [ ] **Step 1: Add the pulse CSS**

Append to `frontend/src/app/globals.css`:

```css
@keyframes foresight-pulse {
  0% { transform: scale(0.6); opacity: 0.9; }
  70% { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(0.6); opacity: 0; }
}
.foresight-pulse path { animation: foresight-pulse 1.6s ease-out infinite; transform-origin: center; transform-box: fill-box; }
```

- [ ] **Step 2: Implement the overlay**

Create `frontend/src/components/foresight/foresight-layer.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { ForesightTimeline, PredictedConflict } from '@/lib/api';

interface Props {
  timeline: ForesightTimeline;
  playheadSec: number;
  focusConflict: PredictedConflict | null;
}

// Color per object kind.
const colorFor = (id: string, kind?: string) =>
  kind === 'manned' ? '#f59e0b' : id.startsWith('demo:') ? '#22d3ee' : '#22d3ee';

export function ForesightLayer({ timeline, playheadSec, focusConflict }: Props) {
  const map = useMap();

  // Cinematic camera fly-to when a conflict becomes the focus.
  useEffect(() => {
    if (focusConflict) {
      map.flyTo([focusConflict.location.lat, focusConflict.location.lon], 11, { duration: 1.5 });
    }
  }, [focusConflict, map]);

  const framesUpTo = timeline.frames.filter((f) => f.tOffsetSec <= playheadSec);
  const kindById = new Map(timeline.objects.map((o) => [o.id, o.kind]));

  // One ghost trail per object: its positions across frames up to the playhead.
  const trails = timeline.objects.map((o) => {
    const positions = framesUpTo
      .map((f) => f.objects.find((x) => x.id === o.id))
      .filter(Boolean)
      .map((p) => [p!.lat, p!.lon] as [number, number]);
    return { id: o.id, kind: o.kind, label: o.label, positions };
  });

  const headFrame = framesUpTo[framesUpTo.length - 1];

  return (
    <>
      {trails.map((t) => (
        <Polyline
          key={`trail-${t.id}`}
          positions={t.positions}
          pathOptions={{ color: colorFor(t.id, t.kind), weight: 2, opacity: 0.5, dashArray: '4 6' }}
        />
      ))}

      {headFrame?.objects.map((p) => (
        <CircleMarker
          key={`head-${p.id}`}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{ color: colorFor(p.id, kindById.get(p.id)), fillColor: colorFor(p.id, kindById.get(p.id)), fillOpacity: 0.9, weight: 1 }}
        />
      ))}

      {timeline.predictedConflicts.map((c) => (
        <CircleMarker
          key={`conflict-${c.id}`}
          center={[c.location.lat, c.location.lon]}
          radius={10}
          className="foresight-pulse"
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.5, weight: 2 }}
        >
          <Tooltip permanent direction="top">
            {`CONFLICT IN ${Math.floor(c.timeToConflictSec / 60)}:${String(c.timeToConflictSec % 60).padStart(2, '0')} · ${c.minSeparationM}m`}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/foresight/foresight-layer.tsx frontend/src/app/globals.css
git commit -m "feat(foresight): map overlay — ghost trails, conflict pulse, camera fly-to"
```

---

## Task 9: Foresight controls + dashboard mount (read-only first)

**Files:**
- Create: `frontend/src/components/foresight/foresight-controls.tsx`
- Modify: the dashboard page that renders the map (`frontend/src/app/dashboard/page.tsx` — confirm by locating where `<MapView>` is used).

**Interfaces:**
- Consumes: `foresightApi`, `ForesightTimeline`, `PredictedConflict`, `DirectorAdvice`, `ResolutionManeuver`; `ForesightLayer` (Task 8); `AirTrafficDirectorPanel` (Task 10 — imported but rendered conditionally; create a stub export first if building strictly in order, then fill in Task 10).
- Produces: `<ForesightControls />` — owns foresight state (engaged, timeline, playheadSec, focusConflict, advice), polls `predict` while engaged, renders the toggle + slider + "Run Demo" button, and yields the `<ForesightLayer>` to mount inside the map via a render prop or shared state.

Because the overlay must live **inside** `<MapView>` (as children) while the controls live **outside** (as HUD buttons), use a small shared store so both can read the same state without prop-drilling through `MapView`.

- [ ] **Step 1: Create a tiny zustand store for foresight state**

Create `frontend/src/store/foresight.store.ts`:

```ts
import { create } from 'zustand';
import type { ForesightTimeline, PredictedConflict, DirectorAdvice } from '@/lib/api';

interface ForesightState {
  engaged: boolean;
  timeline: ForesightTimeline | null;
  playheadSec: number;
  focusConflict: PredictedConflict | null;
  advice: DirectorAdvice | null;
  resolved: boolean;
  set: (patch: Partial<ForesightState>) => void;
  reset: () => void;
}

export const useForesightStore = create<ForesightState>((set) => ({
  engaged: false,
  timeline: null,
  playheadSec: 0,
  focusConflict: null,
  advice: null,
  resolved: false,
  set: (patch) => set(patch),
  reset: () => set({ engaged: false, timeline: null, playheadSec: 0, focusConflict: null, advice: null, resolved: false }),
}));
```

- [ ] **Step 2: Implement the controls (HUD)**

Create `frontend/src/components/foresight/foresight-controls.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { Eye, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { foresightApi } from '@/lib/api';
import { useForesightStore } from '@/store/foresight.store';

export function ForesightControls() {
  const { engaged, timeline, playheadSec, focusConflict, set, reset } = useForesightStore();

  // Poll predictions while engaged (every 3s, matching ADS-B cadence).
  useEffect(() => {
    if (!engaged) return;
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await foresightApi.predict(600, 5);
        if (!alive) return;
        const conflict = data.predictedConflicts[0] ?? null;
        set({ timeline: data, focusConflict: conflict });
      } catch {
        /* best-effort */
      }
    };
    tick();
    const h = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(h); };
  }, [engaged, set]);

  const runDemo = async () => {
    await foresightApi.startDemo();
    set({ engaged: true, resolved: false, playheadSec: 480 });
  };

  const stop = async () => {
    await foresightApi.resetDemo();
    reset();
  };

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-border bg-card/90 p-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={engaged ? 'default' : 'outline'}
          className="gap-1.5"
          onClick={() => set({ engaged: !engaged })}
        >
          <Eye className="h-3.5 w-3.5" /> FORESIGHT
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={runDemo}>
          <Play className="h-3.5 w-3.5" /> Run Demo
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={stop}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>

      {engaged && timeline && (
        <div className="flex items-center gap-2 px-1">
          <span className="font-mono text-xs text-muted-foreground">+{Math.floor(playheadSec / 60)}:{String(playheadSec % 60).padStart(2, '0')}</span>
          <input
            type="range"
            min={0}
            max={timeline.horizonSec}
            step={timeline.stepSec}
            value={playheadSec}
            onChange={(e) => set({ playheadSec: Number(e.target.value) })}
            className={cn('h-1 flex-1 cursor-pointer appearance-none rounded bg-border accent-primary')}
          />
          <span className="font-mono text-xs text-primary">{timeline.predictedConflicts.length} conflict{timeline.predictedConflicts.length === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount the controls + overlay on the dashboard**

Locate where `<MapView ...>` is rendered (likely `frontend/src/app/dashboard/page.tsx`). Render `<ForesightControls />` as a HUD element absolutely positioned over the map container, and pass `<ForesightLayer>` (driven by the store) as children of `<MapView>`:

```tsx
import { ForesightControls } from '@/components/foresight/foresight-controls';
import { ForesightLayer } from '@/components/foresight/foresight-layer';
import { useForesightStore } from '@/store/foresight.store';
```

Inside the map container wrapper (which must be `position: relative`):
```tsx
  const { engaged, timeline, playheadSec, focusConflict } = useForesightStore();
  /* ... */
  <div className="relative ...">
    <MapView /* existing props */>
      {engaged && timeline && (
        <ForesightLayer timeline={timeline} playheadSec={playheadSec} focusConflict={focusConflict} />
      )}
    </MapView>
    <div className="absolute left-3 top-3 z-[1000]">
      <ForesightControls />
    </div>
  </div>
```
(Use `z-[1000]` so the HUD sits above Leaflet panes. If the dashboard page is a server component, ensure it is `'use client'` — confirm; the existing dashboard pages are client components.)

- [ ] **Step 4: Typecheck + visual verify**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Then with both servers running, log in, open the dashboard, click **Run Demo**, and confirm: ghost trails appear, two cyan demo drones converge near Rhodes, a pulsing red conflict marker with a countdown shows, and the slider scrubs the playhead.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/foresight.store.ts frontend/src/components/foresight/foresight-controls.tsx frontend/src/app/dashboard/page.tsx
git commit -m "feat(foresight): controls HUD + dashboard mount + live overlay"
```

---

## Task 10: Air Traffic Director panel + resolution confirm

**Files:**
- Create: `frontend/src/components/foresight/air-traffic-director-panel.tsx`
- Modify: `frontend/src/components/foresight/foresight-controls.tsx` (request advice when a conflict appears; render the panel)

**Interfaces:**
- Consumes: `foresightApi.advise`, `foresightApi.simulateResolution`; `DirectorAdvice`, `DirectorOption`, `PredictedConflict`, `ResolutionManeuver`; the foresight store.
- Produces: `<AirTrafficDirectorPanel onResolved={() => void} />` — shows the advice summary/cause, ranked option cards (recommended highlighted), and a Confirm per option that calls `simulateResolution` and, on success (no conflicts in the re-prediction), marks resolved.

- [ ] **Step 1: Implement the panel**

Create `frontend/src/components/foresight/air-traffic-director-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { foresightApi, type DirectorAdvice, type DirectorOption, type ResolutionManeuver } from '@/lib/api';
import { useForesightStore } from '@/store/foresight.store';

export function AirTrafficDirectorPanel({ advice }: { advice: DirectorAdvice }) {
  const { set } = useForesightStore();
  const [applying, setApplying] = useState<number | null>(null);

  const confirm = async (opt: DirectorOption, idx: number) => {
    setApplying(idx);
    try {
      const maneuver: ResolutionManeuver = {
        objectId: opt.objectId,
        kind: opt.kind,
        delaySec: opt.delaySec,
        altitudeDeltaM: opt.altitudeDeltaM,
        lateralOffsetM: opt.lateralOffsetM,
      };
      const { data } = await foresightApi.simulateResolution([maneuver], 600, 5);
      const cleared = data.predictedConflicts.length === 0;
      set({ timeline: data, focusConflict: data.predictedConflicts[0] ?? null, resolved: cleared });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border bg-card/95 p-3 text-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-bold uppercase tracking-wide">Air Traffic Director</span>
        <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-mono', advice.source === 'ai' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
          {advice.source === 'ai' ? 'AI' : 'COMPUTED'}
        </span>
      </div>
      <p className="mt-1">{advice.summary}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{advice.cause}</p>

      <div className="mt-2 space-y-1.5">
        {advice.options.map((opt, idx) => (
          <div key={idx} className={cn('rounded border px-2.5 py-2', idx === advice.recommendedIndex ? 'border-primary/50 bg-primary/5' : 'border-border')}>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{opt.label}</span>
              {idx === advice.recommendedIndex && <span className="rounded bg-primary/15 px-1 text-[10px] font-mono text-primary">RECOMMENDED</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{opt.rationale}</p>
            <Button size="sm" className="mt-1.5 h-7 gap-1 text-xs" disabled={applying !== null} onClick={() => confirm(opt, idx)}>
              {applying === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Confirm
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Request advice + render the panel from the controls**

In `foresight-controls.tsx`, add an effect that fetches advice when a `focusConflict` first appears, store it, and render `<AirTrafficDirectorPanel>` and a RESOLVED banner. Add near the existing imports:

```tsx
import { AirTrafficDirectorPanel } from './air-traffic-director-panel';
```
Add to the component body (after the predict effect):

```tsx
  const advice = useForesightStore((s) => s.advice);
  const resolved = useForesightStore((s) => s.resolved);

  useEffect(() => {
    if (!focusConflict || advice) return;
    let alive = true;
    foresightApi.advise(focusConflict).then(({ data }) => { if (alive) set({ advice: data }); }).catch(() => {});
    return () => { alive = false; };
  }, [focusConflict, advice, set]);
```
And render below the slider block:
```tsx
      {resolved && (
        <div className="rounded bg-emerald-500/10 px-2 py-1 text-center text-xs font-semibold text-emerald-500">
          RESOLVED — separation restored
        </div>
      )}
      {!resolved && advice && <AirTrafficDirectorPanel advice={advice} />}
```

- [ ] **Step 3: Typecheck + visual verify**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Then: Run Demo → the Director panel appears with 3 options (recommended highlighted). Click the recommended Confirm → the conflict marker disappears, the panel shows **RESOLVED**.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/foresight/air-traffic-director-panel.tsx frontend/src/components/foresight/foresight-controls.tsx
git commit -m "feat(foresight): Air Traffic Director panel + resolution confirm flow"
```

---

## Task 11: Voice command (Web Speech API)

**Files:**
- Create: `frontend/src/hooks/use-voice-command.ts`
- Modify: `frontend/src/components/foresight/foresight-controls.tsx` (mic button + intent match)

**Interfaces:**
- Produces: `useVoiceCommand({ onCommand }): { listening, supported, start, stop }` — wraps `window.SpeechRecognition || window.webkitSpeechRecognition`, emits the lowercased transcript via `onCommand`.

- [ ] **Step 1: Implement the hook**

Create `frontend/src/hooks/use-voice-command.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
};

export function useVoiceCommand({ onCommand }: { onCommand: (transcript: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.lang = 'el-GR'; // Greek; recognizes English digits/words too in practice
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ').toLowerCase();
      onCommand(transcript);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, [onCommand]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.start(); setListening(true); } catch { /* already started */ }
  }, []);
  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);

  return { listening, supported, start, stop };
}
```

- [ ] **Step 2: Wire the mic + intent match into the controls**

In `foresight-controls.tsx`, add a voice button that, on a recognized transcript, matches an option index and confirms it. Intent match: digits one/two/three (EN) and ένα/δύο/τρία (GR), plus "option N" / "νούμερο N".

Add imports and logic:
```tsx
import { Mic } from 'lucide-react';
import { useVoiceCommand } from '@/hooks/use-voice-command';
```
```tsx
  const matchOptionIndex = (t: string): number | null => {
    if (/\b(1|one|ένα|ενα|first|πρώτο|πρωτο)\b/.test(t)) return 0;
    if (/\b(2|two|δύο|δυο|second|δεύτερο|δευτερο)\b/.test(t)) return 1;
    if (/\b(3|three|τρία|τρια|third|τρίτο|τριτο)\b/.test(t)) return 2;
    return null;
  };

  const onVoice = (transcript: string) => {
    const a = useForesightStore.getState().advice;
    if (!a) return;
    let idx = matchOptionIndex(transcript);
    // "do it" / "κάν' το" with no number → the recommended option.
    if (idx === null && /(do it|execute|κάν|καν|προχώρα|προχωρα)/.test(transcript)) idx = a.recommendedIndex;
    if (idx === null || !a.options[idx]) return;
    const opt = a.options[idx];
    foresightApi.simulateResolution([{ objectId: opt.objectId, kind: opt.kind, delaySec: opt.delaySec, altitudeDeltaM: opt.altitudeDeltaM, lateralOffsetM: opt.lateralOffsetM }], 600, 5)
      .then(({ data }) => set({ timeline: data, focusConflict: data.predictedConflicts[0] ?? null, resolved: data.predictedConflicts.length === 0 }));
  };

  const { listening, supported, start } = useVoiceCommand({ onCommand: onVoice });
```
Add the mic button next to the others (only when `supported`):
```tsx
        {supported && (
          <Button size="sm" variant={listening ? 'default' : 'outline'} className="gap-1.5" onClick={start}>
            <Mic className="h-3.5 w-3.5" /> {listening ? 'Listening…' : 'Voice'}
          </Button>
        )}
```

- [ ] **Step 3: Typecheck + verify**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Then (Chrome): Run Demo → click **Voice** → say "do option two" / "κάνε το δύο" → the conflict resolves. The option Confirm buttons remain as the text fallback.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/use-voice-command.ts frontend/src/components/foresight/foresight-controls.tsx
git commit -m "feat(foresight): Web Speech voice command with intent match + text fallback"
```

---

## Task 12: End-to-end verification (Playwright)

**Files:** none created — this is a manual/automated verification task driving the running app.

**Interfaces:** Consumes the full running stack (backend on :3001, frontend on :3005).

- [ ] **Step 1: Ensure both servers run**

Backend: `cd backend && node dist/main` (after `npm run build`). Frontend: `cd frontend && npm run dev`. Confirm `:3001` and `:3005` listen.

- [ ] **Step 2: Drive the narrative with Playwright**

Using the Playwright MCP browser:
1. Navigate to `http://localhost:3005/login`, log in (admin prefilled).
2. On `/dashboard`, click **Run Demo** (via JS click if the Next dev overlay intercepts).
3. Assert: ghost trails render, a red conflict marker with a `CONFLICT IN m:ss` tooltip appears near Rhodes, and the camera has centred there.
4. Assert: the Air Traffic Director panel shows 3 options with one RECOMMENDED.
5. Click the recommended **Confirm**.
6. Assert: the conflict marker disappears and a **RESOLVED** banner shows.
7. Screenshot for the record; remove the screenshot artifact afterward.

- [ ] **Step 3: Final full typecheck + backend tests**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx tsc --noEmit -p tsconfig.json && npx jest foresight`
Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit`
Expected: all clean / green.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "test(foresight): end-to-end verification of the Foresight narrative"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** prediction+CPA (Task 2), AI Director + fallback (Task 4), demo scenario (Task 3), resolution preview (Task 2 math + Task 5/10 endpoints/UI), ghost trails + conflict pulse + camera (Task 8), slider/toggle/demo (Task 9), voice + fallback (Task 11), guardrails (read-only endpoints, Task 5), unit normalization (Task 2), E2E (Task 12). All spec sections map to a task.
- **Type consistency:** `ForesightObject`, `PredictedConflict`, `ResolutionManeuver`, `ForesightTimeline`, `DirectorAdvice`/`DirectorOption` are defined once in `foresight.types.ts` (Task 1) and mirrored verbatim in `lib/api.ts` (Task 6). `predictFromObjects` / `predict` signatures are used consistently across Tasks 2/5/10. `advise(conflict)` consistent across Tasks 4/5/10.
- **Known verification points (resolve during build, not placeholders):** confirm telemetry `groundSpeed` unit is m/s against a sample row in Task 5 Step 5; confirm `TelemetryModule`/`AdsbModule`/`FlightsModule` export their services in Task 5 Step 2; nudge demo coordinates in Task 3 Step 4 if the conflict window assertion fails.
