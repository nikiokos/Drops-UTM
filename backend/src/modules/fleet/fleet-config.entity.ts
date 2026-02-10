import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ScoringWeights {
  proximity: number;
  battery: number;
  capability: number;
  utilization: number;
  maintenance: number;
}

export interface FleetThresholds {
  minDronesPerHub: number;
  maxIdleTimeMinutes: number;
  rebalanceCooldownMinutes: number;
  minDonorReserve: number;
  maxConcurrentRepositions: number;
  minBatteryForReposition: number;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  quietHoursOnly: boolean;
}

@Entity('fleet_configurations')
export class FleetConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'simple-json' })
  weights: ScoringWeights;

  @Column({ type: 'simple-json' })
  thresholds: FleetThresholds;

  @Column({ name: 'is_preset', default: false })
  isPreset: boolean;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// Default preset configurations
export const DEFAULT_PRESETS: Partial<FleetConfiguration>[] = [
  {
    name: 'Efficiency Mode',
    description: 'Prioritize minimizing flight time and energy consumption',
    weights: {
      proximity: 0.4,
      battery: 0.25,
      capability: 0.2,
      utilization: 0.05,
      maintenance: 0.1,
    },
    thresholds: {
      minDronesPerHub: 2,
      maxIdleTimeMinutes: 120,
      rebalanceCooldownMinutes: 30,
      minDonorReserve: 2,
      maxConcurrentRepositions: 3,
      minBatteryForReposition: 70,
      quietHoursOnly: false,
    },
    isPreset: true,
  },
  {
    name: 'Balanced Mode',
    description: 'Balance efficiency with fleet health and capability matching',
    weights: {
      proximity: 0.25,
      battery: 0.2,
      capability: 0.25,
      utilization: 0.15,
      maintenance: 0.15,
    },
    thresholds: {
      minDronesPerHub: 2,
      maxIdleTimeMinutes: 90,
      rebalanceCooldownMinutes: 30,
      minDonorReserve: 2,
      maxConcurrentRepositions: 3,
      minBatteryForReposition: 70,
      quietHoursOnly: false,
    },
    isPreset: true,
  },
  {
    name: 'Fleet Health Mode',
    description: 'Prioritize even wear distribution and maintenance scheduling',
    weights: {
      proximity: 0.15,
      battery: 0.15,
      capability: 0.2,
      utilization: 0.3,
      maintenance: 0.2,
    },
    thresholds: {
      minDronesPerHub: 3,
      maxIdleTimeMinutes: 60,
      rebalanceCooldownMinutes: 45,
      minDonorReserve: 3,
      maxConcurrentRepositions: 2,
      minBatteryForReposition: 80,
      quietHoursOnly: false,
    },
    isPreset: true,
  },
];
