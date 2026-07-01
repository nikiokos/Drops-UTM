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
