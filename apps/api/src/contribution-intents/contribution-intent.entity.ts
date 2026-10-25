import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ActorType } from '../auth/principal';
import { bigintKobo, Currency } from '../common/money';

export type IntentStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

/** A prepared, not-yet-posted contribution. Has no financial effect until confirmed. */
@Entity('contribution_intents')
export class ContributionIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collector_id', type: 'uuid' })
  collectorId: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @Column({ name: 'created_by_type', type: 'varchar' })
  createdByType: ActorType;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  /** Sorted, unique scheduled dates. Immutable. */
  @Column({ name: 'dates_json', type: 'jsonb' })
  dates: string[];

  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintKobo })
  amountMinor: number;

  @Column({ type: 'varchar' })
  currency: Currency;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod: 'CASH';

  @Column({ type: 'varchar' })
  status: IntentStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'completed_contribution_id', type: 'uuid', nullable: true })
  completedContributionId: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', precision: 3, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
