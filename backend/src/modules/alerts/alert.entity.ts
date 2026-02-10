import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Drone } from '../drones/drone.entity';
import { Flight } from '../flights/flight.entity';

export type AlertType =
  | 'low_battery'
  | 'signal_loss'
  | 'signal_weak'
  | 'geofence_breach'
  | 'altitude_limit'
  | 'collision_warning'
  | 'weather_warning'
  | 'system_error'
  | 'communication_lost'
  | 'gps_degraded';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

@Entity('drone_alerts')
export class DroneAlert {
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

  @Column({ name: 'alert_type' })
  alertType: AlertType;

  @Column()
  severity: AlertSeverity;

  @Column()
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  data: Record<string, unknown>;

  @Column({ default: false })
  acknowledged: boolean;

  @Column({ name: 'acknowledged_at', type: 'datetime', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
