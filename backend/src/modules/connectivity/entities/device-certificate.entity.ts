import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DeviceRegistration } from './device-registration.entity';

@Entity('device_certificates')
export class DeviceCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_registration_id' })
  deviceRegistrationId: string;

  @ManyToOne(() => DeviceRegistration, { nullable: false })
  @JoinColumn({ name: 'device_registration_id' })
  deviceRegistration: DeviceRegistration;

  @Column({ name: 'certificate_pem', type: 'text' })
  certificatePem: string;

  @Column({ unique: true })
  fingerprint: string;

  @Column({ name: 'common_name' })
  commonName: string;

  @Column({ name: 'issued_at', type: 'datetime' })
  issuedAt: Date;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
