import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { APP_CONFIG, AppConfig } from '../src/config/configuration';
import { loadDotEnv } from '../src/config/load-env';
import { IntegrationCredentialsService } from '../src/integration-credentials/integration-credentials.service';

export const TODAY_FIXTURE = '2026-10-25';

/** Drops and recreates the test schema, then boots the real app against it. */
export async function createTestApp(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  loadDotEnv();
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgres://ajodesk:ajodesk_local_only@127.0.0.1:5433/ajodesk_test';
  if (!/_test(\?|$)/.test(url)) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-at-least-32-characters';
  process.env.INTEGRATION_KEY_PEPPER ??= 'test-pepper-that-is-at-least-32-characters-long';
  process.env.AUTH_RATE_LIMIT_PER_MINUTE = '10000';

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
  return { app, dataSource };
}

export interface Fixture {
  token: string;
  collectorId: string;
  contributorId: string;
  planId: string;
  enrollmentId: string;
}

let counter = 0;

/** Registers a collector and creates contributor, ₦1,000/day Oct 2026 plan, and enrollment. */
export async function createFixture(app: INestApplication): Promise<Fixture> {
  counter += 1;
  const http = request(app.getHttpServer());
  const register = await http
    .post('/api/v1/auth/register')
    .send({
      fullName: `Collector ${counter}`,
      email: `collector${counter}-${Date.now()}@example.test`,
      password: 'correct-horse-battery',
    })
    .expect(201);
  const token: string = register.body.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  const contributor = await http
    .post('/api/v1/contributors')
    .set(auth)
    .send({ fullName: 'Amina Yusuf', phone: '+2348000000101' })
    .expect(201);
  const plan = await http
    .post('/api/v1/plans')
    .set(auth)
    .send({
      name: 'October Daily Savings',
      dailyAmountMinor: 100000,
      currency: 'NGN',
      frequency: 'DAILY',
      startOn: '2026-10-01',
      endOn: '2026-10-30',
    })
    .expect(201);
  const enrollment = await http
    .post('/api/v1/enrollments')
    .set(auth)
    .send({ contributorId: contributor.body.id, planId: plan.body.id })
    .expect(201);

  return {
    token,
    collectorId: register.body.collector.id,
    contributorId: contributor.body.id,
    planId: plan.body.id,
    enrollmentId: enrollment.body.id,
  };
}

export async function issueKey(
  app: INestApplication,
  collectorId: string,
  scopes: string[] = [
    'contributors:read',
    'plans:read',
    'enrollments:read',
    'contributions:read',
    'contributions:prepare',
    'contributions:confirm',
  ],
): Promise<{ key: string; id: string }> {
  const { credential, secret } = await app
    .get(IntegrationCredentialsService)
    .issue({ collectorId, label: 'test', scopes });
  return { key: secret, id: credential.id };
}

export function contributionBody(
  enrollmentId: string,
  dates: string[],
  amountMinor = 100000 * dates.length,
) {
  return {
    enrollmentId,
    scheduledDates: dates,
    amountMinor,
    currency: 'NGN',
    paymentMethod: 'CASH',
  };
}
