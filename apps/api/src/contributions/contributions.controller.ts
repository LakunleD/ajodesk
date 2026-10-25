import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CollectorOnly, RequireScopes } from '../auth/decorators';
import { CurrentPrincipal, Principal } from '../auth/principal';
import { Page, PaginationQueryDto } from '../common/pagination';
import { ContributionPostingService } from './contribution-posting.service';
import {
  ContributionRequestDto,
  PlanEnrollmentsQueryDto,
  SummaryQueryDto,
} from './contributions.dto';
import {
  ContributionsService,
  ContributionView,
  EnrollmentSummaryView,
} from './contributions.service';
import { PlanContributionView, PlanEnrollmentView, PlanLedgerService } from './plan-ledger.service';
import { requireIdempotencyKey } from './posting-rules';
import type { PlanSummary } from './summary';

@ApiTags('contributions')
@ApiBearerAuth()
@Controller('contributions')
export class ContributionsController {
  constructor(
    private readonly contributions: ContributionsService,
    private readonly posting: ContributionPostingService,
  ) {}

  /**
   * Record collector-attested cash for one or more unpaid dates (dashboard only).
   * Integrations use the contribution-intent flow instead.
   */
  @CollectorOnly()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ContributionRequestDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ContributionView> {
    const key = requireIdempotencyKey(idempotencyKey);
    const result = await this.posting.post(principal, dto, { operation: 'contribution.post', key });
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return ContributionsService.toView(result.contribution);
  }

  @RequireScopes('contributions:read')
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContributionView> {
    return this.contributions.get(principal, id);
  }
}

/** Enrollment-scoped ledger reads, served by the contributions module. */
@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentLedgerController {
  constructor(private readonly contributions: ContributionsService) {}

  /** Due/paid/unpaid summary as of a Lagos calendar date (default today). */
  @RequireScopes('contributions:read')
  @Get(':id/summary')
  summary(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SummaryQueryDto,
  ): Promise<EnrollmentSummaryView> {
    return this.contributions.summary(principal, id, query.asOf);
  }

  /** Posted contributions, newest first. */
  @RequireScopes('contributions:read')
  @Get(':id/contributions')
  history(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<ContributionView>> {
    return this.contributions.history(principal, id, query);
  }
}

/** Plan-scoped ledger reads: members with balances, and every contribution in the plan. */
@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlanLedgerController {
  constructor(private readonly ledger: PlanLedgerService) {}

  /** Plan totals: the sum of each enrollment's summary as of a Lagos date (default today). */
  @RequireScopes('plans:read', 'contributions:read')
  @Get(':id/summary')
  summary(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SummaryQueryDto,
  ): Promise<PlanSummary> {
    return this.ledger.summary(principal, id, query.asOf);
  }

  /** Contributors enrolled in the plan, each with their balance as of `asOf`. */
  @RequireScopes('plans:read', 'enrollments:read', 'contributions:read')
  @Get(':id/enrollments')
  enrollments(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PlanEnrollmentsQueryDto,
  ): Promise<Page<PlanEnrollmentView>> {
    return this.ledger.members(principal, id, query);
  }

  /** Every posted contribution across the plan's enrollments, newest first. */
  @RequireScopes('plans:read', 'contributions:read')
  @Get(':id/contributions')
  contributions(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<PlanContributionView>> {
    return this.ledger.contributionHistory(principal, id, query);
  }
}
