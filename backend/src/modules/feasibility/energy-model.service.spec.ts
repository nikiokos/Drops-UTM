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
    const r = svc.evaluate(strong, { distanceM: 70000, hoverTimeS: 0, payloadKg: 5 }, noWind);
    expect(r.verdict === 'NO_GO' || r.verdict === 'MARGINAL').toBe(true);
    expect(r.solutions.some((s) => s.kind === 'reduce_payload')).toBe(true);
  });
});
