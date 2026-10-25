import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../auth/principal';
import { AppError } from '../common/errors';
import { retryOnUniqueViolation } from '../common/unique-retry';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import {
  ContributionPostingService,
  IDEMPOTENCY_CONSTRAINTS,
} from '../contributions/contribution-posting.service';
import { ContributionAllocation } from '../contributions/contribution-allocation.entity';
import type { ContributionRequestDto } from '../contributions/contributions.dto';
import {
  ContributionsService,
  EnrollmentSummaryView,
} from '../contributions/contributions.service';
import {
  alreadyPaid,
  assertPostable,
  contributionRequestHash,
  normalizeScheduledDates,
} from '../contributions/posting-rules';
import { Contributor } from '../contributors/contributor.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { SavingsPlan } from '../plans/savings-plan.entity';
import { ContributionIntent, IntentStatus } from './contribution-intent.entity';

export interface IntentView {
  intentId: string;
  status: IntentStatus;
  enrollmentId: string;
  contributorName: string;
  planName: string;
  scheduledDates: string[];
  amountMinor: number;
  currency: string;
  paymentMethod: string;
  expiresAt: string;
  contributionId: string | null;
  /** Set once confirmed. Cash is attested by the collector, never bank-verified. */
  verificationStatus: 'COLLECTOR_ATTESTED' | null;
  createdAt: string;
}

export interface ConfirmedIntentView extends IntentView {
  summary: EnrollmentSummaryView;
}

const OPERATION_CREATE = 'intent.create';
const OPERATION_POST = 'intent.confirm';

@Injectable()
export class ContributionIntentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posting: ContributionPostingService,
    private readonly contributions: ContributionsService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Creates a PENDING intent. Has no financial effect. */
  create(principal: Principal, request: ContributionRequestDto, key: string): Promise<IntentView> {
    return retryOnUniqueViolation(['uq_idempotency_scope'], () =>
      this.dataSource.transaction((manager) => this.createWithin(manager, principal, request, key)),
    );
  }

  async get(principal: Principal, id: string): Promise<IntentView> {
    const intent = await this.dataSource.manager.findOne(ContributionIntent, {
      where: { id, collectorId: principal.collectorId },
    });
    if (!intent) throw AppError.notFound('Contribution intent');
    return this.toView(this.dataSource.manager, intent);
  }

  /**
   * Commits the intent exactly once through the shared posting service. A repeat confirm returns
   * the already-committed contribution. Ownership, dates, amount and paid status are re-checked
   * at commit because state may have changed since preparation.
   */
  async confirm(principal: Principal, id: string): Promise<ConfirmedIntentView> {
    const outcome = await retryOnUniqueViolation(IDEMPOTENCY_CONSTRAINTS, () =>
      this.dataSource.transaction(async (manager) => {
        const intent = await manager.findOne(ContributionIntent, {
          where: { id, collectorId: principal.collectorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!intent) throw AppError.notFound('Contribution intent');
        if (
          intent.createdById !== principal.actorId ||
          intent.createdByType !== principal.actorType
        ) {
          throw AppError.forbidden('Only the credential that prepared this intent may confirm it');
        }

        if (intent.status === 'COMPLETED') return { kind: 'done' as const, intent };
        if (intent.status === 'CANCELLED') {
          throw AppError.conflict('INTENT_ALREADY_CANCELLED', 'This intent was cancelled');
        }
        if (intent.status === 'EXPIRED') return { kind: 'expired' as const };
        if (intent.expiresAt.getTime() <= Date.now()) {
          await manager.update(ContributionIntent, intent.id, { status: 'EXPIRED' });
          await this.audit.record(manager, {
            collectorId: principal.collectorId,
            actorType: principal.actorType,
            actorId: principal.actorId,
            action: 'contribution_intent.expired',
            entityType: 'contribution_intent',
            entityId: intent.id,
            metadata: {},
          });
          return { kind: 'expired' as const };
        }

        const { contribution } = await this.posting.postWithin(
          manager,
          principal,
          {
            enrollmentId: intent.enrollmentId,
            scheduledDates: intent.dates,
            amountMinor: intent.amountMinor,
            currency: intent.currency,
            paymentMethod: intent.paymentMethod,
          },
          { operation: OPERATION_POST, key: `intent:${intent.id}` },
        );
        intent.status = 'COMPLETED';
        intent.completedContributionId = contribution.id;
        intent.completedAt = new Date();
        await manager.save(intent);
        await this.audit.record(manager, {
          collectorId: principal.collectorId,
          actorType: principal.actorType,
          actorId: principal.actorId,
          action: 'contribution_intent.confirmed',
          entityType: 'contribution_intent',
          entityId: intent.id,
          metadata: { contributionId: contribution.id },
        });
        return { kind: 'done' as const, intent };
      }),
    );

    // Thrown after commit so the EXPIRED transition persists.
    if (outcome.kind === 'expired') {
      throw new AppError(
        HttpStatus.GONE,
        'INTENT_EXPIRED',
        'This intent has expired; prepare a new one',
      );
    }
    const view = await this.toView(this.dataSource.manager, outcome.intent);
    const summary = await this.contributions.summary(
      principal,
      outcome.intent.enrollmentId,
      undefined,
    );
    return { ...view, summary };
  }

  private async createWithin(
    manager: EntityManager,
    principal: Principal,
    request: ContributionRequestDto,
    key: string,
  ): Promise<IntentView> {
    const dates = normalizeScheduledDates(request.scheduledDates);
    const requestHash = contributionRequestHash(request);
    const scope = { operation: OPERATION_CREATE, key };

    const replayId = await this.idempotency.findReplay(manager, principal, scope, requestHash);
    if (replayId) {
      const existing = await manager.findOneOrFail(ContributionIntent, {
        where: { id: replayId, collectorId: principal.collectorId },
      });
      return this.toView(manager, existing);
    }

    const enrollment = await manager.findOne(Enrollment, {
      where: { id: request.enrollmentId, collectorId: principal.collectorId },
    });
    if (!enrollment) throw AppError.notFound('Enrollment');
    const plan = await manager.findOneOrFail(SavingsPlan, {
      where: { id: enrollment.planId, collectorId: principal.collectorId },
    });
    assertPostable(enrollment, plan, dates, request.amountMinor);

    // Early feedback only; confirmation re-checks under the enrollment lock.
    const paid = await manager.find(ContributionAllocation, {
      where: { enrollmentId: enrollment.id, scheduledOn: In(dates) },
      order: { scheduledOn: 'ASC' },
    });
    if (paid.length > 0) throw alreadyPaid(paid.map((allocation) => allocation.scheduledOn));

    const intent = await manager.save(
      manager.create(ContributionIntent, {
        collectorId: principal.collectorId,
        enrollmentId: enrollment.id,
        createdByType: principal.actorType,
        createdById: principal.actorId,
        dates,
        amountMinor: request.amountMinor,
        currency: 'NGN',
        paymentMethod: 'CASH',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + this.config.intentTtlMinutes * 60_000),
        completedContributionId: null,
        completedAt: null,
      }),
    );
    await this.idempotency.remember(manager, principal, scope, requestHash, intent.id);
    await this.audit.record(manager, {
      collectorId: principal.collectorId,
      actorType: principal.actorType,
      actorId: principal.actorId,
      action: 'contribution_intent.created',
      entityType: 'contribution_intent',
      entityId: intent.id,
      metadata: {
        enrollmentId: enrollment.id,
        amountMinor: request.amountMinor,
        scheduledDates: dates,
      },
    });
    return this.toView(manager, intent);
  }

  private async toView(manager: EntityManager, intent: ContributionIntent): Promise<IntentView> {
    const enrollment = await manager.findOneOrFail(Enrollment, {
      where: { id: intent.enrollmentId, collectorId: intent.collectorId },
    });
    const [contributor, plan] = await Promise.all([
      manager.findOneOrFail(Contributor, { where: { id: enrollment.contributorId } }),
      manager.findOneOrFail(SavingsPlan, { where: { id: enrollment.planId } }),
    ]);
    // A lapsed PENDING intent reads as EXPIRED even before anyone tries to confirm it.
    const status: IntentStatus =
      intent.status === 'PENDING' && intent.expiresAt.getTime() <= Date.now()
        ? 'EXPIRED'
        : intent.status;
    return {
      intentId: intent.id,
      status,
      enrollmentId: intent.enrollmentId,
      contributorName: contributor.fullName,
      planName: plan.name,
      scheduledDates: intent.dates,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      paymentMethod: intent.paymentMethod,
      expiresAt: intent.expiresAt.toISOString(),
      contributionId: intent.completedContributionId,
      verificationStatus: status === 'COMPLETED' ? 'COLLECTOR_ATTESTED' : null,
      createdAt: intent.createdAt.toISOString(),
    };
  }
}
