import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '../auth/decorators';
import { CurrentPrincipal, Principal } from '../auth/principal';
import { ContributionRequestDto } from '../contributions/contributions.dto';
import { requireIdempotencyKey } from '../contributions/posting-rules';
import {
  ConfirmedIntentView,
  ContributionIntentsService,
  IntentView,
} from './contribution-intents.service';

@ApiTags('contribution-intents')
@ApiBearerAuth()
@Controller('contribution-intents')
export class ContributionIntentsController {
  constructor(private readonly intents: ContributionIntentsService) {}

  /** Prepare a contribution for operator confirmation. Does not change any balance. */
  @RequireScopes('contributions:prepare')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post()
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ContributionRequestDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<IntentView> {
    return this.intents.create(principal, dto, requireIdempotencyKey(idempotencyKey));
  }

  /** Read intent status; use to resolve an uncertain confirmation outcome. */
  @RequireScopes('contributions:prepare')
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IntentView> {
    return this.intents.get(principal, id);
  }

  /**
   * Commit the intent exactly once. Safe to retry: a repeat returns the same contribution.
   * An `Idempotency-Key` header is accepted but not required; the intent ID is the key.
   */
  @RequireScopes('contributions:confirm')
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConfirmedIntentView> {
    return this.intents.confirm(principal, id);
  }
}
