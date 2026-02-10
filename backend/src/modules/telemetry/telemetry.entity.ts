import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('flight_telemetry')
export class FlightTelemetry {
  @PrimaryColumn({ type: 'datetime' })
  time: Date;

  @PrimaryColumn({ name: 'flight_id' })
  flightId: string;

  @Column({ name: 'drone_id' })
  droneId: string;

  @Column({ type: 'real' })
  latitude: number;

  @Column({ type: 'real' })
  longitude: number;

  @Column({ name: 'altitude_msl', type: 'real' })
  altitudeMsl: number;

  @Column({ name: 'altitude_agl', type: 'real', nullable: true })
  altitudeAgl: number;

  @Column({ name: 'ground_speed', type: 'real', nullable: true })
  groundSpeed: number;

  @Column({ name: 'vertical_speed', type: 'real', nullable: true })
  verticalSpeed: number;

  @Column({ type: 'real', nullable: true })
  heading: number;

  @Column({ type: 'real', nullable: true })
  roll: number;

  @Column({ type: 'real', nullable: true })
  pitch: number;

  @Column({ type: 'real', nullable: true })
  yaw: number;

  @Column({ name: 'battery_level', type: 'real', nullable: true })
  batteryLevel: number;

  @Column({ name: 'signal_strength', nullable: true })
  signalStrength: number;

  @Column({ name: 'gps_satellites', nullable: true })
  gpsSatellites: number;

  @Column({ name: 'flight_mode', nullable: true })
  flightMode: string;

  @Column({ name: 'system_status', nullable: true })
  systemStatus: string;

  @Column({ type: 'simple-json', nullable: true })
  warnings: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  errors: Record<string, unknown>;
}
