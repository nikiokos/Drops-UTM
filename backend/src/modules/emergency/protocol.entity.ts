import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmergencyType, EmergencySeverity, ResponseAction } from './incident.entity';

@Entity('emergency_protocols')
export class EmergencyProtocol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // What triggers this protocol
  @Column({ name: 'emergency_type' })
  emergencyType: EmergencyType;

  @Column()
  severity: EmergencySeverity;

  // Response configuration
  @Column({ name: 'response_action' })
  responseAction: ResponseAction;

  @Column({ name: 'fallback_action', nullable: true })
  fallbackAction: ResponseAction;

  // Confirmation settings
  @Column({ name: 'requires_confirmation', default: true })
  requiresConfirmation: boolean;

  @Column({ name: 'confirmation_timeout_seconds', default: 30 })
  confirmationTimeoutSeconds: number;

  @Column({ name: 'auto_execute_on_timeout', default: true })
  autoExecuteOnTimeout: boolean;

  // Priority (lower = higher priority)
  @Column({ default: 50 })
  priority: number;

  // Thresholds (JSON object with configurable values)
  @Column({ type: 'simple-json', nullable: true })
  thresholds: {
    warning?: number;
    critical?: number;
    emergency?: number;
    [key: string]: unknown;
  };

  // Conditions (JSON for complex trigger conditions)
  @Column({ type: 'simple-json', nullable: true })
  conditions: {
    minBattery?: number;
    maxAltitude?: number;
    requiresGps?: boolean;
    [key: string]: unknown;
  };

  // Notification settings
  @Column({ name: 'notify_pilot', default: true })
  notifyPilot: boolean;

  @Column({ name: 'notify_supervisor', default: true })
  notifySupervisor: boolean;

  @Column({ name: 'notify_ops_center', default: true })
  notifyOpsCenter: boolean;

  @Column({ name: 'send_sms', default: false })
  sendSms: boolean;

  @Column({ name: 'send_email', default: true })
  sendEmail: boolean;

  @Column({ name: 'play_audio_alarm', default: true })
  playAudioAlarm: boolean;

  // Is this protocol active?
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Is this a system default protocol?
  @Column({ name: 'is_system_default', default: false })
  isSystemDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


// Emergency system configuration entity
@Entity('emergency_config')
export class EmergencyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'simple-json' })
  value: unknown;

  @Column({ type: 'text', nullable: true })
  description: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
