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
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';

@Entity('flights')
export class Flight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'flight_number', unique: true })
  flightNumber: string;

  @Column({ name: 'drone_id' })
  droneId: string;

  @ManyToOne(() => Drone)
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ name: 'pilot_id', nullable: true })
  pilotId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'pilot_id' })
  pilot: User;

  @Column({ name: 'departure_hub_id' })
  departureHubId: string;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'departure_hub_id' })
  departureHub: Hub;

  @Column({ name: 'arrival_hub_id', nullable: true })
  arrivalHubId: string;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'arrival_hub_id' })
  arrivalHub: Hub;

  @Column({ name: 'flight_type' })
  flightType: string;

  @Column({ name: 'operation_mode' })
  operationMode: string;

  @Column({ default: 'planned' })
  status: string;

  @Column({ name: 'planned_departure' })
  plannedDeparture: Date;

  @Column({ name: 'planned_arrival', nullable: true })
  plannedArrival: Date;

  @Column({ name: 'actual_departure', nullable: true })
  actualDeparture: Date;

  @Column({ name: 'actual_arrival', nullable: true })
  actualArrival: Date;

  @Column({ name: 'planned_route', type: 'simple-json', nullable: true })
  plannedRoute: Record<string, unknown>;

  @Column({ name: 'actual_route', type: 'simple-json', nullable: true })
  actualRoute: Record<string, unknown>;

  @Column({ name: 'max_altitude', type: 'real', nullable: true })
  maxAltitude: number;

  @Column({ name: 'min_altitude', type: 'real', nullable: true })
  minAltitude: number;

  @Column({ name: 'authorization_status', nullable: true })
  authorizationStatus: string;

  @Column({ name: 'authorization_number', nullable: true })
  authorizationNumber: string;

  @Column({ name: 'mission_type', nullable: true })
  missionType: string;

  @Column({ name: 'payload_weight', type: 'real', nullable: true })
  payloadWeight: number;

  @Column({ name: 'mission_data', type: 'simple-json', nullable: true })
  missionData: Record<string, unknown>;

  @Column({ name: 'risk_assessment', nullable: true })
  riskAssessment: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'weather_conditions', type: 'simple-json', nullable: true })
  weatherConditions: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
