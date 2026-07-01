/** Tunable feasibility constants. Adjust here to retune the energy model. */
export const FEASIBILITY_CONFIG = {
  reserveFraction: 0.2, // safety reserve kept unused
  goThresholdPct: 15, // margin at/above which the verdict is GO
  kPayload: 0.5, // payload energy slope (per full payload)
  kWind: 0.4, // wind energy slope (per full wind tolerance)
  climbSurcharge: 0.15, // climb energy as a fraction of cruise energy
  defaultHoverPowerW: 250,
  defaultCruisePowerW: 200,
  defaultCruiseSpeedMs: 12,
  defaultBatteryHealthPct: 100,
  defaultMaxFlightTimeMin: 20,
};
