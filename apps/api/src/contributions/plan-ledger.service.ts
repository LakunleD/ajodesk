import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Principal } from '../auth/principal';
import { todayInLagos } from '../common/dates';
import { AppError } from '../common/errors';
import {
  decodeCursor,
  DEFAULT_PAGE_LIMIT,
  Page,
  PaginationQueryDto,
  toPage,
} from '../common/pagination';
import { Enrollment } from '../enrollments/enrollment.entity';
import { SavingsPlan } from '../plans/savings-plan.entity';
import { ContributionAllocation } from './contribution-allocation.entity';
import { Contribution } from './contribution.entity';
import { ContributionsService, ContributionView } from './contributions.service';
import {
  aggregatePlanSummary,
  computeEnrollmentSummary,
  EnrollmentSummary,
  PlanSummary,
} from './summary';

export interface PlanEnrollmentView {
  enrollmentId: string;
  status: string;
  startOn: string;
  endOn: string;
  contributor: { id: string; fullName: string; phone: string | null };
  summary: Pick<
    EnrollmentSummary,
    | 'asOf'
    | 'recordedTotalMinor'
    | 'dueMinor'
    | 'outstandingDueMinor'
    | 'prepaidMinor'
    | 'paidDaysCount'
    | 'eligibleDaysCount'
    | 'unpaidDatesCount'
  >;
}

export interface PlanContributionView extends ContributionView {
  contributor: { id: string; fullName: string };
}

/** Plan-level reads: who is enrolled, what they have paid, and every posted contribution. */
@Injectable()
export class PlanLedgerService {
  constructor(
    @InjectRepository(SavingsPlan) private readonly plans: Repository<SavingsPlan>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(Contribution) private readonly contributions: Repository<Contribution>,
    @InjectRepository(ContributionAllocation)
    private readonly allocations: Repository<ContributionAllocation>,
  ) {}

  async summary(
    principal: Principal,
    planId: string,
    asOf: string | undefined,
  ): Promise<PlanSummary> {
    const plan = await this.findOwnedPlan(principal, planId);
    const date = asOf ?? todayInLagos();
    const enrollments = await this.enrollments.find({
      where: { planId: plan.id, collectorId: principal.collectorId },
    });
    const summaries = await this.summarize(enrollments, plan, date);
    return aggregatePlanSummary(
      plan,
      date,
      enrollments.map((e) => ({ status: e.status, summary: summaries.get(e.id)! })),
    );
  }

  async members(
    principal: Principal,
    planId: string,
    query: PaginationQueryDto & { asOf?: string },
  ): Promise<Page<PlanEnrollmentView>> {
    const plan = await this.findOwnedPlan(principal, planId);
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.cursor);
    const qb = this.enrollments
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.contributor', 'c')
      .where('e.plan_id = :planId AND e.collector_id = :collectorId', {
        planId: plan.id,
        collectorId: principal.collectorId,
      });
    if (cursor) qb.andWhere('(e.created_at, e.id) < (:createdAt, :id)', cursor);
    const rows = await qb
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      // limit (not take): each join is to-one, and take()+join breaks raw-column ordering.
      .limit(limit + 1)
      .getMany();

    const summaries = await this.summarize(
      rows.slice(0, limit),
      plan,
      query.asOf ?? todayInLagos(),
    );
    return toPage(rows, limit, (e) => {
      const s = summaries.get(e.id)!;
      return {
        enrollmentId: e.id,
        status: e.status,
        startOn: e.startOn,
        endOn: e.endOn,
        contributor: {
          id: e.contributor!.id,
          fullName: e.contributor!.fullName,
          phone: e.contributor!.phone,
        },
        summary: {
          asOf: s.asOf,
          recordedTotalMinor: s.recordedTotalMinor,
          dueMinor: s.dueMinor,
          outstandingDueMinor: s.outstandingDueMinor,
          prepaidMinor: s.prepaidMinor,
          paidDaysCount: s.paidDaysCount,
          eligibleDaysCount: s.eligibleDaysCount,
          unpaidDatesCount: s.unpaidDatesCount,
        },
      };
    });
  }

  async contributionHistory(
    principal: Principal,
    planId: string,
    query: PaginationQueryDto,
  ): Promise<Page<PlanContributionView>> {
    const plan = await this.findOwnedPlan(principal, planId);
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.cursor);
    const qb = this.contributions
      .createQueryBuilder('k')
      .innerJoin(Enrollment, 'e', 'e.id = k.enrollment_id')
      .where('e.plan_id = :planId AND k.collector_id = :collectorId', {
        planId: plan.id,
        collectorId: principal.collectorId,
      });
    if (cursor) qb.andWhere('(k.created_at, k.id) < (:createdAt, :id)', cursor);
    const rows = await qb
      .orderBy('k.created_at', 'DESC')
      .addOrderBy('k.id', 'DESC')
      // limit (not take): each join is to-one, and take()+join breaks raw-column ordering.
      .limit(limit + 1)
      .getMany();

    const ids = rows.map((r) => r.id);
    const [allocations, enrollments] = ids.length
      ? await Promise.all([
          this.allocations.find({ where: { contributionId: In(ids) } }),
          this.enrollments.find({
            where: { id: In([...new Set(rows.map((r) => r.enrollmentId))]) },
            relations: { contributor: true },
          }),
        ])
      : [[], []];
    const contributorByEnrollment = new Map(enrollments.map((e) => [e.id, e.contributor!]));
    for (const row of rows)
      row.allocations = allocations.filter((a) => a.contributionId === row.id);

    return toPage(rows, limit, (row) => {
      const contributor = contributorByEnrollment.get(row.enrollmentId)!;
      return {
        ...ContributionsService.toView(row),
        contributor: { id: contributor.id, fullName: contributor.fullName },
      };
    });
  }

  private async summarize(
    enrollments: Enrollment[],
    plan: SavingsPlan,
    asOf: string,
  ): Promise<Map<string, EnrollmentSummary>> {
    const allocations = enrollments.length
      ? await this.allocations.find({
          where: { enrollmentId: In(enrollments.map((e) => e.id)) },
          select: { enrollmentId: true, scheduledOn: true, amountMinor: true },
        })
      : [];
    return new Map(
      enrollments.map((e) => [
        e.id,
        computeEnrollmentSummary({
          enrollmentId: e.id,
          startOn: e.startOn,
          endOn: e.endOn,
          dailyAmountMinor: plan.dailyAmountMinor,
          asOf,
          allocations: allocations.filter((a) => a.enrollmentId === e.id),
        }),
      ]),
    );
  }

  private async findOwnedPlan(principal: Principal, id: string): Promise<SavingsPlan> {
    const plan = await this.plans.findOne({ where: { id, collectorId: principal.collectorId } });
    if (!plan) throw AppError.notFound('Plan');
    return plan;
  }
}
