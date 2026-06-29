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
