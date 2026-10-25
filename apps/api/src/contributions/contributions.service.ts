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
import { ContributionAllocation } from './contribution-allocation.entity';
import { Contribution } from './contribution.entity';
import { computeEnrollmentSummary, EnrollmentSummary } from './summary';

export interface ContributionView {
  id: string;
  enrollmentId: string;
  amountMinor: number;
  currency: string;
  paymentMethod: string;
  verificationStatus: string;
  status: string;
  collectedOn: string;
  scheduledDates: string[];
  recordedBy: { type: string; id: string };
  createdAt: string;
}

export interface EnrollmentSummaryView extends EnrollmentSummary {
  contributorName: string;
  planName: string;
}

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(Contribution) private readonly contributions: Repository<Contribution>,
    @InjectRepository(ContributionAllocation)
    private readonly allocations: Repository<ContributionAllocation>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
  ) {}

  static toView(contribution: Contribution): ContributionView {
    return {
      id: contribution.id,
      enrollmentId: contribution.enrollmentId,
      amountMinor: contribution.amountMinor,
      currency: contribution.currency,
      paymentMethod: contribution.paymentMethod,
      verificationStatus: contribution.verificationStatus,
      status: contribution.status,
      collectedOn: contribution.collectedOn,
      scheduledDates: (contribution.allocations ?? []).map((a) => a.scheduledOn).sort(),
      recordedBy: { type: contribution.recordedByType, id: contribution.recordedById },
      createdAt: contribution.createdAt.toISOString(),
    };
  }

  async get(principal: Principal, id: string): Promise<ContributionView> {
    const contribution = await this.contributions.findOne({
      where: { id, collectorId: principal.collectorId },
      relations: { allocations: true },
    });
    if (!contribution) throw AppError.notFound('Contribution');
    return ContributionsService.toView(contribution);
  }

  async history(
    principal: Principal,
    enrollmentId: string,
    query: PaginationQueryDto,
  ): Promise<Page<ContributionView>> {
    await this.findOwnedEnrollment(principal, enrollmentId);
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.cursor);
    const qb = this.contributions
      .createQueryBuilder('c')
      .where('c.enrollment_id = :enrollmentId AND c.collector_id = :collectorId', {
        enrollmentId,
        collectorId: principal.collectorId,
      });
    if (cursor) qb.andWhere('(c.created_at, c.id) < (:createdAt, :id)', cursor);
    const rows = await qb
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const ids = rows.map((row) => row.id);
    const allocations = ids.length
      ? await this.allocations.find({ where: { contributionId: In(ids) } })
      : [];
    for (const row of rows) {
      row.allocations = allocations.filter((a) => a.contributionId === row.id);
    }
    return toPage(rows, limit, ContributionsService.toView);
  }

  /** Computed from posted allocations only; pending intents never count. */
  async summary(
    principal: Principal,
    enrollmentId: string,
    asOf: string | undefined,
  ): Promise<EnrollmentSummaryView> {
    const enrollment = await this.findOwnedEnrollment(principal, enrollmentId);
    const allocations = await this.allocations.find({
      where: { enrollmentId: enrollment.id },
      select: { scheduledOn: true, amountMinor: true },
    });
    return {
      ...computeEnrollmentSummary({
        enrollmentId: enrollment.id,
        startOn: enrollment.startOn,
        endOn: enrollment.endOn,
        dailyAmountMinor: enrollment.plan!.dailyAmountMinor,
        asOf: asOf ?? todayInLagos(),
        allocations,
      }),
      contributorName: enrollment.contributor!.fullName,
      planName: enrollment.plan!.name,
    };
  }

  private async findOwnedEnrollment(principal: Principal, id: string): Promise<Enrollment> {
    const enrollment = await this.enrollments.findOne({
      where: { id, collectorId: principal.collectorId },
      relations: { plan: true, contributor: true },
    });
    if (!enrollment) throw AppError.notFound('Enrollment');
    return enrollment;
  }
}
