import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditEvent } from './audit-event.entity';

export type AuditInput = Pick<
  AuditEvent,
  'collectorId' | 'actorType' | 'actorId' | 'action' | 'entityType' | 'entityId' | 'metadata'
>;

@Injectable()
export class AuditService {
  /** Appends an audit event inside the caller's transaction. */
  async record(manager: EntityManager, input: AuditInput): Promise<void> {
    await manager.save(manager.create(AuditEvent, input));
  }
}
