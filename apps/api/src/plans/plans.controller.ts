import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '../auth/decorators';
import { CurrentPrincipal, Principal } from '../auth/principal';
import { Page, PaginationQueryDto } from '../common/pagination';
import { CreatePlanDto } from './plans.dto';
import { PlansService, PlanView } from './plans.service';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  /** Create a fixed-amount NGN daily plan. */
  @RequireScopes('plans:write')
  @Post()
  create(@CurrentPrincipal() principal: Principal, @Body() dto: CreatePlanDto): Promise<PlanView> {
    return this.plans.create(principal, dto);
  }

  @RequireScopes('plans:read')
  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<PlanView>> {
    return this.plans.list(principal, query);
  }

  @RequireScopes('plans:read')
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanView> {
    return this.plans.get(principal, id);
  }
}
