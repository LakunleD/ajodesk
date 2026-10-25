import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../auth/principal';
import { AppError } from '../common/errors';
import { decodeCursor, DEFAULT_PAGE_LIMIT, Page, toPage } from '../common/pagination';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Contributor } from './contributor.entity';
import type { CreateContributorDto, SearchContributorsQueryDto } from './contributors.dto';

export interface ContributorView {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface ContributorDetailView extends ContributorView {
  enrollments: {
    id: string;
    planId: string;
    planName: string;
    dailyAmountMinor: number;
    currency: string;
    startOn: string;
    endOn: string;
    status: string;
  }[];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class ContributorsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Contributor) private readonly contributors: Repository<Contributor>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly audit: AuditService,
  ) {}

  static toView(contributor: Contributor): ContributorView {
    return {
      id: contributor.id,
      fullName: contributor.fullName,
      phone: contributor.phone,
      status: contributor.status,
      createdAt: contributor.createdAt.toISOString(),
    };
  }

  async create(principal: Principal, dto: CreateContributorDto): Promise<ContributorView> {
    const contributor = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Contributor, {
          collectorId: principal.collectorId,
          fullName: dto.fullName,
          phone: dto.phone ?? null,
          status: 'ACTIVE',
        }),
      );
      await this.audit.record(manager, {
        collectorId: principal.collectorId,
        actorType: principal.actorType,
        actorId: principal.actorId,
        action: 'contributor.created',
        entityType: 'contributor',
        entityId: created.id,
        metadata: {},
      });
      return created;
    });
    return ContributorsService.toView(contributor);
  }

  /** Returns every match; duplicate names are never collapsed into one result. */
  async search(
    principal: Principal,
    query: SearchContributorsQueryDto,
  ): Promise<Page<ContributorView>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.cursor);
    const qb = this.contributors
      .createQueryBuilder('c')
      .where('c.collector_id = :collectorId', { collectorId: principal.collectorId });
    if (query.search) {
      qb.andWhere("(c.full_name ILIKE :term ESCAPE '\\' OR c.phone ILIKE :term ESCAPE '\\')", {
        term: `%${escapeLike(query.search)}%`,
      });
    }
    if (cursor) {
      qb.andWhere('(c.created_at, c.id) < (:createdAt, :id)', cursor);
    }
    const rows = await qb
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(limit + 1)
      .getMany();
    return toPage(rows, limit, ContributorsService.toView);
  }

  async getDetail(principal: Principal, id: string): Promise<ContributorDetailView> {
    const contributor = await this.findOwned(principal, id);
    const enrollments = await this.enrollments.find({
      where: { contributorId: contributor.id, collectorId: principal.collectorId },
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });
    return {
      ...ContributorsService.toView(contributor),
      enrollments: enrollments.map((enrollment) => ({
        id: enrollment.id,
        planId: enrollment.planId,
        planName: enrollment.plan!.name,
        dailyAmountMinor: enrollment.plan!.dailyAmountMinor,
        currency: enrollment.plan!.currency,
        startOn: enrollment.startOn,
        endOn: enrollment.endOn,
        status: enrollment.status,
      })),
    };
  }

  async findOwned(principal: Principal, id: string): Promise<Contributor> {
    const contributor = await this.contributors.findOne({
      where: { id, collectorId: principal.collectorId },
    });
    if (!contributor) throw AppError.notFound('Contributor');
    return contributor;
  }
}
