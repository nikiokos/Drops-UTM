import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Hub } from '../hubs/hub.entity';
import { Drone } from '../drones/drone.entity';
import { Mission } from '../missions/mission.entity';

export type RebalancingStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
export type RebalancingTrigger = 'threshold_breach' | 'scheduled' | 'manual' | 'predictive';

export interface RebalancingRule {
  type: 'min_drones' | 'max_idle' | 'demand_forecast' | 'manual';
  condition: string;
  threshold?: number;
  actualValue?: number;
}

@Entity('rebalancing_tasks')
export class RebalancingTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_hub_id' })
  sourceHubId: string;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'source_hub_id' })
  sourceHub: Hub;

  @Column({ name: 'target_hub_id' })
  targetHubId: string;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'target_hub_id' })
  targetHub: Hub;

  @Column({ name: 'drone_id' })
  droneId: string;

  @ManyToOne(() => Drone)
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ name: 'repositioning_mission_id', nullable: true })
  repositioningMissionId: string;

  @ManyToOne(() => Mission)
  @JoinColumn({ name: 'repositioning_mission_id' })
  repositioningMission: Mission;

  @Column({ default: 'threshold_breach' })
  trigger: RebalancingTrigger;

  @Column({ type: 'simple-json' })
  rule: RebalancingRule;

  @Column({ default: 'pending' })
  status: RebalancingStatus;

  @Column({ default: 1 })
  priority: number;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancelled_reason', nullable: true })
  cancelledReason: string;

  @Column({ name: 'failure_reason', nullable: true })
  failureReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
