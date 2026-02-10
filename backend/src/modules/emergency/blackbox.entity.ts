import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Flight } from '../flights/flight.entity';
import { EmergencyIncident } from './incident.entity';

@Entity('blackbox_entries')
@Index(['flightId', 'timestamp'])
@Index(['incidentId', 'timestamp'])
export class BlackboxEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'flight_id' })
  flightId: string;

  @ManyToOne(() => Flight, { nullable: true })
  @JoinColumn({ name: 'flight_id' })
  flight: Flight;

  @Column({ name: 'drone_id' })
  droneId: string;

  // Link to incident if recorded during emergency
  @Column({ name: 'incident_id', nullable: true })
  incidentId: string;

  @ManyToOne(() => EmergencyIncident, { nullable: true })
  @JoinColumn({ name: 'incident_id' })
  incident: EmergencyIncident;

  @Column({ type: 'datetime' })
  timestamp: Date;

  // Position
  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @Column({ name: 'altitude_msl', type: 'float' })
  altitudeMsl: number;

  @Column({ name: 'altitude_agl', type: 'float', nullable: true })
  altitudeAgl: number;

  // Attitude
  @Column({ type: 'float', nullable: true })
  roll: number;

  @Column({ type: 'float', nullable: true })
  pitch: number;

  @Column({ type: 'float', nullable: true })
  yaw: number;

  // Velocity
  @Column({ name: 'ground_speed', type: 'float' })
  groundSpeed: number;

  @Column({ name: 'vertical_speed', type: 'float', nullable: true })
  verticalSpeed: number;

  @Column({ type: 'float' })
  heading: number;

  // Systems
  @Column({ name: 'battery_level', type: 'float' })
  batteryLevel: number;

  @Column({ name: 'battery_voltage', type: 'float', nullable: true })
  batteryVoltage: number;

  @Column({ name: 'battery_current', type: 'float', nullable: true })
  batteryCurrent: number;

  @Column({ name: 'signal_strength', type: 'float' })
  signalStrength: number;

  @Column({ name: 'gps_satellites', type: 'int', nullable: true })
  gpsSatellites: number;

  @Column({ name: 'gps_hdop', type: 'float', nullable: true })
  gpsHdop: number;

  // Motor data (JSON array for multiple motors)
  @Column({ name: 'motor_rpm', type: 'simple-json', nullable: true })
  motorRpm: number[];

  @Column({ name: 'motor_temps', type: 'simple-json', nullable: true })
  motorTemps: number[];

  // Commands
  @Column({ name: 'command_received', nullable: true })
  commandReceived: string;

  @Column({ name: 'command_executed', nullable: true })
  commandExecuted: string;

  // Emergency state
  @Column({ name: 'emergency_active', default: false })
  emergencyActive: boolean;

  @Column({ name: 'emergency_type', nullable: true })
  emergencyType: string;

  @Column({ name: 'emergency_severity', nullable: true })
  emergencySeverity: string;

  // Flight mode
  @Column({ name: 'flight_mode', nullable: true })
  flightMode: string;

  // Additional sensor data
  @Column({ name: 'wind_speed', type: 'float', nullable: true })
  windSpeed: number;

  @Column({ name: 'wind_direction', type: 'float', nullable: true })
  windDirection: number;

  @Column({ type: 'float', nullable: true })
  temperature: number;

  @Column({ type: 'float', nullable: true })
  humidity: number;

  // Is this a high-frequency emergency recording?
  @Column({ name: 'is_emergency_recording', default: false })
  isEmergencyRecording: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
