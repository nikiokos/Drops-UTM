import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Hub } from '../hubs/hub.entity';

@Entity('airspace_zones')
export class AirspaceZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hub_id', nullable: true })
  hubId: string;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  @Column()
  name: string;

  @Column({ name: 'zone_type' })
  zoneType: string;

  @Column({ type: 'simple-json' })
  geometry: { coordinates: { latitude: number; longitude: number }[] };

  @Column({ name: 'altitude_floor', type: 'real', nullable: true })
  altitudeFloor: number;

  @Column({ name: 'altitude_ceiling', type: 'real', nullable: true })
  altitudeCeiling: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 0 })
  priority: number;

  @Column({ name: 'effective_start', nullable: true })
  effectiveStart: Date;

  @Column({ name: 'effective_end', nullable: true })
  effectiveEnd: Date;

  @Column({ name: 'time_restrictions', type: 'simple-json', nullable: true })
  timeRestrictions: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  restrictions: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  permissions: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
