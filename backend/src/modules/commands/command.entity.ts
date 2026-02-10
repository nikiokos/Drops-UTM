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

export type CommandType =
  | 'takeoff'
  | 'land'
  | 'rtl'
  | 'emergency_stop'
  | 'pause'
  | 'hover'
  | 'resume';

export type CommandStatus =
  | 'pending'
  | 'sent'
  | 'acknowledged'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

@Entity('drone_commands')
export class DroneCommand {
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

  @Column({ name: 'command_type' })
  commandType: CommandType;

  @Column({ type: 'simple-json', nullable: true })
  parameters: Record<string, unknown>;

  @Column({ default: 'pending' })
  status: CommandStatus;

  @Column({ name: 'issued_by' })
  issuedBy: string;

  @Column({ name: 'issued_at', type: 'datetime' })
  issuedAt: Date;

  @Column({ name: 'acknowledged_at', type: 'datetime', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ default: 2 })
  priority: number;

  @Column({ name: 'timeout_ms', default: 2000 })
  timeoutMs: number;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 2 })
  maxRetries: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
