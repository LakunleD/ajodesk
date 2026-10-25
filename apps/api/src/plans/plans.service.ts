import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../auth/principal';
import { daysInclusive } from '../common/dates';
import { AppError } from '../common/errors';
import {
  decodeCursor,
  DEFAULT_PAGE_LIMIT,
  Page,
  PaginationQueryDto,
  toPage,
} from '../common/pagination';
import { CreatePlanDto, MAX_PLAN_DAYS } from './plans.dto';
import { SavingsPlan } from './savings-plan.entity';

export interface PlanView {
  id: string;
  name: string;
  dailyAmountMinor: number;
  currency: string;
  frequency: string;
  startOn: string;
  endOn: string;
  totalDays: number;
  status: string;
  createdAt: string;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SavingsPlan) private readonly plans: Repository<SavingsPlan>,
    private readonly audit: AuditService,
  ) {}

  static toView(plan: SavingsPlan): PlanView {
    return {
      id: plan.id,
      name: plan.name,
      dailyAmountMinor: plan.dailyAmountMinor,
      currency: plan.currency,
      frequency: plan.frequency,
      startOn: plan.startOn,
      endOn: plan.endOn,
      totalDays: daysInclusive(plan.startOn, plan.endOn),
      status: plan.status,
      createdAt: plan.createdAt.toISOString(),
    };
  }

  async create(principal: Principal, dto: CreatePlanDto): Promise<PlanView> {
    if (dto.endOn < dto.startOn) throw AppError.validation('endOn must be on or after startOn');
    if (daysInclusive(dto.startOn, dto.endOn) > MAX_PLAN_DAYS) {
      throw AppError.validation(`A plan may span at most ${MAX_PLAN_DAYS} days`);
    }
    const plan = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(SavingsPlan, {
          collectorId: principal.collectorId,
          name: dto.name,
          dailyAmountMinor: dto.dailyAmountMinor,
          currency: dto.currency,
          frequency: dto.frequency,
          startOn: dto.startOn,
          endOn: dto.endOn,
          status: 'ACTIVE',
        }),
      );
      await this.audit.record(manager, {
        collectorId: principal.collectorId,
        actorType: principal.actorType,
        actorId: principal.actorId,
        action: 'plan.created',
        entityType: 'savings_plan',
        entityId: created.id,
        metadata: {
          dailyAmountMinor: dto.dailyAmountMinor,
          startOn: dto.startOn,
          endOn: dto.endOn,
        },
      });
      return created;
    });
    return PlansService.toView(plan);
  }

  async list(principal: Principal, query: PaginationQueryDto): Promise<Page<PlanView>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.cursor);
    const qb = this.plans
      .createQueryBuilder('p')
      .where('p.collector_id = :collectorId', { collectorId: principal.collectorId });
    if (cursor) qb.andWhere('(p.created_at, p.id) < (:createdAt, :id)', cursor);
    const rows = await qb
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .take(limit + 1)
      .getMany();
    return toPage(rows, limit, PlansService.toView);
  }

  async get(principal: Principal, id: string): Promise<PlanView> {
    return PlansService.toView(await this.findOwned(principal, id));
  }

  async findOwned(principal: Principal, id: string): Promise<SavingsPlan> {
    const plan = await this.plans.findOne({ where: { id, collectorId: principal.collectorId } });
    if (!plan) throw AppError.notFound('Plan');
    return plan;
  }
}
