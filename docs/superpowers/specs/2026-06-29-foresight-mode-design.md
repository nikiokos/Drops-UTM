# Foresight Mode — Design Spec

**Date:** 2026-06-29
**Status:** Approved, ready for implementation plan
**Branch:** `feat/live-data-and-utm-safety`

## Summary

**Foresight Mode** is the "wow" centerpiece for DROPS UTM: a predictive look-ahead
layer that shows operators the airspace **N minutes into the future**, detects
conflicts **before they happen**, has an autonomous **Air Traffic Director** (Claude
agent) propose explainable resolutions, and lets the operator **confirm by voice** —
all dramatized cinematically on the live tactical map.

It is built primarily as an investor/demo hero feature, but on honest foundations:
real conflict-geometry math, the real Claude agent, and a **scripted-but-real**
scenario from a lightweight in-memory provider over live ADS-B / weather background.
Nothing is faked; the conflict is simply staged so it is guaranteed to occur on cue.

## Goals

- Show a predicted conflict on the map **before it occurs** (ghost trails, a pulsing
  predicted-collision point, a countdown).
- An autonomous **Air Traffic Director** assesses the conflict and proposes ranked,
  explainable resolution options grounded in real data (separation geometry, CTR
  RODOS, NOTAMs, both flights).
- The operator **resolves by voice** ("κάνε το 2" / "do option two") → the system
  re-predicts → the conflict clears, the countdown turns green.
- The whole arc reads as one cinematic story: calm → predicted threat → AI reasons →
  voice confirm → resolved.

## The Demo Narrative ("The Reveal")

1. **Setup** — live tactical map: 3 drones, ~130 live manned aircraft, calm, green.
2. **Challenge (0:00)** — presenter engages *Foresight: +8 min*; a time slider
   appears, ghost trails stretch into the future.
3. **Reveal (0:05)** — a red conflict point pulses over Rhodes at T+6:20; "CONFLICT IN
   6:20"; the camera flies there. The audience sees something that has not happened.
4. **The Mind (0:10)** — the Air Traffic Director panel reasons live: predicted loss
   of separation 140 m at T+6:20, cause, 3 ranked options, a recommendation with
   numbers.
5. **Command (0:18)** — presenter speaks: "Κάνε το 2." The system executes.
6. **Resolution (0:22)** — the map animates the new trajectory, the ghost-conflict
   dissolves, countdown turns green: "RESOLVED — separation 310 m."
7. **Punchline** — "We didn't manage an incident. We prevented it 6 minutes early."

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Hero feature | **Foresight Mode** (predict → advise → voice-confirm → resolve) |
| Demo data | **Scripted-but-real**: a Foresight-owned in-memory scripted scenario provider (2 deterministic drones) over live ADS-B/weather background. *(The simulation engine emits only over WebSocket and never persists telemetry by flightId, so it cannot feed `telemetry.getLatest()`; a lightweight provider is deterministic and demo-safe.)* |
| Module boundary | **New `foresight/` module** (clean single purpose), persists nothing new |
| Resolution model | **Prediction-level preview** (deterministic, demo-safe); optional sim maneuver as stretch |
| Voice | **Real browser voice** (Web Speech API), with a text-submit fallback path retained |
| Map | Existing **2D Leaflet** (ghost trails + camera fly-to), no 3D |

## Architecture

```
Tactical map (Leaflet)  ──GET /foresight/predict──▶  PredictionService
  │  ▲                                                  │  gather now-state:
  │  │ timeline (frames + predicted conflicts)          │   telemetry.getLatest() per flight
  │  │                                                  │   adsb.getAircraft() (manned)
  │  │                                                  │  propagate forward (dead-reckon)
  │  │                                                  │  pairwise CPA → predicted conflicts
  │  │  ──POST /foresight/advise──▶  AirTrafficDirector ─┘   (Claude messageJson)
  │  │                                                  ▼
  │  │  ◀── ranked options + reasoning ────────────────
  │  ▼
  │ voice / click → POST /foresight/simulate-resolution (maneuver) → re-predict
  ▼
  ghost trails · pulsing conflict · countdown · camera fly-to · Director panel
```

### Backend — new `modules/foresight/`

Reuses (does not duplicate): `TelemetryService.getLatest()`, `AdsbService.getAircraft()`,
`FlightsService`, `ClaudeService`, `ConflictsService` (unchanged). Foresight owns a
small self-contained `geo` util (haversine + forward-projection) rather than reaching
into the simulation's private geometry methods.

**`PredictionService`** — the core look-ahead engine.
- Gather now-state from three sources: (a) each active flight via
  `telemetry.getLatest(flightId)` → position + velocity; (b) manned traffic via
  `adsb.getAircraft()`; (c) any active demo-scenario objects from
  `DemoScenarioService`.
- Normalize all speeds to **m/s** and altitudes to **meters** at ingest. ADS-B is
  knots + ft/min; mission waypoint speed is km/h; telemetry speed is assumed m/s and
  confirmed against a sample telemetry row during step 1 of the build sequence. The
  demo-scenario objects are authored directly in m/s and meters.
- Propagate each object forward over a horizon (default 600 s, step 5 s) by
  dead-reckoning with `PhysicsModelService.movePosition`. Straight-line v1.
- Compute pairwise **closest point of approach (CPA)** across timesteps. A predicted
  conflict = horizontal separation < 150 m **and** vertical separation < 30 m at some
  future step. Record `timeToConflictSec`, `minSeparationM`, `location {lat,lon}`,
  `altitudeM`, the two object ids/labels.
- Return a **foresight timeline**: `frames[]` (each = timestamp offset + every object's
  predicted position) plus `predictedConflicts[]`.

**`AirTrafficDirectorService`** — the reasoning layer.
- Input: a predicted conflict + context (both flights, separation geometry, nearby
  airspace e.g. CTR RODOS, active NOTAMs).
- Calls `claude.messageJson()` with a strict schema →
  `{ summary, cause, options: [{ kind: 'hold'|'altitude'|'lateral', label,
  delaySec?, altitudeDeltaM?, lateralOffsetM?, rationale, sideEffects }],
  recommendedIndex }`.
- If no `ANTHROPIC_API_KEY`: return **deterministic computed options** (e.g. hold the
  climbing flight, drop 60 m, offset 1 km) with templated rationale — the demo never
  breaks.

**Resolution (preview)** — `simulate-resolution` applies the chosen maneuver to the
prediction inputs (hold N s / altitude delta / lateral offset on the named object) and
**re-runs prediction**. The conflict clears in the recomputed timeline. This mutates
nothing permanent. *(Stretch: also apply the maneuver to the live demo-scenario object
so the demo drone visibly diverges on the map, not just in the prediction.)*

**Endpoints** (all read-only / preview; none touch real flights or write-endpoints):
- `GET /foresight/predict?horizon=600&step=5` → `{ timeline, predictedConflicts, generatedAt }`
- `POST /foresight/advise` — body `{ conflict }` → Director options + reasoning
- `POST /foresight/simulate-resolution` — body `{ maneuver }` → re-predicted timeline
- `POST /foresight/demo/start` — activate the scripted scenario provider;
  `POST /foresight/demo/reset` — clear it

**`DemoScenarioService`** — holds the active scripted scenario in memory: two drone
objects with start position / heading / speed / vertical rate chosen so their
straight-line propagation produces a predicted conflict (~140 m) near Rhodes at
~T+6 min. `start()` stamps a wall-clock activation time; `getObjects()` returns the two
objects advanced to *now* (so they actually move on the map between requests);
`reset()` clears it. No DB, no sessions.

`foresight.module.ts` imports: TelemetryModule, AdsbModule, FlightsModule, AiModule,
ConflictsModule, NotamModule, AirspaceModule.

### Frontend — Foresight layer on the tactical map

- **`foresight-overlay.tsx`** — Leaflet layer: ghost trail polylines per object, a
  playhead position at the slider time, a **pulsing red conflict marker** at the CPA
  location, and a countdown badge.
- **`foresight-controls.tsx`** — the "FORESIGHT" toggle, the time slider (now →
  +10 min), and the "Run Foresight Demo" button (`/foresight/demo/start`).
- **`air-traffic-director-panel.tsx`** — reasoning + ranked option cards (reusing the
  Copilot proposal-card visual style), each with a Confirm button.
- **Cinematic camera** — `map.flyTo()` to the conflict on reveal.
- **Voice** — `useVoiceCommand` hook (Web Speech API): listen → transcript → intent
  match ("κάνε το 2" / "do option two" / "execute") → trigger the matching option's
  resolution → re-predict → ghosts clear, countdown green. A visible mic button with a
  text fallback.
- **`foresightApi`** + types in `lib/api.ts`.

## Data Shapes (indicative)

```ts
interface ForesightObject { id: string; kind: 'drone'|'manned'; label: string;
  lat: number; lon: number; altitudeM: number; headingDeg: number; speedMps: number; }
interface ForesightFrame { tOffsetSec: number; objects: ForesightObject[]; }
interface PredictedConflict { id: string; timeToConflictSec: number; minSeparationM: number;
  location: { lat: number; lon: number }; altitudeM: number;
  primary: { id: string; label: string }; secondary: { id: string; label: string }; }
interface ResolutionManeuver { objectId: string; kind: 'hold'|'altitude'|'lateral';
  delaySec?: number; altitudeDeltaM?: number; lateralOffsetM?: number; }
```

## Guardrails / Safety

- All foresight endpoints are read-only / preview. None creates, authorizes, aborts,
  or deletes anything; none calls the real write-endpoints.
- Resolution is a prediction-level preview (+ optional sim maneuver). Zero risk of an
  accidental real action.
- Missing `ANTHROPIC_API_KEY` → deterministic computed options; the demo still works.
- Prediction compute is bounded (120 frames × N objects pairwise) and cached ~2-3 s
  like ADS-B.

## Testing / Verification

- **Unit**: CPA math (two known trajectories → correct `timeToConflictSec` and
  `minSeparationM`); unit normalization (knots / km·h⁻¹ → m/s).
- **Live**: `curl /foresight/demo/start` then `/foresight/predict` returns a predicted
  conflict with the expected location and time-to-conflict.
- **E2E (Playwright)**: start demo → toggle Foresight → ghost trails + red conflict +
  countdown visible → Director options render → confirm an option → countdown turns
  green / RESOLVED.

## Build Sequence

1. `PredictionService` (gather → normalize → propagate → CPA) + unit test.
2. `GET /foresight/predict` + the scripted demo scenario (`/foresight/demo/start`) +
   live curl test (conflict appears at the expected time/place).
3. `AirTrafficDirectorService` + `/foresight/advise` (Claude + deterministic fallback).
4. `/foresight/simulate-resolution` (maneuver → re-predict → clears).
5. Frontend foresight overlay + controls + slider + ghost trails + conflict pulse +
   camera (read-only, verify live).
6. Air Traffic Director panel + resolution confirm flow.
7. Voice command hook + intent match (with text fallback).
8. End-to-end verification (Playwright) of the full narrative arc.

## Non-Goals (v1, YAGNI)

- No 3D globe — 2D Leaflet ghost trails + camera fly-to.
- No waypoint-following propagation — dead-reckoning v1 (`flight.plannedRoute` is
  opaque JSON; not worth the risk now).
- No cascading / multi-conflict resolution — one hero conflict at a time.
- No DB persistence of predicted conflicts — live-only timeline; the `Conflict` entity
  stays for real conflicts.
- No voice NLU beyond simple intent-match.

## Future (not v1)

4D trajectory propagation from real planned routes, multi-conflict orchestration,
persisting predictions as early-warning conflicts, pushing resolutions to real flights
(not just the sim), and a 3D cinematic view.
