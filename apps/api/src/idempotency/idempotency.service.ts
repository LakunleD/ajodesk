import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { Principal } from '../auth/principal';
import { AppError } from '../common/errors';
import { IdempotencyRecord } from './idempotency-record.entity';

export interface IdempotencyScope {
  operation: string;
  key: string;
}

@Injectable()
export class IdempotencyService {
  /**
   * Returns the resource ID stored for this (collector, actor, operation, key), or null.
   * Throws IDEMPOTENCY_CONFLICT when the key was used with a different payload.
   */
  async findReplay(
    manager: EntityManager,
    principal: Principal,
    scope: IdempotencyScope,
    requestHash: string,
  ): Promise<string | null> {
    const record = await manager.findOne(IdempotencyRecord, {
      where: {
        collectorId: principal.collectorId,
        actorId: principal.actorId,
        operation: scope.operation,
        idempotencyKey: scope.key,
      },
    });
    if (!record) return null;
    if (record.requestHash !== requestHash) {
      throw AppError.conflict(
        'IDEMPOTENCY_CONFLICT',
        'This Idempotency-Key was already used with a different request',
      );
    }
    return record.resultResourceId;
  }

  async remember(
    manager: EntityManager,
    principal: Principal,
    scope: IdempotencyScope,
    requestHash: string,
    resultResourceId: string,
  ): Promise<void> {
    await manager.insert(IdempotencyRecord, {
      collectorId: principal.collectorId,
      actorId: principal.actorId,
      operation: scope.operation,
      idempotencyKey: scope.key,
      requestHash,
      resultResourceId,
    });
  }
}
