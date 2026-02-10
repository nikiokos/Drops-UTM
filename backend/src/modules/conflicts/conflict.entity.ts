import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Flight } from '../flights/flight.entity';
import { Hub } from '../hubs/hub.entity';

@Entity('conflicts')
export class Conflict {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conflict_type' })
  conflictType: string;

  @Column()
  severity: string;

  @Column({ default: 'detected' })
  status: string;

  @Column({ name: 'primary_flight_id', nullable: true })
  primaryFlightId: string;

  @ManyToOne(() => Flight, { nullable: true })
  @JoinColumn({ name: 'primary_flight_id' })
  primaryFlight: Flight;

  @Column({ name: 'secondary_flight_id', nullable: true })
  secondaryFlightId: string;

  @ManyToOne(() => Flight, { nullable: true })
  @JoinColumn({ name: 'secondary_flight_id' })
  secondaryFlight: Flight;

  @Column({ name: 'hub_id', nullable: true })
  hubId: string;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  @Column({ name: 'detected_at', default: () => "datetime('now')" })
  detectedAt: Date;

  @Column({ name: 'detection_method', nullable: true })
  detectionMethod: string;

  @Column({ type: 'simple-json', nullable: true })
  location: { latitude: number; longitude: number };

  @Column({ type: 'real', nullable: true })
  altitude: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'separation_distance',
    type: 'real',
    nullable: true,
  })
  separationDistance: number;

  @Column({ name: 'resolution_strategy', nullable: true })
  resolutionStrategy: string;

  @Column({ name: 'resolution_actions', type: 'simple-json', nullable: true })
  resolutionActions: Record<string, unknown>;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @Column({ type: 'simple-json', nullable: true })
  data: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
