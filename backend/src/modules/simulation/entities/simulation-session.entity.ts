import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Drone } from '../../drones/drone.entity';
import {
  SimulationSessionStatus,
  EmergencyScenarioType,
  SimulationState,
  ScenarioConfig,
  SimulationWaypoint,
} from '../types/simulation.types';

@Entity('simulation_sessions')
export class SimulationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'drone_id' })
  droneId: string;

  @ManyToOne(() => Drone, { nullable: false })
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ name: 'mission_id', type: 'text', nullable: true })
  missionId: string | null;

  @Column({ default: 'idle' })
  status: SimulationSessionStatus;

  @Column({ default: 'normal' })
  scenario: EmergencyScenarioType;

  @Column({ name: 'time_scale', type: 'real', default: 1.0 })
  timeScale: number;

  @Column({ name: 'scenario_config', type: 'simple-json', nullable: true })
  scenarioConfig: ScenarioConfig | null;

  @Column({ name: 'current_state', type: 'simple-json' })
  currentState: SimulationState;

  @Column({ type: 'simple-json', nullable: true })
  waypoints: SimulationWaypoint[] | null;

  @Column({ name: 'tick_rate', type: 'integer', default: 10 })
  tickRate: number; // Hz

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;
}
