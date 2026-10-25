import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintKobo, Currency } from '../common/money';

export type PlanStatus = 'ACTIVE' | 'CLOSED';

@Entity('savings_plans')
export class SavingsPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collector_id', type: 'uuid' })
  collectorId: string;

  @Column()
  name: string;

  @Column({ name: 'daily_amount_minor', type: 'bigint', transformer: bigintKobo })
  dailyAmountMinor: number;

  @Column({ type: 'varchar' })
  currency: Currency;

  @Column({ type: 'varchar' })
  frequency: 'DAILY';

  @Column({ name: 'start_on', type: 'date' })
  startOn: string;

  @Column({ name: 'end_on', type: 'date' })
  endOn: string;

  @Column({ type: 'varchar' })
  status: PlanStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
