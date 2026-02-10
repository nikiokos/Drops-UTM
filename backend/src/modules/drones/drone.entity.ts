import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Hub } from '../hubs/hub.entity';

@Entity('drones')
export class Drone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'registration_number', unique: true })
  registrationNumber: string;

  @Column()
  manufacturer: string;

  @Column()
  model: string;

  @Column({ name: 'serial_number', nullable: true })
  serialNumber: string;

  @Column({ name: 'owner_id', nullable: true })
  ownerId: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: Organization;

  @Column({ name: 'home_hub_id', nullable: true })
  homeHubId: string;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'home_hub_id' })
  homeHub: Hub;

  @Column({ name: 'current_hub_id', nullable: true })
  currentHubId: string;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'current_hub_id' })
  currentHub: Hub;

  @Column({ default: 'available' })
  status: string;

  @Column({ name: 'max_flight_time', nullable: true })
  maxFlightTime: number;

  @Column({ name: 'max_range', nullable: true })
  maxRange: number;

  @Column({ name: 'max_altitude', nullable: true })
  maxAltitude: number;

  @Column({ name: 'max_speed', type: 'real', nullable: true })
  maxSpeed: number;

  @Column({ name: 'max_payload', type: 'real', nullable: true })
  maxPayload: number;

  @Column({ name: 'communication_protocol', nullable: true })
  communicationProtocol: string;

  @Column({ name: 'remote_id', nullable: true })
  remoteId: string;

  @Column({ type: 'simple-json', nullable: true })
  capabilities: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  specifications: Record<string, unknown>;

  @Column({ name: 'telemetry_config', type: 'simple-json', nullable: true })
  telemetryConfig: Record<string, unknown>;

  @Column({ name: 'last_maintenance', nullable: true })
  lastMaintenance: Date;

  @Column({ name: 'next_maintenance', nullable: true })
  nextMaintenance: Date;

  @Column({ name: 'total_flight_hours', type: 'real', default: 0 })
  totalFlightHours: number;

  @Column({ name: 'total_flights', default: 0 })
  totalFlights: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
