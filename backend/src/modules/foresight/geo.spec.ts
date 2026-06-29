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
