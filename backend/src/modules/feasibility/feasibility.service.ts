import { Injectable, Logger } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import { DronesService } from '../drones/drones.service';
import { MissionsService } from '../missions/missions.service';
import { WeatherService } from '../weather/weather.service';
import { EnergyModelService } from './energy-model.service';
import type {
  DroneSpec,
  MissionProfile,
  EnergyResult,
  FeasibilityResult,
} from './feasibility.types';

const EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation'],
  properties: { explanation: { type: 'string' } },
};

@Injectable()
export class FeasibilityService {
  private readonly logger = new Logger(FeasibilityService.name);

  constructor(
    private readonly energy: EnergyModelService,
    private readonly drones: DronesService,
    private readonly missions: MissionsService,
    private readonly weather: WeatherService,
    private readonly claude: ClaudeService,
  ) {}

  async check(input: {
    droneId: string;
    // Either reference a saved mission…
    missionId?: string;
    // …or pass an inline profile (used during one-shot mission creation, before the
    // mission is persisted). departureHubId lets the inline path still fetch live wind.
    distanceM?: number;
    hoverTimeS?: number;
    departureHubId?: string;
    payloadKg?: number;
  }): Promise<FeasibilityResult> {
    const drone = await this.drones.findById(input.droneId);

    const spec: DroneSpec = {
      batteryCapacityWh: drone.batteryCapacityWh ?? null,
      hoverPowerW: drone.hoverPowerW ?? null,
      cruisePowerW: drone.cruisePowerW ?? null,
      cruiseSpeedMs: drone.cruiseSpeedMs ?? null,
      batteryHealthPct: drone.batteryHealthPct ?? null,
      windToleranceMs: drone.windToleranceMs ?? null,
      maxPayloadKg: drone.maxPayload ?? null,
      maxFlightTimeMin: drone.maxFlightTime ?? null,
    };

    // Build the mission profile from a saved mission, or from inline params.
    let profile: MissionProfile;
    let hubForWind: string | undefined;
    if (input.missionId) {
      const mission = await this.missions.findById(input.missionId);
      const waypoints = (mission.waypoints ?? []) as Array<{ hoverDuration?: number | null }>;
      const hoverTimeS = waypoints.reduce((sum, w) => sum + (w.hoverDuration ?? 0), 0);
      profile = {
        distanceM: mission.estimatedDistance ?? 0,
        hoverTimeS,
        payloadKg: input.payloadKg ?? 0,
      };
      hubForWind = mission.departureHubId;
    } else {
      profile = {
        distanceM: input.distanceM ?? 0,
        hoverTimeS: input.hoverTimeS ?? 0,
        payloadKg: input.payloadKg ?? 0,
      };
      hubForWind = input.departureHubId;
    }

    // Live wind from the departure hub (best-effort).
    let windSpeedMs: number | null = null;
    try {
      if (hubForWind) {
        const w = await this.weather.getGoNoGo(hubForWind);
        windSpeedMs = w?.wind?.speedMs ?? null;
      }
    } catch {
      windSpeedMs = null;
    }

    const result: EnergyResult = this.energy.evaluate(spec, profile, { windSpeedMs });

    const explanation = await this.explain(result, drone, profile, windSpeedMs);

    return {
      ...result,
      windUsed: windSpeedMs != null ? { speedMs: windSpeedMs, source: 'METAR' } : null,
      explanation: explanation.text,
      explanationSource: explanation.source,
    };
  }

  private async explain(
    result: EnergyResult,
    drone: { registrationNumber?: string; model?: string },
    profile: MissionProfile,
    windSpeedMs: number | null,
  ): Promise<{ text: string; source: 'ai' | 'deterministic' }> {
    if (this.claude.hasKey()) {
      try {
        const ai = await this.claude.messageJson<{ explanation: string }>({
          system:
            'You are a drone fleet dispatcher. In 1-2 sentences, plainly explain the ' +
            'mission-feasibility verdict to an operator, citing the energy margin and the ' +
            'main driver (distance, payload, wind, or battery health). If not GO, point at ' +
            'the top recommended fix. Be concise and concrete.',
          user: [
            `Drone ${drone.registrationNumber ?? ''} (${drone.model ?? 'unknown model'}).`,
            `Verdict: ${result.verdict}. Margin: ${result.marginPct}%.`,
            `Usable: ${result.usableWh} Wh, required: ${result.requiredWh} Wh.`,
            `Breakdown: cruise ${result.breakdown.cruiseWh} Wh, hover ${result.breakdown.hoverWh} Wh, climb ${result.breakdown.climbWh} Wh, payloadFactor ${result.breakdown.payloadFactor}, windFactor ${result.breakdown.windFactor}.`,
            `Payload ${profile.payloadKg} kg, wind ${windSpeedMs ?? 'n/a'} m/s, confidence ${result.confidence}.`,
            `Solutions: ${result.solutions.map((s) => s.label).join('; ') || 'none'}.`,
          ].join('\n'),
          schema: EXPLANATION_SCHEMA,
          model: ClaudeService.SONNET,
          maxTokens: 400,
        });
        if (ai && typeof ai.explanation === 'string' && ai.explanation.trim()) {
          return { text: ai.explanation.trim(), source: 'ai' };
        }
      } catch (e) {
        this.logger.warn(`Feasibility explanation failed: ${(e as Error).message}`);
      }
    }
    return { text: this.deterministicExplanation(result), source: 'deterministic' };
  }

  private deterministicExplanation(result: EnergyResult): string {
    const conf = result.confidence === 'LOW' ? ' (low-confidence estimate — add the drone\'s energy specs)' : '';
    if (result.verdict === 'GO') {
      return `Feasible on one charge with ${result.marginPct}% energy reserve${conf}.`;
    }
    if (result.verdict === 'MARGINAL') {
      return `Marginal: only ${result.marginPct}% reserve${conf}. Consider: ${result.solutions[0]?.label ?? 'reducing load'}.`;
    }
    return `Not feasible on one charge (short by ${Math.abs(result.marginPct)}% of usable energy)${conf}. Best fix: ${result.solutions[0]?.label ?? 'use another drone'}.`;
  }
}
