export interface TelemetryPoint {
  time: Date;
  flightId: string;
  droneId: string;
  latitude: number;
  longitude: number;
  altitudeMsl: number;
  altitudeAgl?: number;
  groundSpeed?: number;
  verticalSpeed?: number;
  heading?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  batteryLevel?: number;
  signalStrength?: number;
  gpsSatellites?: number;
  flightMode?: string;
  systemStatus?: string;
  warnings?: Record<string, unknown>;
  errors?: Record<string, unknown>;
}
