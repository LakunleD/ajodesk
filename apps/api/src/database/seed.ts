import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import type { Principal } from '../auth/principal';
import { Collector } from '../collectors/collector.entity';
import { normalizeEmail } from '../collectors/collectors.service';
import { ContributionPostingService } from '../contributions/contribution-posting.service';
import { Contributor } from '../contributors/contributor.entity';
import { ContributorsService } from '../contributors/contributors.service';
import { dateRange } from '../common/dates';
import { Enrollment } from '../enrollments/enrollment.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { SCOPES } from '../integration-credentials/scopes';
import { SavingsPlan } from '../plans/savings-plan.entity';
import { PlansService } from '../plans/plans.service';
import { withAppContext } from './cli-context';

/**
 * Idempotent demo seed with fictional data only: one collector, contributor Amina Yusuf,
 * a ₦1,000/day October 2026 plan, an enrollment, and a cash record for Oct 1–23
 * (leaving Oct 24–25 unpaid as of 2026-10-25, matching docs/API.md).
 */
const PLAN = {
  name: 'October Daily Savings',
  dailyAmountMinor: 100000,
  startOn: '2026-10-01',
  endOn: '2026-10-30',
};
const CONTRIBUTOR = { fullName: 'Amina Yusuf', phone: '+2348000000101' };
const PAID_THROUGH = '2026-10-23';
const SEED_KEY = 'seed-amina-2026-10-01-to-23';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Refusing to seed demo data in production (set ALLOW_DEMO_SEED=true to override)',
    );
  }
  const email = normalizeEmail(process.env.DEMO_COLLECTOR_EMAIL ?? 'demo.collector@ajodesk.test');
  const password = process.env.DEMO_COLLECTOR_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('DEMO_COLLECTOR_PASSWORD (at least 10 characters) is required');
  }

  await withAppContext(async (app) => {
    const dataSource = app.get(DataSource);

    let collector = await dataSource.manager.findOne(Collector, { where: { email } });
    if (!collector) {
      collector = await dataSource.manager.save(
        dataSource.manager.create(Collector, {
          fullName: 'Demo Collector',
          email,
          phone: null,
          passwordHash: await AuthService.hashPassword(password),
          status: 'ACTIVE',
        }),
      );
      console.log(`created collector ${email}`);
    }
    const principal: Principal = {
      collectorId: collector.id,
      actorType: 'COLLECTOR',
      actorId: collector.id,
      scopes: SCOPES,
    };

    let contributor = await dataSource.manager.findOne(Contributor, {
      where: {
        collectorId: collector.id,
        fullName: CONTRIBUTOR.fullName,
        phone: CONTRIBUTOR.phone,
      },
    });
    if (!contributor) {
      const view = await app.get(ContributorsService).create(principal, CONTRIBUTOR);
      contributor = await dataSource.manager.findOneByOrFail(Contributor, { id: view.id });
      console.log(`created contributor ${CONTRIBUTOR.fullName}`);
    }

    let plan = await dataSource.manager.findOne(SavingsPlan, {
      where: { collectorId: collector.id, name: PLAN.name },
    });
    if (!plan) {
      const view = await app
        .get(PlansService)
        .create(principal, { ...PLAN, currency: 'NGN', frequency: 'DAILY' });
      plan = await dataSource.manager.findOneByOrFail(SavingsPlan, { id: view.id });
      console.log(`created plan ${PLAN.name}`);
    }

    let enrollment = await dataSource.manager.findOne(Enrollment, {
      where: { planId: plan.id, contributorId: contributor.id },
    });
    if (!enrollment) {
      const view = await app.get(EnrollmentsService).create(principal, {
        contributorId: contributor.id,
        planId: plan.id,
      });
      enrollment = await dataSource.manager.findOneByOrFail(Enrollment, { id: view.id });
      console.log('created enrollment');
    }

    const dates = dateRange(PLAN.startOn, PAID_THROUGH);
    const { contribution, replayed } = await app.get(ContributionPostingService).post(
      principal,
      {
        enrollmentId: enrollment.id,
        scheduledDates: dates,
        amountMinor: PLAN.dailyAmountMinor * dates.length,
        currency: 'NGN',
        paymentMethod: 'CASH',
      },
      { operation: 'contribution.post', key: SEED_KEY },
    );
    console.log(`${replayed ? 'kept' : 'posted'} seed contribution ${contribution.id}`);

    console.log(
      JSON.stringify(
        {
          collectorEmail: email,
          collectorId: collector.id,
          contributorId: contributor.id,
          planId: plan.id,
          enrollmentId: enrollment.id,
        },
        null,
        2,
      ),
    );
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
