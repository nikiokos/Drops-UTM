import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { WaypointAction, WaypointCondition } from '../missions/waypoint.entity';
import { TriggerCondition } from '../missions/mission.entity';

export type VariableType = 'hub' | 'drone' | 'number' | 'string' | 'coordinates' | 'datetime';

export interface TemplateVariable {
  key: string; // e.g., "departure_hub"
  label: string; // "Departure Hub"
  type: VariableType;
  required: boolean;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: { value: unknown; label: string }[];
  };
}

export interface WaypointBlueprint {
  sequence: number;
  name?: string;

  // Location can be fixed or variable reference
  latitude: number | string; // string = "${variable_name}"
  longitude: number | string;
  altitude: number | string;

  // Navigation
  speedToWaypoint?: number | string;
  headingAtWaypoint?: number;
  turnRadius?: number;

  // Actions & Conditions
  actions?: WaypointAction[];
  conditions?: WaypointCondition[];

  // Timing
  hoverDuration?: number;
  waitForConfirmation?: boolean;
}

export interface MissionBlueprint {
  waypoints: WaypointBlueprint[];
  defaultScheduleType: 'manual' | 'scheduled' | 'event_triggered';
  defaultTriggerConditions?: TriggerCondition[];
  estimatedDuration?: number;
  estimatedDistance?: number;
}

@Entity('mission_templates')
export class MissionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string; // 'delivery', 'inspection', 'survey', 'patrol', etc.

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Version control
  @Column({ default: 1 })
  version: number;

  @Column({ name: 'is_latest', default: true })
  isLatest: boolean;

  @Column({ name: 'previous_version_id', nullable: true })
  previousVersionId: string;

  @Column({ nullable: true })
  changelog: string; // Description of changes in this version

  // Template variables
  @Column({ type: 'simple-json', nullable: true })
  variables: TemplateVariable[];

  // The mission blueprint
  @Column({ type: 'simple-json' })
  blueprint: MissionBlueprint;

  // Usage stats
  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  // Publishing
  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date;

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
