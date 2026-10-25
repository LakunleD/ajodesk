import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CredentialStatus = 'ACTIVE' | 'REVOKED';

/** A collector-bound API key. Only an HMAC of the secret is stored. */
@Entity('integration_credentials')
export class IntegrationCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collector_id', type: 'uuid' })
  collectorId: string;

  @Column()
  label: string;

  /** Non-secret lookup identifier embedded in the key (`ajd_<prefix>_<secret>`). */
  @Column({ name: 'key_prefix' })
  keyPrefix: string;

  @Column({ name: 'secret_hash', select: false })
  secretHash: string;

  @Column({ type: 'text', array: true })
  scopes: string[];

  @Column({ type: 'varchar' })
  status: CredentialStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', precision: 3, nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', precision: 3, nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', precision: 3, nullable: true })
  revokedAt: Date | null;
}
