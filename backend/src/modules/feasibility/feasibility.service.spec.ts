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

  it('supports an inline profile (no missionId) for one-shot mission creation', async () => {
    const missionsFindById = jest.fn();
    const weatherGetGoNoGo = jest.fn().mockResolvedValue({ wind: { speedMs: 2 } });
    const drones = { findById: jest.fn().mockResolvedValue(drone) } as never;
    const missions = { findById: missionsFindById } as never;
    const weather = { getGoNoGo: weatherGetGoNoGo } as never;
    const claude = { hasKey: () => false, messageJson: jest.fn() } as never;
    const svc = new FeasibilityService(energy, drones, missions, weather, claude);

    const r = await svc.check({ droneId: 'd1', distanceM: 10000, hoverTimeS: 60, departureHubId: 'h1' });

    expect(missionsFindById).not.toHaveBeenCalled(); // inline path — no mission lookup
    expect(weatherGetGoNoGo).toHaveBeenCalledWith('h1'); // wind from the given hub
    expect(['GO', 'MARGINAL', 'NO_GO']).toContain(r.verdict);
    expect(r.requiredWh).toBeGreaterThan(0);
  });
});
