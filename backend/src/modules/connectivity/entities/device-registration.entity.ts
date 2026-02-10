import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Drone } from '../../drones/drone.entity';
import { Hub } from '../../hubs/hub.entity';

export type DeviceType = 'drone' | 'gateway' | 'gcs';
export type RegistrationStatus = 'pending' | 'active' | 'revoked';
export type ConnectionStatus = 'offline' | 'online' | 'connecting';

@Entity('device_registrations')
export class DeviceRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_type' })
  deviceType: DeviceType;

  @Column({ name: 'drone_id', nullable: true })
  droneId: string;

  @ManyToOne(() => Drone, { nullable: true })
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ name: 'hub_id', nullable: true })
  hubId: string;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  @Column({ name: 'device_identifier', unique: true })
  deviceIdentifier: string;

  @Column({ name: 'registration_status', default: 'pending' })
  registrationStatus: RegistrationStatus;

  @Column({ name: 'connection_status', default: 'offline' })
  connectionStatus: ConnectionStatus;

  @Column({ name: 'supported_protocols', type: 'simple-json' })
  supportedProtocols: string[];

  @Column({ name: 'certificate_fingerprint', nullable: true })
  certificateFingerprint: string;

  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  lastSeenAt: Date;

  @Column({ name: 'socket_id', nullable: true })
  socketId: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
