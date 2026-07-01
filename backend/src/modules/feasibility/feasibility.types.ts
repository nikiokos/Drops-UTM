/** A drone's energy/performance inputs (subset of the Drone entity + fallbacks). */
export interface DroneSpec {
  batteryCapacityWh?: number | null;
  hoverPowerW?: number | null;
  cruisePowerW?: number | null;
  cruiseSpeedMs?: number | null;
  batteryHealthPct?: number | null;
  windToleranceMs?: number | null;
  maxPayloadKg?: number | null;
  maxFlightTimeMin?: number | null;
}

/** The mission reduced to energy-relevant segments. */
export interface MissionProfile {
  distanceM: number;
  hoverTimeS: number;
  payloadKg: number;
}

export interface EnvConditions {
  windSpeedMs: number | null;
}

export type Verdict = 'GO' | 'MARGINAL' | 'NO_GO';

export interface Solution {
  kind: 'reduce_payload' | 'charging_stop' | 'other_drone' | 'await_wind';
  label: string;
  detail: string;
}

export interface EnergyResult {
  verdict: Verdict;
  marginPct: number;
  usableWh: number;
  requiredWh: number;
  breakdown: {
    cruiseWh: number;
    hoverWh: number;
    climbWh: number;
    payloadFactor: number;
    windFactor: number;
  };
  confidence: 'HIGH' | 'LOW';
  windExceeded: boolean;
  solutions: Solution[];
}

/** The full API result: the energy result plus the narrated explanation. */
export interface FeasibilityResult extends EnergyResult {
  windUsed: { speedMs: number; source: string } | null;
  explanation: string;
  explanationSource: 'ai' | 'deterministic';
}
