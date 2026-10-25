import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { IntegrationCredential } from './integration-credential.entity';
import { isScope, Scope } from './scopes';

export const KEY_PREFIX = 'ajd_';
const KEY_PATTERN = /^ajd_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;
const LAST_USED_RESOLUTION_MS = 60_000;

export interface IssuedCredential {
  credential: IntegrationCredential;
  /** Plaintext key; shown exactly once and never stored. */
  secret: string;
}

@Injectable()
export class IntegrationCredentialsService {
  constructor(
    @InjectRepository(IntegrationCredential)
    private readonly credentials: Repository<IntegrationCredential>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  /** Operator-only: issues a new key bound to one collector. */
  async issue(params: {
    collectorId: string;
    label: string;
    scopes: string[];
    expiresAt?: Date | null;
  }): Promise<IssuedCredential> {
    const scopes = [...new Set(params.scopes)];
    const invalid = scopes.filter((scope) => !isScope(scope));
    if (scopes.length === 0 || invalid.length > 0) {
      throw new Error(`Invalid scopes: ${invalid.join(', ') || '(none given)'}`);
    }
    const keyPrefix = randomBytes(6).toString('hex');
    const secret = `${KEY_PREFIX}${keyPrefix}_${randomBytes(32).toString('base64url')}`;

    return this.credentials.manager.transaction(async (manager) => {
      const credential = await manager.save(
        manager.create(IntegrationCredential, {
          collectorId: params.collectorId,
          label: params.label,
          keyPrefix,
          secretHash: this.hash(secret),
          scopes: scopes as Scope[],
          status: 'ACTIVE',
          expiresAt: params.expiresAt ?? null,
          lastUsedAt: null,
          revokedAt: null,
        }),
      );
      await this.audit.record(manager, {
        collectorId: params.collectorId,
        actorType: 'SYSTEM',
        actorId: null,
        action: 'integration_credential.issued',
        entityType: 'integration_credential',
        entityId: credential.id,
        metadata: { label: params.label, keyPrefix, scopes },
      });
      return { credential, secret };
    });
  }

  /** Revokes without deleting, preserving audit history. Returns false if not found. */
  async revoke(id: string): Promise<boolean> {
    return this.credentials.manager.transaction(async (manager) => {
      const credential = await manager.findOne(IntegrationCredential, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!credential) return false;
      if (credential.status === 'REVOKED') return true;
      await manager.update(IntegrationCredential, id, { status: 'REVOKED', revokedAt: new Date() });
      await this.audit.record(manager, {
        collectorId: credential.collectorId,
        actorType: 'SYSTEM',
        actorId: null,
        action: 'integration_credential.revoked',
        entityType: 'integration_credential',
        entityId: id,
        metadata: { keyPrefix: credential.keyPrefix },
      });
      return true;
    });
  }

  list(collectorId?: string): Promise<IntegrationCredential[]> {
    return this.credentials.find({
      where: collectorId ? { collectorId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  /** Resolves an active credential from a presented key, or null. Constant-time hash comparison. */
  async authenticate(presented: string): Promise<IntegrationCredential | null> {
    const match = KEY_PATTERN.exec(presented);
    if (!match) return null;
    const credential = await this.credentials
      .createQueryBuilder('c')
      .addSelect('c.secretHash')
      .where('c.keyPrefix = :prefix', { prefix: match[1] })
      .getOne();
    if (!credential) return null;

    const expected = Buffer.from(credential.secretHash, 'hex');
    const actual = Buffer.from(this.hash(presented), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    if (credential.status !== 'ACTIVE') return null;
    const now = new Date();
    if (credential.expiresAt && credential.expiresAt <= now) return null;

    if (
      !credential.lastUsedAt ||
      now.getTime() - credential.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS
    ) {
      await this.credentials.update(credential.id, { lastUsedAt: now });
    }
    return credential;
  }

  private hash(secret: string): string {
    return createHmac('sha256', this.config.integrationKeyPepper).update(secret).digest('hex');
  }
}
