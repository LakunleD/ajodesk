import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../auth/principal';
import { todayInLagos } from '../common/dates';
import { uniqueViolation } from '../common/db-errors';
import { AppError } from '../common/errors';
import { retryOnUniqueViolation } from '../common/unique-retry';
import { Enrollment } from '../enrollments/enrollment.entity';
import { IdempotencyScope, IdempotencyService } from '../idempotency/idempotency.service';
import { SavingsPlan } from '../plans/savings-plan.entity';
import { ContributionAllocation } from './contribution-allocation.entity';
import { Contribution } from './contribution.entity';
import type { ContributionRequestDto } from './contributions.dto';
import {
  alreadyPaid,
  assertPostable,
  contributionRequestHash,
  normalizeScheduledDates,
} from './posting-rules';

export const IDEMPOTENCY_CONSTRAINTS = ['uq_idempotency_scope', 'uq_contributions_idempotency'];

export interface PostingResult {
  contribution: Contribution;
  /** True when an earlier identical request already posted this contribution. */
  replayed: boolean;
}

/**
 * The single path that creates financial records, shared by the dashboard
 * (`POST /contributions`) and integration intent confirmation.
 */
@Injectable()
export class ContributionPostingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  /** Posts in its own transaction. */
  post(
    principal: Principal,
    request: ContributionRequestDto,
    scope: IdempotencyScope,
  ): Promise<PostingResult> {
    return retryOnUniqueViolation(IDEMPOTENCY_CONSTRAINTS, () =>
      this.dataSource.transaction((manager) => this.postWithin(manager, principal, request, scope)),
    );
  }

  /**
   * Posts inside the caller's transaction. Order: lock enrollment → idempotency check →
   * re-validate everything against current state → insert contribution, allocations,
   * idempotency record and audit event.
   */
  async postWithin(
    manager: EntityManager,
    principal: Principal,
    request: ContributionRequestDto,
    scope: IdempotencyScope,
  ): Promise<PostingResult> {
    const dates = normalizeScheduledDates(request.scheduledDates);
    const requestHash = contributionRequestHash(request);

    // Serializes all postings for this enrollment; collector-scoped so foreign IDs are 404.
    const enrollment = await manager.findOne(Enrollment, {
      where: { id: request.enrollmentId, collectorId: principal.collectorId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!enrollment) throw AppError.notFound('Enrollment');

    const replayId = await this.idempotency.findReplay(manager, principal, scope, requestHash);
    if (replayId) {
      const existing = await manager.findOne(Contribution, {
        where: { id: replayId, collectorId: principal.collectorId },
        relations: { allocations: true },
      });
      if (!existing)
        throw new Error(`Idempotency record points to missing contribution ${replayId}`);
      return { contribution: existing, replayed: true };
    }

    const plan = await manager.findOneOrFail(SavingsPlan, {
      where: { id: enrollment.planId, collectorId: principal.collectorId },
    });
    assertPostable(enrollment, plan, dates, request.amountMinor);

    const paid = await manager.find(ContributionAllocation, {
      where: { enrollmentId: enrollment.id, scheduledOn: In(dates) },
      order: { scheduledOn: 'ASC' },
    });
    if (paid.length > 0) throw alreadyPaid(paid.map((allocation) => allocation.scheduledOn));

    try {
      const contribution = await manager.save(
        manager.create(Contribution, {
          collectorId: principal.collectorId,
          enrollmentId: enrollment.id,
          amountMinor: request.amountMinor,
          currency: 'NGN',
          paymentMethod: 'CASH',
          verificationStatus: 'COLLECTOR_ATTESTED',
          collectedOn: todayInLagos(),
          idempotencyKey: scope.key,
          requestHash,
          recordedByType: principal.actorType,
          recordedById: principal.actorId,
          status: 'POSTED',
        }),
      );
      const allocations = dates.map((scheduledOn) =>
        manager.create(ContributionAllocation, {
          contributionId: contribution.id,
          enrollmentId: enrollment.id,
          scheduledOn,
          amountMinor: plan.dailyAmountMinor,
        }),
      );
      contribution.allocations = await manager.save(allocations);

      await this.idempotency.remember(manager, principal, scope, requestHash, contribution.id);
      await this.audit.record(manager, {
        collectorId: principal.collectorId,
        actorType: principal.actorType,
        actorId: principal.actorId,
        action: 'contribution.posted',
        entityType: 'contribution',
        entityId: contribution.id,
        metadata: {
          enrollmentId: enrollment.id,
          amountMinor: contribution.amountMinor,
          scheduledDates: dates,
          paymentMethod: 'CASH',
          verificationStatus: 'COLLECTOR_ATTESTED',
          idempotencyOperation: scope.operation,
        },
      });
      return { contribution, replayed: false };
    } catch (error) {
      // Backstop for the enrollment lock: the DB unique constraint is the final authority.
      if (uniqueViolation(error) === 'uq_allocations_enrollment_date') throw alreadyPaid(dates);
      throw error;
    }
  }
}
