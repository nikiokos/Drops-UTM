# Mission Feasibility Predictor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich drones with an energy/performance profile at registration and add a physics energy model + Claude-explained feasibility check that tells operators, at mission-assignment time, whether a drone can complete a mission on a single charge (GO / MARGINAL / NO_GO + margin + solutions).

**Architecture:** New backend `feasibility/` module: a pure `EnergyModelService` (battery vs. required energy, corrected for payload/hover/wind/health) plus a `FeasibilityService` that gathers drone specs + mission segments + live wind, runs the model, and asks Claude for a human explanation (deterministic fallback). A read-only `POST /feasibility/check` endpoint feeds a live verdict card in mission creation and new energy fields in drone registration.

**Tech Stack:** NestJS + TypeORM (SQLite, `synchronize: true` auto-adds nullable columns — no manual migration), Jest (backend), Next.js 15 + React 19 + Tailwind (frontend), existing `ClaudeService.messageJson`, existing `WeatherService.getGoNoGo`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-mission-feasibility-design.md`.
- Branch: create `feat/mission-feasibility` off `master` before Task 1; commit after each task.
- All energy internal units: **Wh** for energy, **W** for power, **m/s** for speed, **kg** for payload, **seconds** for time, **meters** for distance.
- Config defaults (in `feasibility.config.ts`, all tunable): `reserveFraction = 0.20`, `goThresholdPct = 15`, `kPayload = 0.5`, `kWind = 0.4`, `climbSurcharge = 0.15`, `defaultHoverPowerW = 250`, `defaultCruisePowerW = 200`, `defaultCruiseSpeedMs = 12`, `defaultBatteryHealthPct = 100`, `defaultMaxFlightTimeMin = 20`.
- Verdict thresholds: `GO` when `marginPct ≥ goThresholdPct`; `MARGINAL` when `0 ≤ marginPct < goThresholdPct`; `NO_GO` when `marginPct < 0` OR wind exceeds the drone's `windToleranceMs`.
- Verdict code values are `'GO' | 'MARGINAL' | 'NO_GO'` (underscore); UI display uses "GO / MARGINAL / NO-GO".
- `confidence` is `'HIGH'` only when the drone has all of `batteryCapacityWh`, `hoverPowerW`, `cruisePowerW`, `cruiseSpeedMs`; otherwise `'LOW'`.
- The endpoint is read-only/preview: it performs no writes and executes nothing. The only write is the mission `feasibilityOverride` recorded by the existing mission-create path when the operator overrides a NO_GO.
- Missing `ANTHROPIC_API_KEY` → deterministic templated explanation; the check still works.
- Backend tests: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest <pattern>`.
- Frontend typecheck: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit 2>&1 | grep -E '^src/'` (ignore `.next/types` noise).

---

## File Structure

**Backend (new `backend/src/modules/feasibility/`):**
- `feasibility.types.ts` — shared types (DroneSpec, MissionProfile, EnvConditions, EnergyResult, FeasibilityResult, Solution).
- `feasibility.config.ts` — tunable constants.
- `energy-model.service.ts` — `EnergyModelService`: pure physics.
- `feasibility.service.ts` — `FeasibilityService`: gather + run + explain.
- `feasibility.controller.ts` — `POST /feasibility/check`.
- `feasibility.module.ts` — wiring.
- Tests: `energy-model.service.spec.ts`, `feasibility.service.spec.ts`.
- Modify: `backend/src/modules/drones/drone.entity.ts` (energy columns), `backend/src/app.module.ts` (register module).

**Frontend:**
- `frontend/src/lib/api.ts` — add `feasibilityApi` + types (modify).
- `frontend/src/app/dashboard/drones/page.tsx` — Energy & Performance fields in the drone form (modify).
- `frontend/src/components/feasibility/feasibility-card.tsx` — the verdict card (create).
- `frontend/src/app/dashboard/missions/new/page.tsx` — mount the card + NO_GO override flow (modify).

---

## Task 1: Drone energy/performance fields

**Files:**
- Modify: `backend/src/modules/drones/drone.entity.ts`
- Test: `backend/src/modules/drones/drone-energy-fields.spec.ts`

**Interfaces:**
- Produces: new nullable `Drone` columns `batteryCapacityWh`, `hoverPowerW`, `cruisePowerW`, `cruiseSpeedMs`, `windToleranceMs` (all `real`, nullable) and `batteryHealthPct` (`real`, default 100). Consumed by later tasks via `dronesService.findById`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/drones/drone-energy-fields.spec.ts`:

```ts
import { Drone } from './drone.entity';

describe('Drone energy fields', () => {
  it('exposes the new energy/performance properties', () => {
    const d = new Drone();
    d.batteryCapacityWh = 274;
    d.hoverPowerW = 320;
    d.cruisePowerW = 240;
    d.cruiseSpeedMs = 15;
    d.batteryHealthPct = 92;
    d.windToleranceMs = 12;
    expect(d.batteryCapacityWh).toBe(274);
    expect(d.hoverPowerW).toBe(320);
    expect(d.cruisePowerW).toBe(240);
    expect(d.cruiseSpeedMs).toBe(15);
    expect(d.batteryHealthPct).toBe(92);
    expect(d.windToleranceMs).toBe(12);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest drone-energy-fields`
Expected: FAIL — TS compile errors, properties do not exist on `Drone`.

- [ ] **Step 3: Add the columns**

In `backend/src/modules/drones/drone.entity.ts`, immediately after the existing `maxPayload` column (around line 67), add:

```ts
  // ── Energy & performance profile (for mission feasibility) ──
  @Column({ name: 'battery_capacity_wh', type: 'real', nullable: true })
  batteryCapacityWh: number;

  @Column({ name: 'hover_power_w', type: 'real', nullable: true })
  hoverPowerW: number;

  @Column({ name: 'cruise_power_w', type: 'real', nullable: true })
  cruisePowerW: number;

  @Column({ name: 'cruise_speed_ms', type: 'real', nullable: true })
  cruiseSpeedMs: number;

  @Column({ name: 'battery_health_pct', type: 'real', default: 100 })
  batteryHealthPct: number;

  @Column({ name: 'wind_tolerance_ms', type: 'real', nullable: true })
  windToleranceMs: number;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest drone-energy-fields`
Expected: PASS (1 test). Note: `DronesService.create` already takes `Partial<Drone>` and the controller accepts a loose body, so these fields persist automatically when sent — no service change needed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/drones/drone.entity.ts backend/src/modules/drones/drone-energy-fields.spec.ts
git commit -m "feat(drones): add energy/performance profile fields"
```

---

## Task 2: EnergyModelService (pure physics) + config + types

**Files:**
- Create: `backend/src/modules/feasibility/feasibility.types.ts`
- Create: `backend/src/modules/feasibility/feasibility.config.ts`
- Create: `backend/src/modules/feasibility/energy-model.service.ts`
- Test: `backend/src/modules/feasibility/energy-model.service.spec.ts`

**Interfaces:**
- Produces types: `DroneSpec`, `MissionProfile`, `EnvConditions`, `Solution`, `EnergyResult`, `FeasibilityResult`.
- Produces `EnergyModelService.evaluate(spec: DroneSpec, mission: MissionProfile, env: EnvConditions): EnergyResult` (pure, no I/O).

- [ ] **Step 1: Write the types**

Create `backend/src/modules/feasibility/feasibility.types.ts`:

```ts
/** A drone's energy/performance inputs (subset of the Drone entity + fallbacks). */
export interface DroneSpec {
  batteryCapacityWh?: number | null;
  hoverPowerW?: number | null;
  cruisePowerW?: number | null;
  cruiseSpeedMs?: number | null;
  batteryHealthPct?: number | null;
  windToleranceMs?: number | null;
  maxPayloadKg?: number | null;
  maxFlightTimeMin?: number | null;
}

/** The mission reduced to energy-relevant segments. */
export interface MissionProfile {
  distanceM: number;
  hoverTimeS: number;
  payloadKg: number;
}

export interface EnvConditions {
  windSpeedMs: number | null;
}

export type Verdict = 'GO' | 'MARGINAL' | 'NO_GO';

export interface Solution {
  kind: 'reduce_payload' | 'charging_stop' | 'other_drone' | 'await_wind';
  label: string;
  detail: string;
}

export interface EnergyResult {
  verdict: Verdict;
  marginPct: number;
  usableWh: number;
  requiredWh: number;
  breakdown: {
    cruiseWh: number;
    hoverWh: number;
    climbWh: number;
    payloadFactor: number;
    windFactor: number;
  };
  confidence: 'HIGH' | 'LOW';
  windExceeded: boolean;
  solutions: Solution[];
}

/** The full API result: the energy result plus the narrated explanation. */
export interface FeasibilityResult extends EnergyResult {
  windUsed: { speedMs: number; source: string } | null;
  explanation: string;
  explanationSource: 'ai' | 'deterministic';
}
```

- [ ] **Step 2: Write the config**

Create `backend/src/modules/feasibility/feasibility.config.ts`:

```ts
/** Tunable feasibility constants. Adjust here to retune the energy model. */
export const FEASIBILITY_CONFIG = {
  reserveFraction: 0.2, // safety reserve kept unused
  goThresholdPct: 15, // margin at/above which the verdict is GO
  kPayload: 0.5, // payload energy slope (per full payload)
  kWind: 0.4, // wind energy slope (per full wind tolerance)
  climbSurcharge: 0.15, // climb energy as a fraction of cruise energy
  defaultHoverPowerW: 250,
  defaultCruisePowerW: 200,
  defaultCruiseSpeedMs: 12,
  defaultBatteryHealthPct: 100,
  defaultMaxFlightTimeMin: 20,
};
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/modules/feasibility/energy-model.service.spec.ts`:

```ts
import { EnergyModelService } from './energy-model.service';
import type { DroneSpec, MissionProfile, EnvConditions } from './feasibility.types';

const svc = new EnergyModelService();

// A capable drone: 500 Wh battery, modest power.
const strong: DroneSpec = {
  batteryCapacityWh: 500, hoverPowerW: 250, cruisePowerW: 200,
  cruiseSpeedMs: 15, batteryHealthPct: 100, windToleranceMs: 15, maxPayloadKg: 5,
};
// A short mission: 10 km cruise, 60 s hover, no payload.
const shortMission: MissionProfile = { distanceM: 10000, hoverTimeS: 60, payloadKg: 0 };
const noWind: EnvConditions = { windSpeedMs: 0 };

describe('EnergyModelService.evaluate', () => {
  it('returns GO with positive margin for a capable drone on a short mission', () => {
    const r = svc.evaluate(strong, shortMission, noWind);
    expect(r.verdict).toBe('GO');
    expect(r.marginPct).toBeGreaterThan(15);
    expect(r.usableWh).toBeCloseTo(500 * 1.0 * 0.8, 5); // health 100%, reserve 20%
    expect(r.confidence).toBe('HIGH');
    expect(r.requiredWh).toBeGreaterThan(0);
  });

  it('returns NO_GO for a long mission that exceeds usable energy', () => {
    const longMission: MissionProfile = { distanceM: 200000, hoverTimeS: 0, payloadKg: 0 };
    const r = svc.evaluate(strong, longMission, noWind);
    expect(r.verdict).toBe('NO_GO');
    expect(r.marginPct).toBeLessThan(0);
    expect(r.solutions.some((s) => s.kind === 'other_drone')).toBe(true);
  });

  it('payload increases required energy and can flip GO→NO_GO', () => {
    const light = svc.evaluate(strong, { distanceM: 90000, hoverTimeS: 0, payloadKg: 0 }, noWind);
    const heavy = svc.evaluate(strong, { distanceM: 90000, hoverTimeS: 0, payloadKg: 5 }, noWind);
    expect(heavy.requiredWh).toBeGreaterThan(light.requiredWh);
    expect(heavy.breakdown.payloadFactor).toBeCloseTo(1.5, 5); // 1 + 0.5*(5/5)
  });

  it('wind above the drone tolerance forces NO_GO regardless of margin', () => {
    const r = svc.evaluate(strong, shortMission, { windSpeedMs: 20 }); // tol 15
    expect(r.windExceeded).toBe(true);
    expect(r.verdict).toBe('NO_GO');
    expect(r.solutions.some((s) => s.kind === 'await_wind')).toBe(true);
  });

  it('lower battery health reduces usable energy', () => {
    const healthy = svc.evaluate(strong, shortMission, noWind);
    const degraded = svc.evaluate({ ...strong, batteryHealthPct: 50 }, shortMission, noWind);
    expect(degraded.usableWh).toBeLessThan(healthy.usableWh);
    expect(degraded.usableWh).toBeCloseTo(500 * 0.5 * 0.8, 5);
  });

  it('a drone missing energy specs falls back to defaults with LOW confidence', () => {
    const legacy: DroneSpec = { maxFlightTimeMin: 25, maxPayloadKg: 3 };
    const r = svc.evaluate(legacy, shortMission, noWind);
    expect(r.confidence).toBe('LOW');
    // legacy usable: capacity = (25/60)*250 Wh, then *1.0*0.8
    expect(r.usableWh).toBeCloseTo((25 / 60) * 250 * 0.8, 4);
    expect(['GO', 'MARGINAL', 'NO_GO']).toContain(r.verdict);
  });

  it('a MARGINAL/NO_GO with payload suggests reducing payload', () => {
    const r = svc.evaluate(strong, { distanceM: 120000, hoverTimeS: 0, payloadKg: 5 }, noWind);
    expect(r.verdict === 'NO_GO' || r.verdict === 'MARGINAL').toBe(true);
    expect(r.solutions.some((s) => s.kind === 'reduce_payload')).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest energy-model.service`
Expected: FAIL — cannot find module `./energy-model.service`.

- [ ] **Step 5: Implement EnergyModelService**

Create `backend/src/modules/feasibility/energy-model.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { FEASIBILITY_CONFIG as CFG } from './feasibility.config';
import type {
  DroneSpec,
  MissionProfile,
  EnvConditions,
  EnergyResult,
  Solution,
  Verdict,
} from './feasibility.types';

@Injectable()
export class EnergyModelService {
  /** Pure energy evaluation: available vs. required Wh → verdict + solutions. */
  evaluate(spec: DroneSpec, mission: MissionProfile, env: EnvConditions): EnergyResult {
    const hoverPowerW = spec.hoverPowerW ?? CFG.defaultHoverPowerW;
    const cruisePowerW = spec.cruisePowerW ?? CFG.defaultCruisePowerW;
    const cruiseSpeedMs = spec.cruiseSpeedMs ?? CFG.defaultCruiseSpeedMs;
    const healthPct = spec.batteryHealthPct ?? CFG.defaultBatteryHealthPct;

    const confidence: 'HIGH' | 'LOW' =
      spec.batteryCapacityWh != null &&
      spec.hoverPowerW != null &&
      spec.cruisePowerW != null &&
      spec.cruiseSpeedMs != null
        ? 'HIGH'
        : 'LOW';

    // Available energy (Wh). Legacy fallback: hover the rated flight time.
    let capacityWh = spec.batteryCapacityWh ?? null;
    if (capacityWh == null) {
      const tMin = spec.maxFlightTimeMin ?? CFG.defaultMaxFlightTimeMin;
      capacityWh = (tMin / 60) * hoverPowerW;
    }
    const usableWh = capacityWh * (healthPct / 100) * (1 - CFG.reserveFraction);

    // Required energy (Wh).
    const cruiseTimeS = cruiseSpeedMs > 0 ? mission.distanceM / cruiseSpeedMs : 0;
    const cruiseWh = (cruiseTimeS * cruisePowerW) / 3600;
    const hoverWh = (mission.hoverTimeS * hoverPowerW) / 3600;
    const climbWh = CFG.climbSurcharge * cruiseWh;

    const maxPayloadKg = spec.maxPayloadKg ?? 0;
    const payloadFactor =
      mission.payloadKg > 0 && maxPayloadKg > 0
        ? 1 + CFG.kPayload * (mission.payloadKg / maxPayloadKg)
        : 1;

    const windSpeedMs = env.windSpeedMs ?? 0;
    const windTolMs = spec.windToleranceMs ?? null;
    const windExceeded = windTolMs != null && windSpeedMs > windTolMs;
    const windFactor = windTolMs != null ? 1 + CFG.kWind * (windSpeedMs / windTolMs) : 1;

    const requiredWh = (cruiseWh + hoverWh + climbWh) * payloadFactor * windFactor;

    const marginPct = usableWh > 0 ? ((usableWh - requiredWh) / usableWh) * 100 : -100;

    let verdict: Verdict =
      marginPct >= CFG.goThresholdPct ? 'GO' : marginPct >= 0 ? 'MARGINAL' : 'NO_GO';
    if (windExceeded) verdict = 'NO_GO';

    const solutions =
      verdict === 'GO'
        ? []
        : this.buildSolutions({
            usableWh,
            baseWh: cruiseWh + hoverWh + climbWh,
            windFactor,
            payloadFactor,
            payloadKg: mission.payloadKg,
            maxPayloadKg,
            windExceeded,
            windTolMs,
          });

    return {
      verdict,
      marginPct: Math.round(marginPct * 10) / 10,
      usableWh: Math.round(usableWh * 10) / 10,
      requiredWh: Math.round(requiredWh * 10) / 10,
      breakdown: {
        cruiseWh: Math.round(cruiseWh * 10) / 10,
        hoverWh: Math.round(hoverWh * 10) / 10,
        climbWh: Math.round(climbWh * 10) / 10,
        payloadFactor: Math.round(payloadFactor * 100) / 100,
        windFactor: Math.round(windFactor * 100) / 100,
      },
      confidence,
      windExceeded,
      solutions,
    };
  }

  /** Deterministic mitigations for a MARGINAL/NO_GO result. */
  private buildSolutions(x: {
    usableWh: number;
    baseWh: number;
    windFactor: number;
    payloadFactor: number;
    payloadKg: number;
    maxPayloadKg: number;
    windExceeded: boolean;
    windTolMs: number | null;
  }): Solution[] {
    const out: Solution[] = [];

    if (x.windExceeded && x.windTolMs != null) {
      out.push({
        kind: 'await_wind',
        label: `Wait for wind below ${x.windTolMs} m/s`,
        detail: `Current wind exceeds the drone's ${x.windTolMs} m/s tolerance.`,
      });
    }

    // Reduce payload so that required energy hits the GO margin.
    if (x.payloadKg > 0 && x.maxPayloadKg > 0) {
      const targetRequired = x.usableWh * (1 - CFG.goThresholdPct / 100);
      const targetPayloadFactor = targetRequired / (x.baseWh * x.windFactor);
      const targetPayloadKg = ((targetPayloadFactor - 1) / CFG.kPayload) * x.maxPayloadKg;
      if (targetPayloadKg >= 0 && targetPayloadKg < x.payloadKg) {
        const drop = Math.ceil((x.payloadKg - targetPayloadKg) * 10) / 10;
        out.push({
          kind: 'reduce_payload',
          label: `Reduce payload by ~${drop} kg`,
          detail: `Lowering payload to ~${Math.round(targetPayloadKg * 10) / 10} kg brings the mission within a safe margin.`,
        });
      }
    }

    out.push({
      kind: 'charging_stop',
      label: 'Add a charging stop',
      detail: 'Split the mission with a recharge to stay within a single-charge range.',
    });
    out.push({
      kind: 'other_drone',
      label: 'Use another drone',
      detail: 'Assign a drone with a larger battery or lower power draw.',
    });

    return out;
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest energy-model.service`
Expected: PASS (7 tests). If the long-mission distances don't land on the expected verdict, adjust the test distances (they are the guard) — do not weaken the assertions.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/feasibility/feasibility.types.ts backend/src/modules/feasibility/feasibility.config.ts backend/src/modules/feasibility/energy-model.service.ts backend/src/modules/feasibility/energy-model.service.spec.ts
git commit -m "feat(feasibility): pure energy model + config + types"
```

---

## Task 3: FeasibilityService (gather + run + explain)

**Files:**
- Create: `backend/src/modules/feasibility/feasibility.service.ts`
- Test: `backend/src/modules/feasibility/feasibility.service.spec.ts`

**Interfaces:**
- Consumes: `EnergyModelService.evaluate` (Task 2); `DronesService.findById(id): Promise<Drone>`; `MissionsService.findById(id): Promise<Mission>` (mission has `estimatedDistance`, `waypoints[]` with `hoverDuration`, `departureHubId`); `WeatherService.getGoNoGo(hubId): Promise<{ wind: { speedMs: number | null } }>`; `ClaudeService` (`hasKey()`, `messageJson<T>(opts)`, `ClaudeService.SONNET`).
- Produces: `FeasibilityService.check(input: { droneId: string; missionId: string; payloadKg?: number }): Promise<FeasibilityResult>`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/feasibility/feasibility.service.spec.ts`:

```ts
import { FeasibilityService } from './feasibility.service';
import { EnergyModelService } from './energy-model.service';

const energy = new EnergyModelService();

const drone = {
  id: 'd1', batteryCapacityWh: 500, hoverPowerW: 250, cruisePowerW: 200,
  cruiseSpeedMs: 15, batteryHealthPct: 100, windToleranceMs: 15, maxPayload: 5, maxFlightTime: 30,
};
const mission = {
  id: 'm1', estimatedDistance: 10000, departureHubId: 'h1',
  waypoints: [{ hoverDuration: 30 }, { hoverDuration: 30 }],
};

function makeSvc(claudeOpts: Partial<{ hasKey: () => boolean; messageJson: jest.Mock }> = {}) {
  const drones = { findById: jest.fn().mockResolvedValue(drone) } as never;
  const missions = { findById: jest.fn().mockResolvedValue(mission) } as never;
  const weather = { getGoNoGo: jest.fn().mockResolvedValue({ wind: { speedMs: 3 } }) } as never;
  const claude = {
    hasKey: claudeOpts.hasKey ?? (() => false),
    messageJson: claudeOpts.messageJson ?? jest.fn(),
  } as never;
  return new FeasibilityService(energy, drones, missions, weather, claude);
}

describe('FeasibilityService.check', () => {
  it('returns a verdict with a deterministic explanation when no API key', async () => {
    const svc = makeSvc();
    const r = await svc.check({ droneId: 'd1', missionId: 'm1' });
    expect(r.verdict).toBe('GO');
    expect(r.explanationSource).toBe('deterministic');
    expect(r.explanation.length).toBeGreaterThan(0);
    expect(r.windUsed).toEqual({ speedMs: 3, source: 'METAR' });
  });

  it('uses the AI explanation when the AI call succeeds', async () => {
    const messageJson = jest.fn().mockResolvedValue({ explanation: 'Plenty of reserve for this hop.' });
    const svc = makeSvc({ hasKey: () => true, messageJson });
    const r = await svc.check({ droneId: 'd1', missionId: 'm1' });
    expect(r.explanationSource).toBe('ai');
    expect(r.explanation).toContain('reserve');
  });

  it('falls back to deterministic when the AI returns null', async () => {
    const messageJson = jest.fn().mockResolvedValue(null);
    const svc = makeSvc({ hasKey: () => true, messageJson });
    const r = await svc.check({ droneId: 'd1', missionId: 'm1' });
    expect(r.explanationSource).toBe('deterministic');
  });

  it('honors an explicit payloadKg override', async () => {
    const svc = makeSvc();
    const light = await svc.check({ droneId: 'd1', missionId: 'm1', payloadKg: 0 });
    const heavy = await svc.check({ droneId: 'd1', missionId: 'm1', payloadKg: 5 });
    expect(heavy.requiredWh).toBeGreaterThan(light.requiredWh);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest feasibility.service`
Expected: FAIL — cannot find module `./feasibility.service`.

- [ ] **Step 3: Implement FeasibilityService**

Create `backend/src/modules/feasibility/feasibility.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import { DronesService } from '../drones/drones.service';
import { MissionsService } from '../missions/missions.service';
import { WeatherService } from '../weather/weather.service';
import { EnergyModelService } from './energy-model.service';
import type {
  DroneSpec,
  MissionProfile,
  EnergyResult,
  FeasibilityResult,
} from './feasibility.types';

const EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation'],
  properties: { explanation: { type: 'string' } },
};

@Injectable()
export class FeasibilityService {
  private readonly logger = new Logger(FeasibilityService.name);

  constructor(
    private readonly energy: EnergyModelService,
    private readonly drones: DronesService,
    private readonly missions: MissionsService,
    private readonly weather: WeatherService,
    private readonly claude: ClaudeService,
  ) {}

  async check(input: {
    droneId: string;
    missionId: string;
    payloadKg?: number;
  }): Promise<FeasibilityResult> {
    const drone = await this.drones.findById(input.droneId);
    const mission = await this.missions.findById(input.missionId);

    const spec: DroneSpec = {
      batteryCapacityWh: drone.batteryCapacityWh ?? null,
      hoverPowerW: drone.hoverPowerW ?? null,
      cruisePowerW: drone.cruisePowerW ?? null,
      cruiseSpeedMs: drone.cruiseSpeedMs ?? null,
      batteryHealthPct: drone.batteryHealthPct ?? null,
      windToleranceMs: drone.windToleranceMs ?? null,
      maxPayloadKg: drone.maxPayload ?? null,
      maxFlightTimeMin: drone.maxFlightTime ?? null,
    };

    const waypoints = (mission.waypoints ?? []) as Array<{ hoverDuration?: number | null }>;
    const hoverTimeS = waypoints.reduce((sum, w) => sum + (w.hoverDuration ?? 0), 0);
    const profile: MissionProfile = {
      distanceM: mission.estimatedDistance ?? 0,
      hoverTimeS,
      payloadKg: input.payloadKg ?? 0,
    };

    // Live wind from the departure hub (best-effort).
    let windSpeedMs: number | null = null;
    try {
      if (mission.departureHubId) {
        const w = await this.weather.getGoNoGo(mission.departureHubId);
        windSpeedMs = w?.wind?.speedMs ?? null;
      }
    } catch {
      windSpeedMs = null;
    }

    const result: EnergyResult = this.energy.evaluate(spec, profile, { windSpeedMs });

    const explanation = await this.explain(result, drone, profile, windSpeedMs);

    return {
      ...result,
      windUsed: windSpeedMs != null ? { speedMs: windSpeedMs, source: 'METAR' } : null,
      explanation: explanation.text,
      explanationSource: explanation.source,
    };
  }

  private async explain(
    result: EnergyResult,
    drone: { registrationNumber?: string; model?: string },
    profile: MissionProfile,
    windSpeedMs: number | null,
  ): Promise<{ text: string; source: 'ai' | 'deterministic' }> {
    if (this.claude.hasKey()) {
      try {
        const ai = await this.claude.messageJson<{ explanation: string }>({
          system:
            'You are a drone fleet dispatcher. In 1-2 sentences, plainly explain the ' +
            'mission-feasibility verdict to an operator, citing the energy margin and the ' +
            'main driver (distance, payload, wind, or battery health). If not GO, point at ' +
            'the top recommended fix. Be concise and concrete.',
          user: [
            `Drone ${drone.registrationNumber ?? ''} (${drone.model ?? 'unknown model'}).`,
            `Verdict: ${result.verdict}. Margin: ${result.marginPct}%.`,
            `Usable: ${result.usableWh} Wh, required: ${result.requiredWh} Wh.`,
            `Breakdown: cruise ${result.breakdown.cruiseWh} Wh, hover ${result.breakdown.hoverWh} Wh, climb ${result.breakdown.climbWh} Wh, payloadFactor ${result.breakdown.payloadFactor}, windFactor ${result.breakdown.windFactor}.`,
            `Payload ${profile.payloadKg} kg, wind ${windSpeedMs ?? 'n/a'} m/s, confidence ${result.confidence}.`,
            `Solutions: ${result.solutions.map((s) => s.label).join('; ') || 'none'}.`,
          ].join('\n'),
          schema: EXPLANATION_SCHEMA,
          model: ClaudeService.SONNET,
          maxTokens: 400,
        });
        if (ai && typeof ai.explanation === 'string' && ai.explanation.trim()) {
          return { text: ai.explanation.trim(), source: 'ai' };
        }
      } catch (e) {
        this.logger.warn(`Feasibility explanation failed: ${(e as Error).message}`);
      }
    }
    return { text: this.deterministicExplanation(result), source: 'deterministic' };
  }

  private deterministicExplanation(result: EnergyResult): string {
    const conf = result.confidence === 'LOW' ? ' (low-confidence estimate — add the drone\'s energy specs)' : '';
    if (result.verdict === 'GO') {
      return `Feasible on one charge with ${result.marginPct}% energy reserve${conf}.`;
    }
    if (result.verdict === 'MARGINAL') {
      return `Marginal: only ${result.marginPct}% reserve${conf}. Consider: ${result.solutions[0]?.label ?? 'reducing load'}.`;
    }
    return `Not feasible on one charge (short by ${Math.abs(result.marginPct)}% of usable energy)${conf}. Best fix: ${result.solutions[0]?.label ?? 'use another drone'}.`;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx jest feasibility.service`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/feasibility/feasibility.service.ts backend/src/modules/feasibility/feasibility.service.spec.ts
git commit -m "feat(feasibility): service — gather specs/segments/wind, run model, explain"
```

---

## Task 4: Controller + module wiring + live curl

**Files:**
- Create: `backend/src/modules/feasibility/feasibility.controller.ts`
- Create: `backend/src/modules/feasibility/feasibility.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `FeasibilityService.check`.
- Produces HTTP: `POST /api/v1/feasibility/check` body `{ droneId, missionId, payloadKg? }` → `FeasibilityResult`.

- [ ] **Step 1: Write the controller**

Create `backend/src/modules/feasibility/feasibility.controller.ts`:

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeasibilityService } from './feasibility.service';

@ApiTags('Feasibility')
@ApiBearerAuth()
@Controller('feasibility')
export class FeasibilityController {
  constructor(private readonly feasibility: FeasibilityService) {}

  @Post('check')
  @ApiOperation({ summary: 'Predict whether a drone can complete a mission on one charge' })
  async check(@Body() body: { droneId: string; missionId: string; payloadKg?: number }) {
    return this.feasibility.check(body);
  }
}
```

- [ ] **Step 2: Write the module**

Create `backend/src/modules/feasibility/feasibility.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { FeasibilityController } from './feasibility.controller';
import { FeasibilityService } from './feasibility.service';
import { EnergyModelService } from './energy-model.service';
import { AiModule } from '../ai/ai.module';
import { DronesModule } from '../drones/drones.module';
import { MissionsModule } from '../missions/missions.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [AiModule, DronesModule, MissionsModule, WeatherModule],
  providers: [EnergyModelService, FeasibilityService],
  controllers: [FeasibilityController],
})
export class FeasibilityModule {}
```

- [ ] **Step 3: Register the module**

In `backend/src/app.module.ts`, add the import near the other module imports and add `FeasibilityModule` to the `imports` array (after `CopilotModule` or `ForesightModule` if present):

```ts
import { FeasibilityModule } from './modules/feasibility/feasibility.module';
```
```ts
    FeasibilityModule,
```

Verify `DronesModule` exports `DronesService`, `MissionsModule` exports `MissionsService`, `WeatherModule` exports `WeatherService`, `AiModule` exports `ClaudeService`. If any does not, add it to that module's `exports` array (one-line change). Report which you touched.

- [ ] **Step 4: Typecheck + run all feasibility tests**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx tsc --noEmit -p tsconfig.json && npx jest feasibility energy-model`
Expected: tsc clean; all feasibility specs PASS.

- [ ] **Step 5: Boot backend and verify live**

Build and boot (fast, no source maps): in `backend/`, `npm run build && node dist/main`. Then in another shell:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"operator@drops-utm.com","password":"password123"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).accessToken))')
DRONE=$(curl -s http://localhost:3001/api/v1/drones -H "authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);const l=Array.isArray(a)?a:a.data;console.log(l[0].id)})')
MISSION=$(curl -s http://localhost:3001/api/v1/missions -H "authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);const l=Array.isArray(a)?a:a.data;console.log(l[0].id)})')
curl -s -X POST http://localhost:3001/api/v1/feasibility/check -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"droneId\":\"$DRONE\",\"missionId\":\"$MISSION\"}" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log("verdict:",j.verdict,"margin:",j.marginPct,"conf:",j.confidence);console.log("explanation:",j.explanation)})'
```
Expected: a JSON verdict (GO/MARGINAL/NO_GO) with margin, confidence, and an explanation. Then stop the backend (free port 3001).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/feasibility/feasibility.controller.ts backend/src/modules/feasibility/feasibility.module.ts backend/src/app.module.ts
git commit -m "feat(feasibility): controller + module wiring + endpoint"
```

---

## Task 5: Frontend API client + types

**Files:**
- Modify: `frontend/src/lib/api.ts` (append after the last export)

**Interfaces:**
- Produces: `feasibilityApi.check({ droneId, missionId, payloadKg? })` and exported types `FeasibilityVerdict`, `FeasibilitySolution`, `FeasibilityResult`.

- [ ] **Step 1: Append the client + types**

Add to the end of `frontend/src/lib/api.ts`:

```ts
// ── Mission Feasibility ──
export type FeasibilityVerdict = 'GO' | 'MARGINAL' | 'NO_GO';

export interface FeasibilitySolution {
  kind: 'reduce_payload' | 'charging_stop' | 'other_drone' | 'await_wind';
  label: string;
  detail: string;
}

export interface FeasibilityResult {
  verdict: FeasibilityVerdict;
  marginPct: number;
  usableWh: number;
  requiredWh: number;
  breakdown: {
    cruiseWh: number;
    hoverWh: number;
    climbWh: number;
    payloadFactor: number;
    windFactor: number;
  };
  confidence: 'HIGH' | 'LOW';
  windExceeded: boolean;
  solutions: FeasibilitySolution[];
  windUsed: { speedMs: number; source: string } | null;
  explanation: string;
  explanationSource: 'ai' | 'deterministic';
}

export const feasibilityApi = {
  check: (body: { droneId: string; missionId: string; payloadKg?: number }) =>
    api.post<FeasibilityResult>('/feasibility/check', body),
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit 2>&1 | grep -E '^src/'`
Expected: no `src/` errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(feasibility): frontend API client + types"
```

---

## Task 6: Drone registration — Energy & Performance fields

**Files:**
- Modify: `frontend/src/app/dashboard/drones/page.tsx`

**Interfaces:**
- Consumes: `dronesApi.create` / `dronesApi.update` (existing) — the new fields ride along in the same payload object.
- Produces: the drone create/edit form persists `batteryCapacityWh`, `hoverPowerW`, `cruisePowerW`, `cruiseSpeedMs`, `batteryHealthPct`, `windToleranceMs`.

- [ ] **Step 1: Read the file and locate the form**

Open `frontend/src/app/dashboard/drones/page.tsx`. Find the create/edit form's state object (the fields sent to `dronesApi.create`) and the JSX block where numeric spec inputs like `maxPayload` / `maxSpeed` / `maxFlightTime` are rendered.

- [ ] **Step 2: Add the fields to form state**

Add these keys to the form's initial state object (matching the existing state shape — numbers or empty strings as the file already does for `maxPayload` etc.):

```ts
  batteryCapacityWh: '',
  hoverPowerW: '',
  cruisePowerW: '',
  cruiseSpeedMs: '',
  batteryHealthPct: '',
  windToleranceMs: '',
```

Ensure they are included in the object passed to `dronesApi.create`/`update`. If the file coerces numeric fields (e.g. `Number(form.maxPayload) || undefined`), coerce these the same way so empty stays undefined.

- [ ] **Step 3: Add an "Energy & Performance" section to the form JSX**

Next to the existing spec inputs, add a labeled group (follow the exact input/label markup the file already uses for `maxPayload`). Each input is `type="number"`, bound to the matching state key, with these labels:
- "Battery capacity (Wh)" → `batteryCapacityWh`
- "Hover power (W)" → `hoverPowerW`
- "Cruise power (W)" → `cruisePowerW`
- "Cruise speed (m/s)" → `cruiseSpeedMs`
- "Battery health (%)" → `batteryHealthPct`
- "Wind tolerance (m/s)" → `windToleranceMs`

- [ ] **Step 4: Typecheck + visual verify**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit 2>&1 | grep -E '^src/'` (expect none). Then with both servers running, open the drones page, add a drone with energy fields filled, save, and confirm via `GET /api/v1/drones` that the values persisted.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/drones/page.tsx
git commit -m "feat(feasibility): Energy & Performance fields in drone registration"
```

---

## Task 7: Mission-creation verdict card + NO_GO override

**Files:**
- Create: `frontend/src/components/feasibility/feasibility-card.tsx`
- Modify: `frontend/src/app/dashboard/missions/new/page.tsx`

**Interfaces:**
- Consumes: `feasibilityApi.check`, `FeasibilityResult`; existing mission-create state (selected `droneId`, the mission being built, and the `missionsApi.create` call).
- Produces: `<FeasibilityCard droneId missionId payloadKg onVerdict />` and a NO_GO override gate on the mission-create submit.

Note on wiring: `/feasibility/check` needs a `missionId`, but during *creation* the mission may not be saved yet. Handle this pragmatically: the card renders only once a `droneId` and a persisted `missionId` are available (e.g. after a draft save, or when editing an existing mission). If the new-mission page saves a draft before finalizing, call the check with that draft id. If the page has no draft id yet, show a muted "Save a draft to check feasibility" placeholder. Confirm the actual create flow in the file and wire to whichever id is available.

- [ ] **Step 1: Create the card component**

Create `frontend/src/components/feasibility/feasibility-card.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BatteryWarning, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { feasibilityApi, type FeasibilityResult } from '@/lib/api';

const STYLES: Record<string, { ring: string; text: string; Icon: typeof CheckCircle2; label: string }> = {
  GO: { ring: 'border-emerald-500/40 bg-emerald-500/5', text: 'text-emerald-500', Icon: CheckCircle2, label: 'GO' },
  MARGINAL: { ring: 'border-amber-500/40 bg-amber-500/5', text: 'text-amber-500', Icon: BatteryWarning, label: 'MARGINAL' },
  NO_GO: { ring: 'border-destructive/40 bg-destructive/5', text: 'text-destructive', Icon: XCircle, label: 'NO-GO' },
};

export function FeasibilityCard({
  droneId,
  missionId,
  payloadKg,
  onVerdict,
}: {
  droneId?: string;
  missionId?: string;
  payloadKg?: number;
  onVerdict?: (r: FeasibilityResult | null) => void;
}) {
  const [result, setResult] = useState<FeasibilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!droneId || !missionId) {
      setResult(null);
      onVerdict?.(null);
      return;
    }
    let alive = true;
    setLoading(true);
    feasibilityApi
      .check({ droneId, missionId, payloadKg })
      .then(({ data }) => { if (alive) { setResult(data); onVerdict?.(data); } })
      .catch(() => { if (alive) { setResult(null); onVerdict?.(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droneId, missionId, payloadKg]);

  if (!droneId || !missionId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Select a drone and save a draft to check mission feasibility.
      </div>
    );
  }

  if (loading || !result) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking feasibility…
      </div>
    );
  }

  const s = STYLES[result.verdict];
  return (
    <div className={cn('rounded-lg border p-3 text-sm', s.ring)}>
      <div className="flex items-center gap-2">
        <s.Icon className={cn('h-4 w-4', s.text)} />
        <span className={cn('font-bold uppercase tracking-wide', s.text)}>{s.label}</span>
        <span className="ml-1 font-mono text-xs text-muted-foreground">{result.marginPct}% reserve</span>
        {result.confidence === 'LOW' && (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">LOW CONFIDENCE</span>
        )}
      </div>
      <p className="mt-1.5 flex items-start gap-1 text-xs">
        {result.explanationSource === 'ai' && <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />}
        <span>{result.explanation}</span>
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {result.usableWh} Wh usable · {result.requiredWh} Wh required
        {result.windUsed ? ` · wind ${result.windUsed.speedMs} m/s` : ''}
      </p>
      {result.verdict !== 'GO' && result.solutions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.solutions.map((sol, i) => (
            <li key={i} className="text-xs">
              <span className="font-semibold">{sol.label}</span>
              <span className="text-muted-foreground"> — {sol.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount the card in mission creation**

Open `frontend/src/app/dashboard/missions/new/page.tsx`. Identify the selected drone id, the mission draft id (or existing mission id if editing), and the payload the operator entered (if any; else pass `undefined`). Render `<FeasibilityCard droneId={...} missionId={...} payloadKg={...} onVerdict={setFeasibility} />` in the review/summary area of the form, and hold the latest result in state:

```tsx
import { FeasibilityCard } from '@/components/feasibility/feasibility-card';
import type { FeasibilityResult } from '@/lib/api';
// ...
const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null);
```

- [ ] **Step 3: Add the NO_GO override gate on submit**

Wrap the existing "create mission" submit handler so that, when `feasibility?.verdict === 'NO_GO'`, the operator must confirm an override with a typed reason before the create call proceeds. On override, include the reason in the create payload as `feasibilityOverride`:

```tsx
const submit = async () => {
  if (feasibility?.verdict === 'NO_GO') {
    const reason = window.prompt(
      'Feasibility check is NO-GO for this drone/mission. Type a justification to override, or Cancel:',
    );
    if (!reason) return; // cancelled — do not create
    await missionsApi.create({ ...missionPayload, feasibilityOverride: { reason, verdict: 'NO_GO', at: new Date().toISOString() } });
  } else {
    await missionsApi.create(missionPayload);
  }
  // ...existing post-create navigation
};
```

(If `missionsApi.create` types reject the extra field, cast the payload to `Record<string, unknown>` as the existing code does, or extend the create DTO — follow the file's existing typing.)

- [ ] **Step 4: Typecheck + visual verify**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit 2>&1 | grep -E '^src/'` (expect none). Then with both servers running: open new-mission, pick a drone, and confirm the verdict card renders; construct a NO_GO case (e.g. a long mission or a low-capacity drone) and confirm the override prompt blocks creation until a reason is given.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feasibility/feasibility-card.tsx frontend/src/app/dashboard/missions/new/page.tsx
git commit -m "feat(feasibility): mission-creation verdict card + NO_GO override"
```

---

## Task 8: End-to-end verification

**Files:** none — drives the running app.

- [ ] **Step 1: Ensure both servers run**

Backend: `cd backend && npm run build && node dist/main`. Frontend: `cd frontend && npm run dev`. Confirm `:3001` and `:3005` listen.

- [ ] **Step 2: Register a drone with energy specs**

In the drones page, add a drone with: battery 300 Wh, hover 250 W, cruise 200 W, cruise speed 15 m/s, health 100, wind tolerance 12. Save; confirm persisted.

- [ ] **Step 3: Drive the mission-creation check (Playwright or manual)**

Create/edit a mission, assign the drone, and confirm:
1. The feasibility card renders a verdict with margin, breakdown, and explanation.
2. A short mission → GO; a long mission (or heavy payload) → MARGINAL/NO_GO with solutions listed.
3. A NO_GO submit prompts for an override reason and only creates when a reason is given.

- [ ] **Step 4: Final typecheck + backend tests**

Run: `cd /Users/nikiokos/Documents/Drops_UTM/backend && npx tsc --noEmit -p tsconfig.json && npx jest feasibility energy-model drone-energy-fields`
Run: `cd /Users/nikiokos/Documents/Drops_UTM/frontend && npx tsc --noEmit 2>&1 | grep -E '^src/'`
Expected: all green / no src errors.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "test(feasibility): end-to-end verification"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** drone energy fields (Task 1), physics model with payload/hover/wind/health + legacy fallback + config (Task 2), Claude explanation + deterministic fallback + wind gather (Task 3), endpoint/wiring (Task 4), frontend client (Task 5), registration UI (Task 6), mission-creation card + NO_GO override (Task 7), E2E (Task 8). Every spec section maps to a task.
- **Type consistency:** `DroneSpec`/`MissionProfile`/`EnvConditions`/`EnergyResult`/`FeasibilityResult`/`Solution` defined once in `feasibility.types.ts` (Task 2) and mirrored in `lib/api.ts` (Task 5); verdict values `'GO'|'MARGINAL'|'NO_GO'` used consistently; `evaluate()` and `check()` signatures stable across Tasks 2–7.
- **Known verification points (resolve during build, not placeholders):** confirm module `exports` in Task 4 Step 3; confirm the mission-create draft-id availability and payload source in Task 7 Step 2 (the file's actual create flow governs which id feeds the card).
