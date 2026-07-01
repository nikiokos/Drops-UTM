import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import type { DirectorAdvice, DirectorOption, PredictedConflict } from './foresight.types';

// Anthropic structured-output (output_config.format) requires every object schema
// to set additionalProperties:false explicitly, else the API returns HTTP 400 and
// the Director silently falls back to deterministic options.
const ADVICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'cause', 'options', 'recommendedIndex'],
  properties: {
    summary: { type: 'string' },
    cause: { type: 'string' },
    recommendedIndex: { type: 'integer' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'label', 'objectId', 'rationale', 'sideEffects'],
        properties: {
          kind: { type: 'string', enum: ['hold', 'altitude', 'lateral'] },
          label: { type: 'string' },
          objectId: { type: 'string' },
          delaySec: { type: 'number' },
          altitudeDeltaM: { type: 'number' },
          lateralOffsetM: { type: 'number' },
          rationale: { type: 'string' },
          sideEffects: { type: 'string' },
        },
      },
    },
  },
};

@Injectable()
export class AirTrafficDirectorService {
  constructor(private readonly claude: ClaudeService) {}

  async advise(conflict: PredictedConflict): Promise<DirectorAdvice> {
    // Guard against a malformed/missing conflict body so the endpoint returns a
    // clean response instead of dereferencing undefined geometry and 500-ing.
    if (!conflict || !conflict.location || conflict.primary == null || conflict.secondary == null) {
      return {
        summary: 'No valid predicted conflict was provided.',
        cause: 'The request did not include a conflict to assess.',
        options: [],
        recommendedIndex: 0,
        source: 'deterministic',
      };
    }
    if (this.claude.hasKey()) {
      const ai = await this.claude.messageJson<Omit<DirectorAdvice, 'source'>>({
        system:
          'You are the Air Traffic Director for a drone UTM system. Given a predicted ' +
          'conflict, propose exactly 3 ranked, concrete resolution options (hold / altitude / ' +
          'lateral), each grounded in the geometry, with a short rationale citing the numbers ' +
          'and a one-line side effect. Recommend the option with least operational impact. ' +
          'CRITICAL: this system flags a conflict whenever horizontal separation is below ' +
          '150 m AND vertical separation is below 30 m at the closest point of approach. Every ' +
          'option you propose MUST fully clear the conflict with margin. Sizing guide: altitude ' +
          'maneuvers need at least a 40 m change; hold maneuvers at least 120 s; lateral ' +
          'offsets at least 300 m (the drones stay on converging headings, so part of a lateral ' +
          'offset is eaten back before the closest point of approach). Do not propose a maneuver ' +
          'that only partially reduces the separation; size each so the conflict is resolved.',
        user: this.prompt(conflict),
        schema: ADVICE_SCHEMA,
        model: ClaudeService.SONNET,
        maxTokens: 1200,
      });
      if (ai && Array.isArray(ai.options) && ai.options.length > 0) {
        // Clamp the AI's recommendedIndex into range — an out-of-range value would
        // silently break the voice "do it" path (which selects options[recommendedIndex]).
        const recommendedIndex = Math.min(
          Math.max(0, Math.floor(ai.recommendedIndex ?? 0)),
          ai.options.length - 1,
        );
        return { ...ai, recommendedIndex, source: 'ai' };
      }
    }
    return this.deterministic(conflict);
  }

  private prompt(c: PredictedConflict): string {
    const mins = Math.floor(c.timeToConflictSec / 60);
    const secs = c.timeToConflictSec % 60;
    return [
      `Predicted conflict between ${c.primary.label} and ${c.secondary.label}.`,
      `Time to conflict: ${mins}:${String(secs).padStart(2, '0')} (${c.timeToConflictSec}s).`,
      `Minimum predicted separation: ${c.minSeparationM} m.`,
      `Location: lat ${c.location.lat.toFixed(4)}, lon ${c.location.lon.toFixed(4)}, ~${c.altitudeM} m altitude (near Rhodes / LGRP).`,
      `objectId for ${c.primary.label} is "${c.primary.id}", for ${c.secondary.label} is "${c.secondary.id}".`,
      'Conflict thresholds: horizontal < 150 m AND vertical < 30 m. Size each maneuver to',
      'clear with margin: altitude ≥ 40 m change, hold ≥ 120 s, lateral ≥ 300 m offset.',
      'A 25 m altitude change or a small (<300 m) offset is NOT enough.',
      'Propose 3 options; set objectId to the drone the maneuver applies to.',
    ].join('\n');
  }

  /** Computed options used when the AI is unavailable — the demo never breaks. */
  private deterministic(c: PredictedConflict): DirectorAdvice {
    const options: DirectorOption[] = [
      {
        kind: 'hold',
        label: `Hold ${c.secondary.label} for 90s`,
        delaySec: 90,
        objectId: c.secondary.id,
        rationale: `Delaying ${c.secondary.label} 90s lets ${c.primary.label} clear the crossing point first.`,
        sideEffects: '90s added to the held flight.',
      },
      {
        kind: 'altitude',
        label: `Descend ${c.primary.label} by 60m`,
        altitudeDeltaM: -60,
        objectId: c.primary.id,
        rationale: `A 60m descent restores >30m vertical separation at the crossing (predicted ${c.minSeparationM}m horizontal).`,
        sideEffects: 'Minimal delay; stays clear of CTR RODOS.',
      },
      {
        kind: 'lateral',
        label: `Offset ${c.secondary.label} 1km laterally`,
        lateralOffsetM: 1000,
        objectId: c.secondary.id,
        rationale: `A 1km lateral offset opens horizontal separation well beyond 150m.`,
        sideEffects: 'Slightly longer route.',
      },
    ];
    return {
      summary: `Predicted loss of separation (${c.minSeparationM}m) between ${c.primary.label} and ${c.secondary.label} in ${c.timeToConflictSec}s.`,
      cause: `${c.secondary.label} converging with ${c.primary.label} near the crossing point.`,
      options,
      recommendedIndex: 1,
      source: 'deterministic',
    };
  }
}
