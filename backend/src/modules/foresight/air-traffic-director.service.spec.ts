import { AirTrafficDirectorService } from './air-traffic-director.service';
import { ClaudeService } from '../ai/claude.service';
import type { PredictedConflict } from './foresight.types';

const conflict: PredictedConflict = {
  id: 'pc-1',
  timeToConflictSec: 380,
  minSeparationM: 140,
  location: { lat: 36.4, lon: 28.08 },
  altitudeM: 120,
  primary: { id: 'demo:DRN-FORESIGHT-1', label: 'DRN-FORESIGHT-1' },
  secondary: { id: 'demo:DRN-FORESIGHT-2', label: 'DRN-FORESIGHT-2' },
};

describe('AirTrafficDirectorService', () => {
  it('returns deterministic options when no API key is configured', async () => {
    const claude = { hasKey: () => false, messageJson: jest.fn() } as unknown as ClaudeService;
    const svc = new AirTrafficDirectorService(claude);
    const advice = await svc.advise(conflict);
    expect(advice.source).toBe('deterministic');
    expect(advice.options.length).toBe(3);
    expect(advice.recommendedIndex).toBeGreaterThanOrEqual(0);
    expect(advice.recommendedIndex).toBeLessThan(advice.options.length);
    expect(claude.messageJson).not.toHaveBeenCalled();
  });

  it('falls back to deterministic options when the AI call returns null', async () => {
    const claude = { hasKey: () => true, messageJson: jest.fn().mockResolvedValue(null) } as unknown as ClaudeService;
    const svc = new AirTrafficDirectorService(claude);
    const advice = await svc.advise(conflict);
    expect(advice.source).toBe('deterministic');
    expect(advice.options.length).toBe(3);
  });

  it('uses the AI advice when the AI call succeeds', async () => {
    const aiAdvice = {
      summary: 'Predicted loss of separation in 6:20.',
      cause: 'DRN-FORESIGHT-2 climbing into the corridor.',
      options: [
        { kind: 'altitude', label: 'Descend DRN-FORESIGHT-1 by 60m', altitudeDeltaM: -60, objectId: 'demo:DRN-FORESIGHT-1', rationale: 'Minimal delay.', sideEffects: 'None.' },
      ],
      recommendedIndex: 0,
    };
    const claude = { hasKey: () => true, messageJson: jest.fn().mockResolvedValue(aiAdvice) } as unknown as ClaudeService;
    const svc = new AirTrafficDirectorService(claude);
    const advice = await svc.advise(conflict);
    expect(advice.source).toBe('ai');
    expect(advice.summary).toContain('6:20');
    expect(advice.options[0].altitudeDeltaM).toBe(-60);
  });

  it('sends a schema with additionalProperties:false on every object (Anthropic requirement)', async () => {
    const messageJson = jest.fn().mockResolvedValue(null);
    const claude = { hasKey: () => true, messageJson } as unknown as ClaudeService;
    await new AirTrafficDirectorService(claude).advise(conflict);
    const schema = messageJson.mock.calls[0][0].schema;
    // The Anthropic structured-output API rejects object schemas that omit this,
    // which silently forces the deterministic fallback.
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.options.items.additionalProperties).toBe(false);
  });

  it('clamps an out-of-range AI recommendedIndex into the options range', async () => {
    const aiAdvice = {
      summary: 's', cause: 'c', recommendedIndex: 7, // out of range
      options: [
        { kind: 'hold', label: 'a', objectId: 'x', rationale: 'r', sideEffects: 'e' },
        { kind: 'altitude', label: 'b', objectId: 'y', rationale: 'r', sideEffects: 'e' },
      ],
    };
    const claude = { hasKey: () => true, messageJson: jest.fn().mockResolvedValue(aiAdvice) } as unknown as ClaudeService;
    const advice = await new AirTrafficDirectorService(claude).advise(conflict);
    expect(advice.source).toBe('ai');
    expect(advice.recommendedIndex).toBe(1); // clamped to options.length - 1
  });

  it('returns an empty deterministic advice (no throw) for a malformed conflict', async () => {
    const claude = { hasKey: () => true, messageJson: jest.fn() } as unknown as ClaudeService;
    const advice = await new AirTrafficDirectorService(claude).advise({} as never);
    expect(advice.source).toBe('deterministic');
    expect(advice.options).toEqual([]);
    expect(claude.messageJson).not.toHaveBeenCalled();
  });
});
