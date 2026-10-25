import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '../auth/decorators';
import { CurrentPrincipal, Principal } from '../auth/principal';
import { CreateEnrollmentDto } from './enrollments.dto';
import { EnrollmentsService, EnrollmentView } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  /** Enroll a contributor in a plan (one enrollment per contributor and plan). */
  @RequireScopes('enrollments:write')
  @Post()
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<EnrollmentView> {
    return this.enrollments.create(principal, dto);
  }

  @RequireScopes('enrollments:read')
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EnrollmentView> {
    return this.enrollments.get(principal, id);
  }
}
