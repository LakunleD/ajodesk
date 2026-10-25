import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('idempotency_records')
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collector_id', type: 'uuid' })
  collectorId: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column()
  operation: string;

  @Column({ name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ name: 'request_hash' })
  requestHash: string;

  @Column({ name: 'result_resource_id', type: 'uuid' })
  resultResourceId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
