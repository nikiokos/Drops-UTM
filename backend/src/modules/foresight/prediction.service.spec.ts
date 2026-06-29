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
