import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { ActorType } from '../auth/principal';
import { bigintKobo, Currency } from '../common/money';
import { ContributionAllocation } from './contribution-allocation.entity';

/**
 * A posted, collector-attested cash record. Immutable once inserted (enforced by a DB trigger).
 * It is a record of the collector's attestation, not evidence of a bank transaction.
 */
@Entity('contributions')
export class Contribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collector_id', type: 'uuid' })
  collectorId: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintKobo })
  amountMinor: number;

  @Column({ type: 'varchar' })
  currency: Currency;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod: 'CASH';

  @Column({ name: 'verification_status', type: 'varchar' })
  verificationStatus: 'COLLECTOR_ATTESTED';

  /** Lagos calendar date on which the record was posted. */
  @Column({ name: 'collected_on', type: 'date' })
  collectedOn: string;

  @Column({ name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ name: 'request_hash' })
  requestHash: string;

  @Column({ name: 'recorded_by_type', type: 'varchar' })
  recordedByType: ActorType;

  @Column({ name: 'recorded_by_id', type: 'uuid' })
  recordedById: string;

  @Column({ type: 'varchar' })
  status: 'POSTED';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @OneToMany(() => ContributionAllocation, (allocation) => allocation.contribution)
  allocations?: ContributionAllocation[];
}
