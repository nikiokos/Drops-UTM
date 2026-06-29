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
