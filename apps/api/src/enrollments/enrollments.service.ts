import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../auth/principal';
import { ContributorsService } from '../contributors/contributors.service';
import { daysInclusive } from '../common/dates';
import { uniqueViolation } from '../common/db-errors';
import { AppError } from '../common/errors';
import { PlansService } from '../plans/plans.service';
import { Enrollment } from './enrollment.entity';
import type { CreateEnrollmentDto } from './enrollments.dto';

export interface EnrollmentView {
  id: string;
  status: string;
  startOn: string;
  endOn: string;
  totalDays: number;
  contributor: { id: string; fullName: string; phone: string | null };
  plan: { id: string; name: string; dailyAmountMinor: number; currency: string; status: string };
  createdAt: string;
}

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly contributors: ContributorsService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  static toView(enrollment: Enrollment): EnrollmentView {
    const plan = enrollment.plan!;
    const contributor = enrollment.contributor!;
    return {
      id: enrollment.id,
      status: enrollment.status,
      startOn: enrollment.startOn,
      endOn: enrollment.endOn,
      totalDays: daysInclusive(enrollment.startOn, enrollment.endOn),
      contributor: { id: contributor.id, fullName: contributor.fullName, phone: contributor.phone },
      plan: {
        id: plan.id,
        name: plan.name,
        dailyAmountMinor: plan.dailyAmountMinor,
        currency: plan.currency,
        status: plan.status,
      },
      createdAt: enrollment.createdAt.toISOString(),
    };
  }

  async create(principal: Principal, dto: CreateEnrollmentDto): Promise<EnrollmentView> {
    // Both lookups are collector-scoped: a foreign ID yields 404, never a cross-collector link.
    const contributor = await this.contributors.findOwned(principal, dto.contributorId);
    const plan = await this.plans.findOwned(principal, dto.planId);
    if (contributor.status !== 'ACTIVE') throw AppError.validation('Contributor is not active');
    if (plan.status !== 'ACTIVE') throw AppError.validation('Plan is not active');

    const startOn = dto.startOn ?? plan.startOn;
    const endOn = dto.endOn ?? plan.endOn;
    if (endOn < startOn) throw AppError.validation('endOn must be on or after startOn');
    if (startOn < plan.startOn || endOn > plan.endOn) {
      throw AppError.validation('Enrollment dates must fall within the plan dates', {
        planStartOn: plan.startOn,
        planEndOn: plan.endOn,
      });
    }

    try {
      const enrollment = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(Enrollment, {
            collectorId: principal.collectorId,
            planId: plan.id,
            contributorId: contributor.id,
            startOn,
            endOn,
            status: 'ACTIVE',
          }),
        );
        await this.audit.record(manager, {
          collectorId: principal.collectorId,
          actorType: principal.actorType,
          actorId: principal.actorId,
          action: 'enrollment.created',
          entityType: 'enrollment',
          entityId: created.id,
          metadata: { planId: plan.id, contributorId: contributor.id, startOn, endOn },
        });
        return created;
      });
      enrollment.plan = plan;
      enrollment.contributor = contributor;
      return EnrollmentsService.toView(enrollment);
    } catch (error) {
      if (uniqueViolation(error) === 'uq_enrollments_plan_contributor') {
        throw new AppError(
          HttpStatus.CONFLICT,
          'ENROLLMENT_ALREADY_EXISTS',
          'This contributor is already enrolled in this plan',
        );
      }
      throw error;
    }
  }

  async get(principal: Principal, id: string): Promise<EnrollmentView> {
    return EnrollmentsService.toView(await this.findOwnedWithRelations(principal, id));
  }

  async findOwnedWithRelations(principal: Principal, id: string): Promise<Enrollment> {
    const enrollment = await this.enrollments.findOne({
      where: { id, collectorId: principal.collectorId },
      relations: { plan: true, contributor: true },
    });
    if (!enrollment) throw AppError.notFound('Enrollment');
    return enrollment;
  }
}
