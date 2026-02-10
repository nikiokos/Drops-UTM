import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mission } from './mission.entity';
import { Drone } from '../drones/drone.entity';
import { User } from '../users/user.entity';

export type ExecutionStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'aborted'
  | 'failed';

export interface WaypointLog {
  waypointId: string;
  waypointIndex: number;
  reachedAt: Date;
  departedAt?: Date;
  actionsExecuted: string[];
  conditionsTriggered: string[];
  telemetrySnapshot: {
    latitude: number;
    longitude: number;
    altitude: number;
    batteryLevel: number;
    groundSpeed: number;
  };
}

export interface ExecutionEvent {
  timestamp: Date;
  type: 'started' | 'waypoint_reached' | 'action_executed' | 'condition_triggered' | 'paused' | 'resumed' | 'aborted' | 'completed' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

@Entity('mission_executions')
export class MissionExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_id' })
  missionId: string;

  @ManyToOne(() => Mission, (mission) => mission.executions)
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column({ name: 'drone_id' })
  droneId: string;

  @ManyToOne(() => Drone)
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ default: 'pending' })
  status: ExecutionStatus;

  // Progress tracking
  @Column({ name: 'current_waypoint_index', default: 0 })
  currentWaypointIndex: number;

  @Column({ name: 'total_waypoints' })
  totalWaypoints: number;

  @Column({ name: 'completed_waypoints', type: 'simple-json', nullable: true })
  completedWaypoints: string[]; // Array of waypoint IDs

  // Timing
  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ name: 'paused_at', type: 'datetime', nullable: true })
  pausedAt: Date;

  @Column({ name: 'estimated_completion', type: 'datetime', nullable: true })
  estimatedCompletion: Date;

  // Logs
  @Column({ name: 'waypoint_logs', type: 'simple-json', nullable: true })
  waypointLogs: WaypointLog[];

  @Column({ type: 'simple-json', nullable: true })
  events: ExecutionEvent[];

  // Error tracking
  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'abort_reason', nullable: true })
  abortReason: string;

  // Who initiated
  @Column({ name: 'initiated_by', nullable: true })
  initiatedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiator: User;

  @Column({ name: 'trigger_type', nullable: true })
  triggerType: 'manual' | 'scheduled' | 'event'; // How was this execution triggered

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
