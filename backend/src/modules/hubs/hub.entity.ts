import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hubs')
export class Hub {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'simple-json' })
  location: { latitude: number; longitude: number };

  @Column({ name: 'altitude_msl', type: 'real', nullable: true })
  altitudeMsl: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'max_simultaneous_drones', default: 10 })
  maxSimultaneousDrones: number;

  @Column({ name: 'airspace_radius', type: 'real' })
  airspaceRadius: number;

  @Column({ name: 'airspace_ceiling', type: 'real' })
  airspaceCeiling: number;

  @Column({ name: 'airspace_floor', type: 'real' })
  airspaceFloor: number;

  @Column({ nullable: true })
  timezone: string;

  @Column({ type: 'simple-json', nullable: true })
  capabilities: Record<string, unknown>;

  @Column({ name: 'contact_info', type: 'simple-json', nullable: true })
  contactInfo: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
