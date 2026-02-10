import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ name: 'registration_number', nullable: true })
  registrationNumber: string;

  @Column({ name: 'contact_info', type: 'simple-json', nullable: true })
  contactInfo: Record<string, string>;

  @Column({ type: 'simple-json', nullable: true })
  address: Record<string, string>;

  @Column({ name: 'authorized_airspace', type: 'simple-json', nullable: true })
  authorizedAirspace: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  certifications: Record<string, unknown>;

  @Column({ name: 'insurance_info', type: 'simple-json', nullable: true })
  insuranceInfo: Record<string, unknown>;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
