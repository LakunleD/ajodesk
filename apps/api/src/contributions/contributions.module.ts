import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Enrollment } from '../enrollments/enrollment.entity';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ContributionAllocation } from './contribution-allocation.entity';
import { ContributionPostingService } from './contribution-posting.service';
import { Contribution } from './contribution.entity';
import {
  ContributionsController,
  EnrollmentLedgerController,
  PlanLedgerController,
} from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { PlanLedgerService } from './plan-ledger.service';
import { SavingsPlan } from '../plans/savings-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contribution, ContributionAllocation, Enrollment, SavingsPlan]),
    IdempotencyModule,
    AuditModule,
  ],
  controllers: [ContributionsController, EnrollmentLedgerController, PlanLedgerController],
  providers: [ContributionsService, ContributionPostingService, PlanLedgerService],
  exports: [ContributionsService, ContributionPostingService],
})
export class ContributionsModule {}
