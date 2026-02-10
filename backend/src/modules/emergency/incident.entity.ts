import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Drone } from '../drones/drone.entity';
import { Flight } from '../flights/flight.entity';

export type EmergencyType =
  | 'battery_low'
  | 'battery_critical'
  | 'battery_rapid_discharge'
  | 'signal_weak'
  | 'signal_lost'
  | 'geofence_warning'
  | 'geofence_breach'
  | 'collision_aircraft'
  | 'collision_obstacle'
  | 'weather_wind'
  | 'weather_visibility'
  | 'motor_anomaly'
  | 'motor_failure'
  | 'gps_degraded'
  | 'gps_lost';

export type EmergencySeverity = 'warning' | 'critical' | 'emergency';

export type IncidentStatus = 'active' | 'pending_confirmation' | 'executing' | 'resolved' | 'escalated';

export type ResponseAction = 'RTH' | 'LAND' | 'HOVER' | 'DIVERT' | 'DESCEND' | 'CLIMB' | 'ESTOP' | 'NONE';

export type RootCause = 'equipment' | 'weather' | 'pilot_error' | 'software' | 'external' | 'unknown';

@Entity('emergency_incidents')
export class EmergencyIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'drone_id' })
  droneId: string;

  @ManyToOne(() => Drone, { nullable: true })
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ name: 'flight_id', nullable: true })
  flightId: string;

  @ManyToOne(() => Flight, { nullable: true })
  @JoinColumn({ name: 'flight_id' })
  flight: Flight;

  @Column({ name: 'emergency_type' })
  emergencyType: EmergencyType;

  @Column()
  severity: EmergencySeverity;

  @Column({ default: 'active' })
  status: IncidentStatus;

  @Column()
  message: string;

  @Column({ name: 'detection_data', type: 'simple-json', nullable: true })
  detectionData: Record<string, unknown>;

  // Position at time of detection
  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @Column({ type: 'float', nullable: true })
  altitude: number;

  // Response details
  @Column({ name: 'response_action', nullable: true })
  responseAction: ResponseAction;

  @Column({ name: 'was_auto_executed', default: false })
  wasAutoExecuted: boolean;

  @Column({ name: 'confirmation_required', default: false })
  confirmationRequired: boolean;

  @Column({ name: 'confirmed_by', nullable: true })
  confirmedBy: string;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt: Date;

  @Column({ name: 'confirmation_timeout_at', type: 'datetime', nullable: true })
  confirmationTimeoutAt: Date;

  // Execution details
  @Column({ name: 'action_started_at', type: 'datetime', nullable: true })
  actionStartedAt: Date;

  @Column({ name: 'action_completed_at', type: 'datetime', nullable: true })
  actionCompletedAt: Date;

  @Column({ name: 'action_success', nullable: true })
  actionSuccess: boolean;

  @Column({ name: 'action_error', nullable: true })
  actionError: string;

  // Resolution
  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  // Investigation
  @Column({ name: 'root_cause', nullable: true })
  rootCause: RootCause;

  @Column({ name: 'root_cause_notes', type: 'text', nullable: true })
  rootCauseNotes: string;

  @Column({ name: 'lessons_learned', type: 'text', nullable: true })
  lessonsLearned: string;

  // Timeline data (JSON array of events)
  @Column({ type: 'simple-json', nullable: true })
  timeline: Array<{
    timestamp: string;
    event: string;
    data?: Record<string, unknown>;
  }>;

  @Column({ name: 'detected_at', type: 'datetime' })
  detectedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
