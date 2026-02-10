import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mission } from './mission.entity';

export type WaypointActionType =
  | 'hover'
  | 'capture_photo'
  | 'capture_video'
  | 'deliver_payload'
  | 'pickup_payload'
  | 'scan_area'
  | 'activate_sensor'
  | 'deactivate_sensor';

export type ConditionType =
  | 'battery_below'
  | 'battery_above'
  | 'signal_below'
  | 'weather_condition'
  | 'time_elapsed'
  | 'altitude_above'
  | 'altitude_below';

export type ConditionAction =
  | 'skip_waypoint'
  | 'abort_mission'
  | 'rtl'
  | 'hold_position'
  | 'continue'
  | 'land_immediately'
  | 'go_to_nearest_hub';

export interface WaypointAction {
  type: WaypointActionType;
  parameters: Record<string, unknown>;
  // e.g., { duration: 30 } for video
  // e.g., { resolution: '4k', count: 3 } for photos
  // e.g., { payload_id: 'pkg-123' } for delivery
}

export interface WaypointCondition {
  type: ConditionType;
  operator: '>' | '<' | '==' | '!=' | '<=' | '>=';
  value: number | string;
  action: ConditionAction;
  message?: string; // Optional alert message when triggered
}

@Entity('waypoints')
export class Waypoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_id' })
  missionId: string;

  @ManyToOne(() => Mission, (mission) => mission.waypoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column()
  sequence: number;

  @Column({ nullable: true })
  name: string; // Optional waypoint name like "Pickup Point"

  // Location
  @Column({ type: 'real' })
  latitude: number;

  @Column({ type: 'real' })
  longitude: number;

  @Column({ type: 'real' })
  altitude: number; // meters AGL

  // Navigation parameters
  @Column({ name: 'speed_to_waypoint', type: 'real', nullable: true })
  speedToWaypoint: number; // km/h, null = use mission default

  @Column({ name: 'heading_at_waypoint', type: 'real', nullable: true })
  headingAtWaypoint: number; // degrees, null = auto-calculate

  @Column({ name: 'turn_radius', type: 'real', nullable: true })
  turnRadius: number; // meters, for smooth turns

  // Actions at this waypoint
  @Column({ type: 'simple-json', nullable: true })
  actions: WaypointAction[];

  // Conditions to evaluate at this waypoint
  @Column({ type: 'simple-json', nullable: true })
  conditions: WaypointCondition[];

  // Timing
  @Column({ name: 'hover_duration', nullable: true })
  hoverDuration: number; // seconds to hold position

  @Column({ name: 'wait_for_confirmation', default: false })
  waitForConfirmation: boolean; // Pause until operator confirms
}
