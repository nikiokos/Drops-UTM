# Mission Feasibility Predictor — Design Spec

**Date:** 2026-07-01
**Status:** Approved, ready for implementation plan
**Branch:** `feat/mission-feasibility` (to be created off `master`)

## Summary

Enrich each drone's characteristics at registration with an **energy/performance
profile**, and add an **intelligent feasibility predictor** that answers, at mission
assignment time, whether a given drone can complete a given job **on a single charge**.
The verdict is produced by a deterministic physics energy model (battery vs. required
energy, corrected for payload, flight phases, wind, and battery health), and a Claude
agent turns the structured result into a human explanation and recommendations. When a
mission is created and a drone is declared for it, the operator sees a live
GO / MARGINAL / NO-GO verdict with the energy margin and concrete fixes.

## Goals

- Capture richer, manufacturer-grade drone specs at registration (battery, power,
  cruise speed, wind tolerance, battery health).
- Given a drone + a mission, compute whether it is energetically feasible on one charge,
  with a margin and an explainable breakdown.
- Surface the check **live inside mission creation** (and as a standalone endpoint), so
  a drone that cannot do the job is flagged before it is dispatched.
- Offer concrete mitigations on MARGINAL / NO-GO (reduce payload, add a charging stop,
  pick another drone).
- Never hard-block: on NO-GO the operator may override with a logged justification.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Prediction core | **Physics energy model** (deterministic) + **Claude** for the human explanation |
| Factors modeled | payload weight, flight phases (cruise/hover/climb), wind (live METAR), battery health/age, manufacturer specs as baseline |
| Output | **Verdict + energy margin + solutions** (GO / MARGINAL / NO-GO) |
| Battery unit | Declared directly in **Wh** |
| Battery health | **Manual** `batteryHealthPct` field for now (later fed from a BMS/API) |
| Legacy drones | New fields **optional**; missing → conservative defaults + `confidence: LOW` |
| NO-GO policy | **Warn + override with justification** (logged), never a hard block |
| Thresholds/multipliers | **Config-driven** (reserve %, GO threshold, payload/wind factors) |

## Data Model — new drone characteristics (registration)

Add to the `Drone` entity (all nullable / optional; TypeORM columns + migration-safe
defaults). `maxPayload` already exists and is reused as `maxPayloadKg`.

| Field | Type | Meaning |
|---|---|---|
| `batteryCapacityWh` | real, nullable | Usable battery energy, Wh |
| `hoverPowerW` | real, nullable | Power draw while hovering, W |
| `cruisePowerW` | real, nullable | Power draw in level cruise, W |
| `cruiseSpeedMs` | real, nullable | Nominal cruise speed, m/s (distinct from `maxSpeed`) |
| `batteryHealthPct` | real, default 100 | Battery state of health, 0–100 (manual for now) |
| `windToleranceMs` | real, nullable | Max sustained wind the drone is rated for, m/s |

Registration UI gains an **"Energy & Performance"** section exposing these fields
(optional). The manufacturer freeform `capabilities` / `specifications` JSON stays.

## The Feasibility Engine (physics core)

### A. Available energy

```
usableWh = batteryCapacityWh × (batteryHealthPct / 100) × (1 − reserveFraction)
```

- `reserveFraction` — safety reserve, config default **0.20**.
- Legacy drone with no `batteryCapacityWh` → estimate from `maxFlightTime × hoverPowerW`
  (or a default hover power), and set `confidence: LOW`.

### B. Required energy

Decompose the mission into phases from its waypoints; if there are no waypoints, fall
back to `estimatedDistance` / `estimatedDuration`.

- **Cruise:** `cruiseTimeS = distance / cruiseSpeedMs`, `cruiseWh = cruiseTimeS × cruisePowerW / 3600`
- **Hover:** `hoverWh = Σ(hoverDuration) × hoverPowerW / 3600`
- **Climb:** modeled as a cruise surcharge in v1 (a fixed `climbSurcharge` multiplier on
  the portion of energy attributed to climbing segments)

Two correction multipliers applied to the phase sum (kept independent to avoid
double-counting — cruise time uses the nominal `cruiseSpeedMs`, and wind is folded into
a single `windFactor` rather than also altering ground speed):

- **Payload:** `payloadFactor = 1 + kPayload × (payloadKg / maxPayloadKg)`
- **Wind (live METAR):** `windFactor = 1 + kWind × (windSpeedMs / windToleranceMs)` — the
  single wind correction. If `windSpeedMs > windToleranceMs` → **automatic NO-GO** (outside
  the drone's rating), regardless of margin.

```
requiredWh = (cruiseWh + hoverWh + climbWh) × payloadFactor × windFactor
```

### C. Verdict

```
marginPct = (usableWh − requiredWh) / usableWh × 100
```

| Verdict | Condition |
|---|---|
| 🟢 GO | `marginPct ≥ goThreshold` (config default 15) |
| 🟡 MARGINAL | `0 ≤ marginPct < goThreshold` |
| 🔴 NO-GO | `marginPct < 0`, or wind exceeds `windToleranceMs` |

### D. Solutions (on MARGINAL / NO-GO)

Computed deterministically from the model, then narrated by Claude:

- "Reduce payload by X kg → GO" (solve payloadFactor for the target margin)
- "Add a charging stop at hub Y" (nearest hub on the route)
- "Use another drone" (hand off to a future fleet-ranking step)

The physics produces the verdict, the numbers, and the raw solution set; `ClaudeService.
messageJson` turns them into a short human explanation + prioritized recommendation,
with a deterministic templated fallback when no API key is configured.

## Architecture

New backend module `modules/feasibility/`:

- `energy-model.service.ts` — `EnergyModelService`: the pure physics (available energy,
  required energy, verdict, raw solutions). No I/O; fully unit-testable.
- `feasibility.service.ts` — `FeasibilityService`: gathers the drone's specs, the
  mission's segments, and live wind; runs the energy model; calls Claude for the
  explanation; returns the full result.
- `feasibility.controller.ts` — `POST /feasibility/check`.
- `feasibility.config.ts` — tunable constants (reserveFraction=0.20, goThreshold=15,
  kPayload, kWind, climbSurcharge, and legacy defaults for missing specs).
- `feasibility.module.ts` — imports Drones, Missions, Weather, Ai modules.

```
Mission creation UI ──POST /feasibility/check {droneId, missionId}──▶ FeasibilityService
   │  ▲                                                                  │ drone specs (DronesService)
   │  │ { verdict, marginPct, usableWh, requiredWh, breakdown,           │ mission segments (MissionsService)
   │  │   windUsed, confidence, solutions[], explanation }               │ live wind (WeatherService)
   │  │                                                                  ▼
   │  └───────────────────────────────  EnergyModelService (pure) → verdict + numbers
   │                                                        │
   ▼                                            ClaudeService.messageJson → explanation
Live verdict card (GO/MARGINAL/NO-GO) · margin · breakdown · solutions · override-with-reason
```

### Response shape (indicative)

```ts
interface FeasibilityResult {
  verdict: 'GO' | 'MARGINAL' | 'NO_GO';
  marginPct: number;
  usableWh: number;
  requiredWh: number;
  breakdown: { cruiseWh: number; hoverWh: number; climbWh: number;
               payloadFactor: number; windFactor: number };
  windUsed: { speedMs: number; source: string } | null;
  confidence: 'HIGH' | 'LOW';
  solutions: Array<{ kind: 'reduce_payload' | 'charging_stop' | 'other_drone';
                     label: string; detail: string }>;
  explanation: string;
  explanationSource: 'ai' | 'deterministic';
}
```

## Integration (the connected flow)

1. **Drone registration** — the form's new "Energy & Performance" section persists the
   fields above. Without them, checks run at `confidence: LOW`.
2. **Mission creation** — once a drone is selected and the route (waypoints/hubs) is
   defined, the UI calls `/feasibility/check` and renders a **live verdict card**;
   changing the drone or payload re-runs it. On **NO-GO**, submission shows a prominent
   warning and requires an explicit **override with a typed justification**, which is
   recorded on the mission (e.g. `feasibilityOverride: { reason, verdict, at }`).
3. **Standalone** — `/feasibility/check` is reusable for a future fleet-ranking view
   (rank which drones can do a job).

## Guardrails / Safety

- The check is advisory + informational; it never auto-executes anything.
- NO-GO does not hard-block — operators override with a logged reason (conditions change,
  human judgment). The override is persisted for audit.
- Missing `ANTHROPIC_API_KEY` → deterministic templated explanation; the check still works.
- Legacy drones without energy specs still get a verdict (LOW confidence), never an error.

## Testing / Verification

- **Unit** (`EnergyModelService`): a known drone + mission → correct `usableWh`,
  `requiredWh`, `verdict`, and margin; payload/wind/health each shift the result the
  right way; wind over tolerance forces NO-GO; legacy-defaults path yields LOW confidence.
- **Live**: `curl POST /feasibility/check` against a seed drone + seed mission returns a
  grounded verdict with a breakdown.
- **E2E**: in mission creation, selecting a drone shows the verdict card; a NO-GO case
  shows solutions and requires an override reason to proceed.

## Build Sequence

1. Drone entity fields + registration DTO/validation + migration-safe defaults.
2. `EnergyModelService` (pure physics) + unit tests.
3. `FeasibilityService` + `feasibility.config.ts` + Claude explanation (with fallback).
4. `POST /feasibility/check` + module wiring + live curl test.
5. Registration UI "Energy & Performance" section.
6. Mission-creation verdict card + live re-check + NO-GO override-with-reason flow.
7. End-to-end verification.

## Non-Goals (v1, YAGNI)

- No data-driven / learned consumption model (physics only for now; historical telemetry
  learning is future).
- No automatic fleet-wide ranking UI (the endpoint supports it; the view is future).
- No automatic battery-health from telemetry/BMS yet (manual field now, API later).
- No multi-leg / mid-mission recharge planning beyond suggesting a single charging stop.
- No wind forecast along the route — a single representative METAR wind for v1.

## Future (not v1)

Learned per-drone consumption from historical telemetry, live battery-health ingestion,
fleet-ranking view, per-segment wind from forecast, and multi-stop energy routing.
