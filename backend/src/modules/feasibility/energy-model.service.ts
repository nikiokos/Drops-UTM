import { Injectable } from '@nestjs/common';
import { FEASIBILITY_CONFIG as CFG } from './feasibility.config';
import type {
  DroneSpec,
  MissionProfile,
  EnvConditions,
  EnergyResult,
  Solution,
  Verdict,
} from './feasibility.types';

@Injectable()
export class EnergyModelService {
  /** Pure energy evaluation: available vs. required Wh → verdict + solutions. */
  evaluate(spec: DroneSpec, mission: MissionProfile, env: EnvConditions): EnergyResult {
    const hoverPowerW = spec.hoverPowerW ?? CFG.defaultHoverPowerW;
    const cruisePowerW = spec.cruisePowerW ?? CFG.defaultCruisePowerW;
    const cruiseSpeedMs = spec.cruiseSpeedMs ?? CFG.defaultCruiseSpeedMs;
    const healthPct = spec.batteryHealthPct ?? CFG.defaultBatteryHealthPct;

    const confidence: 'HIGH' | 'LOW' =
      spec.batteryCapacityWh != null &&
      spec.hoverPowerW != null &&
      spec.cruisePowerW != null &&
      spec.cruiseSpeedMs != null
        ? 'HIGH'
        : 'LOW';

    // Available energy (Wh). Legacy fallback: hover the rated flight time.
    let capacityWh = spec.batteryCapacityWh ?? null;
    if (capacityWh == null) {
      const tMin = spec.maxFlightTimeMin ?? CFG.defaultMaxFlightTimeMin;
      capacityWh = (tMin / 60) * hoverPowerW;
    }
    const usableWh = capacityWh * (healthPct / 100) * (1 - CFG.reserveFraction);

    // Required energy (Wh).
    const cruiseTimeS = cruiseSpeedMs > 0 ? mission.distanceM / cruiseSpeedMs : 0;
    const cruiseWh = (cruiseTimeS * cruisePowerW) / 3600;
    const hoverWh = (mission.hoverTimeS * hoverPowerW) / 3600;
    const climbWh = CFG.climbSurcharge * cruiseWh;

    const maxPayloadKg = spec.maxPayloadKg ?? 0;
    const payloadFactor =
      mission.payloadKg > 0 && maxPayloadKg > 0
        ? 1 + CFG.kPayload * (mission.payloadKg / maxPayloadKg)
        : 1;

    const windSpeedMs = env.windSpeedMs ?? 0;
    const windTolMs = spec.windToleranceMs ?? null;
    const windExceeded = windTolMs != null && windSpeedMs > windTolMs;
    const windFactor = windTolMs != null ? 1 + CFG.kWind * (windSpeedMs / windTolMs) : 1;

    const requiredWh = (cruiseWh + hoverWh + climbWh) * payloadFactor * windFactor;

    const marginPct = usableWh > 0 ? ((usableWh - requiredWh) / usableWh) * 100 : -100;

    let verdict: Verdict =
      marginPct >= CFG.goThresholdPct ? 'GO' : marginPct >= 0 ? 'MARGINAL' : 'NO_GO';
    if (windExceeded) verdict = 'NO_GO';

    const solutions =
      verdict === 'GO'
        ? []
        : this.buildSolutions({
            usableWh,
            baseWh: cruiseWh + hoverWh + climbWh,
            windFactor,
            payloadFactor,
            payloadKg: mission.payloadKg,
            maxPayloadKg,
            windExceeded,
            windTolMs,
          });

    return {
      verdict,
      marginPct: Math.round(marginPct * 10) / 10,
      usableWh,
      requiredWh,
      breakdown: {
        cruiseWh: Math.round(cruiseWh * 10) / 10,
        hoverWh: Math.round(hoverWh * 10) / 10,
        climbWh: Math.round(climbWh * 10) / 10,
        payloadFactor: Math.round(payloadFactor * 100) / 100,
        windFactor: Math.round(windFactor * 100) / 100,
      },
      confidence,
      windExceeded,
      solutions,
    };
  }

  /** Deterministic mitigations for a MARGINAL/NO_GO result. */
  private buildSolutions(x: {
    usableWh: number;
    baseWh: number;
    windFactor: number;
    payloadFactor: number;
    payloadKg: number;
    maxPayloadKg: number;
    windExceeded: boolean;
    windTolMs: number | null;
  }): Solution[] {
    const out: Solution[] = [];

    if (x.windExceeded && x.windTolMs != null) {
      out.push({
        kind: 'await_wind',
        label: `Wait for wind below ${x.windTolMs} m/s`,
        detail: `Current wind exceeds the drone's ${x.windTolMs} m/s tolerance.`,
      });
    }

    // Reduce payload so that required energy hits the GO margin.
    if (x.payloadKg > 0 && x.maxPayloadKg > 0) {
      const targetRequired = x.usableWh * (1 - CFG.goThresholdPct / 100);
      const targetPayloadFactor = targetRequired / (x.baseWh * x.windFactor);
      const targetPayloadKg = ((targetPayloadFactor - 1) / CFG.kPayload) * x.maxPayloadKg;
      if (targetPayloadKg >= 0 && targetPayloadKg < x.payloadKg) {
        const drop = Math.ceil((x.payloadKg - targetPayloadKg) * 10) / 10;
        out.push({
          kind: 'reduce_payload',
          label: `Reduce payload by ~${drop} kg`,
          detail: `Lowering payload to ~${Math.round(targetPayloadKg * 10) / 10} kg brings the mission within a safe margin.`,
        });
      }
    }

    out.push({
      kind: 'charging_stop',
      label: 'Add a charging stop',
      detail: 'Split the mission with a recharge to stay within a single-charge range.',
    });
    out.push({
      kind: 'other_drone',
      label: 'Use another drone',
      detail: 'Assign a drone with a larger battery or lower power draw.',
    });

    return out;
  }
}
