import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '../auth/decorators';
import { CurrentPrincipal, Principal } from '../auth/principal';
import type { Page } from '../common/pagination';
import { CreateContributorDto, SearchContributorsQueryDto } from './contributors.dto';
import {
  ContributorDetailView,
  ContributorsService,
  ContributorView,
} from './contributors.service';

@ApiTags('contributors')
@ApiBearerAuth()
@Controller('contributors')
export class ContributorsController {
  constructor(private readonly contributors: ContributorsService) {}

  /** Search contributors by name or phone (`?search=amina`). */
  @RequireScopes('contributors:read')
  @Get()
  search(
    @CurrentPrincipal() principal: Principal,
    @Query() query: SearchContributorsQueryDto,
  ): Promise<Page<ContributorView>> {
    return this.contributors.search(principal, query);
  }

  @RequireScopes('contributors:write')
  @Post()
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateContributorDto,
  ): Promise<ContributorView> {
    return this.contributors.create(principal, dto);
  }

  /** Contributor detail including enrollments. */
  @RequireScopes('contributors:read')
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContributorDetailView> {
    return this.contributors.getDetail(principal, id);
  }
}
