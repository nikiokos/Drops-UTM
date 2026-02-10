import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column()
  role: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'pilot_license', nullable: true })
  pilotLicense: string;

  @Column({ name: 'license_expiry', nullable: true })
  licenseExpiry: Date;

  @Column({ type: 'simple-json', nullable: true })
  certifications: Record<string, unknown>;

  @Column({ name: 'authorized_hubs', type: 'simple-json', nullable: true })
  authorizedHubs: string[];

  @Column({ type: 'simple-json', nullable: true })
  permissions: Record<string, unknown>;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'last_login', nullable: true })
  lastLogin: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
