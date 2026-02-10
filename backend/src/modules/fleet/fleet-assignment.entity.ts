import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mission } from '../missions/mission.entity';
import { Drone } from '../drones/drone.entity';

export type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface DroneScore {
  proximity: number;
  battery: number;
  capability: number;
  utilization: number;
  maintenance: number;
}

export interface ScoringWeights {
  proximity: number;
  battery: number;
  capability: number;
  utilization: number;
  maintenance: number;
}

export interface AlternativeDrone {
  droneId: string;
  score: number;
  scores: DroneScore;
  reason?: string;
}

@Entity('fleet_assignments')
export class FleetAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_id' })
  missionId: string;

  @ManyToOne(() => Mission)
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column({ name: 'drone_id', nullable: true })
  droneId: string;

  @ManyToOne(() => Drone)
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ type: 'simple-json' })
  scores: DroneScore;

  @Column({ type: 'simple-json' })
  weights: ScoringWeights;

  @Column({ name: 'final_score', type: 'float' })
  finalScore: number;

  @Column({ default: 'pending' })
  status: AssignmentStatus;

  @Column({ name: 'assigned_by', default: 'system' })
  assignedBy: 'system' | 'operator';

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @Column({ type: 'simple-json', nullable: true })
  alternativeDrones: AlternativeDrone[];

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ name: 'assigned_at', nullable: true })
  assignedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
