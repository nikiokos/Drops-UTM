import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'key_hash', unique: true })
  keyHash: string;

  @Column({ name: 'key_prefix' })
  keyPrefix: string;

  @Column()
  name: string;

  @Column({ name: 'manufacturer_name' })
  manufacturerName: string;

  @Column({ name: 'contact_email' })
  contactEmail: string;

  @Column({
    type: 'simple-json',
    default: '["telemetry:write","drones:read","drones:register"]',
  })
  permissions: string[];

  @Column({ name: 'rate_limit', default: 100 })
  rateLimit: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'total_requests', default: 0 })
  totalRequests: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
