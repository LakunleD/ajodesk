import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contributor } from '../contributors/contributor.entity';
import { SavingsPlan } from '../plans/savings-plan.entity';

export type EnrollmentStatus = 'ACTIVE' | 'CLOSED';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collector_id', type: 'uuid' })
  collectorId: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'contributor_id', type: 'uuid' })
  contributorId: string;

  @ManyToOne(() => SavingsPlan)
  @JoinColumn({ name: 'plan_id' })
  plan?: SavingsPlan;

  @ManyToOne(() => Contributor)
  @JoinColumn({ name: 'contributor_id' })
  contributor?: Contributor;

  @Column({ name: 'start_on', type: 'date' })
  startOn: string;

  @Column({ name: 'end_on', type: 'date' })
  endOn: string;

  @Column({ type: 'varchar' })
  status: EnrollmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
