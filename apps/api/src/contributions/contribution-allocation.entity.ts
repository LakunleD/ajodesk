import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { bigintKobo } from '../common/money';
import { Contribution } from './contribution.entity';

/** One fully paid schedule day. Unique per (enrollment, scheduled_on). */
@Entity('contribution_allocations')
export class ContributionAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contribution_id', type: 'uuid' })
  contributionId: string;

  @ManyToOne(() => Contribution, (contribution) => contribution.allocations)
  @JoinColumn({ name: 'contribution_id' })
  contribution?: Contribution;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @Column({ name: 'scheduled_on', type: 'date' })
  scheduledOn: string;

  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintKobo })
  amountMinor: number;
}
