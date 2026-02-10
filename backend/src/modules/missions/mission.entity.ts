import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Drone } from '../drones/drone.entity';
import { Hub } from '../hubs/hub.entity';
import { User } from '../users/user.entity';
import { Waypoint } from './waypoint.entity';
import { MissionExecution } from './mission-execution.entity';

export type MissionStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'aborted'
  | 'cancelled'
  | 'failed';

export type ScheduleType = 'manual' | 'scheduled' | 'event_triggered';

export interface TriggerCondition {
  type: 'battery_above' | 'weather_clear' | 'time_window' | 'drone_available' | 'package_ready';
  operator: '>' | '<' | '==' | '!=' | 'between';
  value: unknown;
  secondaryValue?: unknown; // For 'between' operator
}

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'draft' })
  status: MissionStatus;

  // Assignment
  @Column({ name: 'drone_id', nullable: true })
  droneId: string;

  @ManyToOne(() => Drone, { nullable: true })
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

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

  // Waypoints
  @OneToMany(() => Waypoint, (waypoint) => waypoint.mission, {
    cascade: true,
    eager: true,
  })
  waypoints: Waypoint[];

  // Scheduling
  @Column({ name: 'schedule_type', default: 'manual' })
  scheduleType: ScheduleType;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt: Date;

  @Column({ name: 'recurring_pattern', nullable: true })
  recurringPattern: string; // Cron expression

  @Column({ name: 'trigger_conditions', type: 'simple-json', nullable: true })
  triggerConditions: TriggerCondition[];

  // Template reference
  @Column({ name: 'template_id', nullable: true })
  templateId: string;

  @Column({ name: 'template_version', nullable: true })
  templateVersion: number;

  // Estimates
  @Column({ name: 'estimated_duration', nullable: true })
  estimatedDuration: number; // seconds

  @Column({ name: 'estimated_distance', nullable: true })
  estimatedDistance: number; // meters

  // Executions
  @OneToMany(() => MissionExecution, (execution) => execution.mission)
  executions: MissionExecution[];

  // Metadata
  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
