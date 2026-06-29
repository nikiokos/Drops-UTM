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
    // Perpendicular crossing geometry: A heads east (90°), B heads north (0°).
    // They are positioned to arrive at crossing point ~(36.40, 28.10) at nearly the same time
    // (~133-134 s), so without a hold they conflict.
    //
    // A: (36.40, 28.07) → east at 20 m/s → ~2677 m to crossing → arrives ~134 s
    // B: (36.376, 28.10) → north at 20 m/s → ~2664 m to crossing → arrives ~133 s
    //
    // Hold A for 120 s → A crosses at ~254 s; by then B is ~2420 m north → no conflict.
    const crossing: ForesightObject[] = [
      { id: 'a', kind: 'demo', label: 'A', lat: 36.40, lon: 28.07, altitudeM: 120, headingDeg: 90, speedMps: 20, verticalSpeedMps: 0 },
      { id: 'b', kind: 'demo', label: 'B', lat: 36.376, lon: 28.10, altitudeM: 120, headingDeg: 0, speedMps: 20, verticalSpeedMps: 0 },
    ];

    // 1) Without hold: conflict must exist (proves the geometry is set up correctly).
    const unmanoeuvred = svc.predictFromObjects(crossing, { horizonSec: 600, stepSec: 5 });
    expect(unmanoeuvred.predictedConflicts.length).toBeGreaterThanOrEqual(1);

    // 2) With a 120 s hold on A: A resumes from its frozen position after B has cleared
    //    the crossing → no conflict within the horizon.
    const held = svc.predictFromObjects(crossing, { horizonSec: 600, stepSec: 5 }, [
      { objectId: 'a', kind: 'hold', delaySec: 120 },
    ]);
    const c = held.predictedConflicts[0];
    expect(c === undefined || c.minSeparationM >= 150).toBe(true);
  });
});
