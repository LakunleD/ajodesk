import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ContributionsModule } from '../contributions/contributions.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ContributionIntentsController } from './contribution-intents.controller';
import { ContributionIntentsService } from './contribution-intents.service';

@Module({
  imports: [ContributionsModule, IdempotencyModule, AuditModule],
  controllers: [ContributionIntentsController],
  providers: [ContributionIntentsService],
})
export class ContributionIntentsModule {}
