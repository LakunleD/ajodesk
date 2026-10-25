import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { IdempotencyService } from '../src/idempotency/idempotency.service';
import { IntegrationCredentialsService } from '../src/integration-credentials/integration-credentials.service';
import { contributionBody, createFixture, createTestApp, Fixture, issueKey } from './setup-app';

const AS_OF = '2026-10-25';

describe('AjoDesk API (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function count(table: string, where: string, params: unknown[]): Promise<number> {
    const rows: { n: string }[] = await db.query(
      `SELECT count(*) AS n FROM ${table} WHERE ${where}`,
      params,
    );
    return Number(rows[0].n);
  }

  async function summary(token: string, enrollmentId: string, asOf = AS_OF) {
    const res = await http()
      .get(`/api/v1/enrollments/${enrollmentId}/summary?asOf=${asOf}`)
      .set(bearer(token))
      .expect(200);
    return res.body;
  }

  beforeAll(async () => {
    ({ app, dataSource: db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health and auth', () => {
    it('reports health without credentials', async () => {
      const res = await http().get('/api/v1/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });

    it('rejects invalid login with 401 and the error envelope', async () => {
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.test', password: 'wrong-password' })
        .expect(401);
      expect(res.body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(res.body.error.requestId).toEqual(expect.any(String));
    });

    it('logs in, returns identity, and refuses duplicate email', async () => {
      const email = `login-${Date.now()}@Example.test`;
      await http()
        .post('/api/v1/auth/register')
        .send({ fullName: 'Login Test', email, password: 'correct-horse-battery' })
        .expect(201);
      const dup = await http()
        .post('/api/v1/auth/register')
        .send({ fullName: 'Dup', email: email.toLowerCase(), password: 'correct-horse-battery' })
        .expect(409);
      expect(dup.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'correct-horse-battery' })
        .expect(200);
      const me = await http()
        .get('/api/v1/auth/me')
        .set(bearer(login.body.accessToken))
        .expect(200);
      expect(me.body.email).toBe(email.toLowerCase());
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it('rejects missing, malformed, and revoked credentials', async () => {
      await http().get('/api/v1/plans').expect(401);
      await http().get('/api/v1/plans').set(bearer('not-a-jwt')).expect(401);
      await http()
        .get('/api/v1/plans')
        .set(bearer('ajd_000000000000_' + 'x'.repeat(43)))
        .expect(401);

      const fx = await createFixture(app);
      const { key, id } = await issueKey(app, fx.collectorId, ['plans:read']);
      await http().get('/api/v1/plans').set(bearer(key)).expect(200);
      await app.get(IntegrationCredentialsService).revoke(id);
      await http().get('/api/v1/plans').set(bearer(key)).expect(401);
    });
  });

  describe('collector isolation', () => {
    let a: Fixture;
    let b: Fixture;

    beforeAll(async () => {
      a = await createFixture(app);
      b = await createFixture(app);
    });

    it("returns 404 for another collector's resources", async () => {
      await http().get(`/api/v1/enrollments/${a.enrollmentId}`).set(bearer(b.token)).expect(404);
      await http()
        .get(`/api/v1/enrollments/${a.enrollmentId}/summary`)
        .set(bearer(b.token))
        .expect(404);
      await http().get(`/api/v1/contributors/${a.contributorId}`).set(bearer(b.token)).expect(404);
      await http().get(`/api/v1/plans/${a.planId}`).set(bearer(b.token)).expect(404);
      const search = await http()
        .get('/api/v1/contributors?search=Amina')
        .set(bearer(b.token))
        .expect(200);
      expect(search.body.items.map((c: { id: string }) => c.id)).not.toContain(a.contributorId);
    });

    it("cannot write to another collector's enrollment or link their records", async () => {
      await http()
        .post('/api/v1/contributions')
        .set(bearer(b.token))
        .set('Idempotency-Key', 'cross-write-1')
        .send(contributionBody(a.enrollmentId, ['2026-10-05']))
        .expect(404);
      expect(await count('contributions', 'enrollment_id = $1', [a.enrollmentId])).toBe(0);

      await http()
        .post('/api/v1/enrollments')
        .set(bearer(b.token))
        .send({ contributorId: a.contributorId, planId: b.planId })
        .expect(404);
    });

    it('scopes integration keys to their own collector and rejects a supplied collectorId', async () => {
      const { key } = await issueKey(app, b.collectorId);
      await http()
        .get(`/api/v1/enrollments/${a.enrollmentId}/summary`)
        .set(bearer(key))
        .expect(404);
      const res = await http()
        .post('/api/v1/contribution-intents')
        .set(bearer(key))
        .set('Idempotency-Key', 'collector-id-injection')
        .send({ ...contributionBody(a.enrollmentId, ['2026-10-05']), collectorId: a.collectorId })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      await http()
        .post('/api/v1/contribution-intents')
        .set(bearer(key))
        .set('Idempotency-Key', 'collector-id-injection-2')
        .send(contributionBody(a.enrollmentId, ['2026-10-05']))
        .expect(404);
    });
  });

  describe('scopes', () => {
    it('denies writes to read-only keys and dashboard-only routes to keys', async () => {
      const fx = await createFixture(app);
      const { key } = await issueKey(app, fx.collectorId, [
        'contributions:read',
        'contributors:read',
      ]);
      const prepare = await http()
        .post('/api/v1/contribution-intents')
        .set(bearer(key))
        .set('Idempotency-Key', 'read-only-prepare')
        .send(contributionBody(fx.enrollmentId, ['2026-10-05']))
        .expect(403);
      expect(prepare.body.error.code).toBe('FORBIDDEN');
      await http()
        .post('/api/v1/contributors')
        .set(bearer(key))
        .send({ fullName: 'X Y' })
        .expect(403);
      await http().get('/api/v1/auth/me').set(bearer(key)).expect(403);
      await http()
        .post('/api/v1/contributions')
        .set(bearer(key))
        .set('Idempotency-Key', 'key-direct')
        .send(contributionBody(fx.enrollmentId, ['2026-10-05']))
        .expect(403);
      await http()
        .get(`/api/v1/enrollments/${fx.enrollmentId}/summary`)
        .set(bearer(key))
        .expect(200);
      expect(await count('contribution_intents', 'enrollment_id = $1', [fx.enrollmentId])).toBe(0);
    });
  });

  describe('contributors and enrollments', () => {
    it('returns every contributor sharing a name', async () => {
      const fx = await createFixture(app);
      for (const phone of ['+2348000000201', '+2348000000202']) {
        await http()
          .post('/api/v1/contributors')
          .set(bearer(fx.token))
          .send({ fullName: 'Musa Bello', phone })
          .expect(201);
      }
      const res = await http()
        .get('/api/v1/contributors?search=musa')
        .set(bearer(fx.token))
        .expect(200);
      expect(res.body.items).toHaveLength(2);
    });

    it('paginates with an opaque cursor', async () => {
      const fx = await createFixture(app);
      for (let i = 0; i < 3; i += 1) {
        await http()
          .post('/api/v1/contributors')
          .set(bearer(fx.token))
          .send({ fullName: `Page ${i}` })
          .expect(201);
      }
      const first = await http()
        .get('/api/v1/contributors?limit=2')
        .set(bearer(fx.token))
        .expect(200);
      expect(first.body.items).toHaveLength(2);
      const second = await http()
        .get(`/api/v1/contributors?limit=2&cursor=${first.body.nextCursor}`)
        .set(bearer(fx.token))
        .expect(200);
      expect(second.body.items).toHaveLength(2);
      expect(second.body.nextCursor).toBeNull();
      const ids = [...first.body.items, ...second.body.items].map((c: { id: string }) => c.id);
      expect(new Set(ids).size).toBe(4);
    });

    it('rejects duplicate enrollment and dates outside the plan', async () => {
      const fx = await createFixture(app);
      const dup = await http()
        .post('/api/v1/enrollments')
        .set(bearer(fx.token))
        .send({ contributorId: fx.contributorId, planId: fx.planId })
        .expect(409);
      expect(dup.body.error.code).toBe('ENROLLMENT_ALREADY_EXISTS');
      const other = await http()
        .post('/api/v1/contributors')
        .set(bearer(fx.token))
        .send({ fullName: 'Ngozi Okeke' });
      await http()
        .post('/api/v1/enrollments')
        .set(bearer(fx.token))
        .send({ contributorId: other.body.id, planId: fx.planId, startOn: '2026-09-30' })
        .expect(400);
    });

    it("lists the contributor's enrollments on the detail endpoint", async () => {
      const fx = await createFixture(app);
      const res = await http()
        .get(`/api/v1/contributors/${fx.contributorId}`)
        .set(bearer(fx.token))
        .expect(200);
      expect(res.body.enrollments).toEqual([
        expect.objectContaining({
          id: fx.enrollmentId,
          dailyAmountMinor: 100000,
          planName: 'October Daily Savings',
        }),
      ]);
    });
  });

  describe('direct contribution recording', () => {
    let fx: Fixture;

    beforeEach(async () => {
      fx = await createFixture(app);
    });

    const post = (key: string | null, body: object) => {
      const req = http().post('/api/v1/contributions').set(bearer(fx.token));
      if (key) req.set('Idempotency-Key', key);
      return req.send(body);
    };

    it('records one ₦1,000 day as one contribution, one allocation, one audit event', async () => {
      const before = await summary(fx.token, fx.enrollmentId);
      const res = await post('one-day', contributionBody(fx.enrollmentId, ['2026-10-25'])).expect(
        201,
      );
      expect(res.body).toMatchObject({
        amountMinor: 100000,
        currency: 'NGN',
        status: 'POSTED',
        verificationStatus: 'COLLECTOR_ATTESTED',
        paymentMethod: 'CASH',
        scheduledDates: ['2026-10-25'],
      });
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
      expect(await count('contribution_allocations', 'enrollment_id = $1', [fx.enrollmentId])).toBe(
        1,
      );
      expect(
        await count('audit_events', "entity_id = $1 AND action = 'contribution.posted'", [
          res.body.id,
        ]),
      ).toBe(1);

      const after = await summary(fx.token, fx.enrollmentId);
      expect(after.recordedTotalMinor - before.recordedTotalMinor).toBe(100000);
      expect(after.unpaidDates).not.toContain('2026-10-25');
    });

    it('records two days in one ₦2,000 event as one contribution with two allocations', async () => {
      const res = await post(
        'two-days',
        contributionBody(fx.enrollmentId, ['2026-10-02', '2026-10-01'], 200000),
      ).expect(201);
      expect(res.body.scheduledDates).toEqual(['2026-10-01', '2026-10-02']);
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
      expect(await count('contribution_allocations', 'contribution_id = $1', [res.body.id])).toBe(
        2,
      );
    });

    it.each([
      ['wrong amount', ['2026-10-01', '2026-10-02'], 100000],
      ['date outside enrollment', ['2026-10-31'], 100000],
      ['impossible date', ['2026-02-30'], 100000],
      ['duplicate dates', ['2026-10-01', '2026-10-01'], 200000],
    ])('rejects %s with 400 and writes nothing', async (_label, dates, amount) => {
      const res = await post('invalid', contributionBody(fx.enrollmentId, dates, amount)).expect(
        400,
      );
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(0);
      expect(await count('idempotency_records', 'collector_id = $1', [fx.collectorId])).toBe(0);
    });

    it('requires an Idempotency-Key', async () => {
      const res = await post(null, contributionBody(fx.enrollmentId, ['2026-10-01'])).expect(400);
      expect(res.body.error.message).toMatch(/Idempotency-Key/);
    });

    it('returns 409 for an already-paid date under a new key', async () => {
      await post('first', contributionBody(fx.enrollmentId, ['2026-10-03'])).expect(201);
      const res = await post('second', contributionBody(fx.enrollmentId, ['2026-10-03'])).expect(
        409,
      );
      expect(res.body.error).toMatchObject({
        code: 'SCHEDULE_DATE_ALREADY_PAID',
        details: { paidDates: ['2026-10-03'] },
      });
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
    });

    it('replays the same result for the same key and payload', async () => {
      const first = await post('replay', contributionBody(fx.enrollmentId, ['2026-10-04'])).expect(
        201,
      );
      const second = await post('replay', contributionBody(fx.enrollmentId, ['2026-10-04'])).expect(
        201,
      );
      expect(second.body.id).toBe(first.body.id);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
    });

    it('returns 409 IDEMPOTENCY_CONFLICT for the same key with a changed payload', async () => {
      await post('conflict', contributionBody(fx.enrollmentId, ['2026-10-05'])).expect(201);
      const res = await post('conflict', contributionBody(fx.enrollmentId, ['2026-10-06'])).expect(
        409,
      );
      expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
    });

    it('posts once when concurrent requests race for the same date', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          post(`race-${i}`, contributionBody(fx.enrollmentId, ['2026-10-07'])),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await count('contribution_allocations', 'enrollment_id = $1', [fx.enrollmentId])).toBe(
        1,
      );
    });

    it('returns one contribution when concurrent requests share a key', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          post('same-key-race', contributionBody(fx.enrollmentId, ['2026-10-08'])),
        ),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
    });

    it('rolls back every row when a later step in the transaction fails', async () => {
      const spy = jest
        .spyOn(app.get(IdempotencyService), 'remember')
        .mockRejectedValueOnce(new Error('simulated failure after inserts'));
      const res = await post('rollback', contributionBody(fx.enrollmentId, ['2026-10-09'])).expect(
        500,
      );
      spy.mockRestore();
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toMatch(/simulated|INSERT|stack/i);
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(0);
      expect(await count('contribution_allocations', 'enrollment_id = $1', [fx.enrollmentId])).toBe(
        0,
      );
      expect(
        await count('audit_events', "action = 'contribution.posted' AND collector_id = $1", [
          fx.collectorId,
        ]),
      ).toBe(0);
      // The same key then succeeds: nothing was half-committed.
      await post('rollback', contributionBody(fx.enrollmentId, ['2026-10-09'])).expect(201);
    });

    it('refuses UPDATE and DELETE of posted records at the database level', async () => {
      const res = await post('immutable', contributionBody(fx.enrollmentId, ['2026-10-10'])).expect(
        201,
      );
      await expect(
        db.query('UPDATE contributions SET amount_minor = 1 WHERE id = $1', [res.body.id]),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.query('DELETE FROM contribution_allocations WHERE contribution_id = $1', [res.body.id]),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.query('DELETE FROM audit_events WHERE entity_id = $1', [res.body.id]),
      ).rejects.toThrow(/append-only/);
    });

    it('exposes history and the posted record', async () => {
      const posted = await post(
        'history',
        contributionBody(fx.enrollmentId, ['2026-10-11']),
      ).expect(201);
      const history = await http()
        .get(`/api/v1/enrollments/${fx.enrollmentId}/contributions`)
        .set(bearer(fx.token))
        .expect(200);
      expect(history.body.items).toEqual([
        expect.objectContaining({ id: posted.body.id, scheduledDates: ['2026-10-11'] }),
      ]);
      await http().get(`/api/v1/contributions/${posted.body.id}`).set(bearer(fx.token)).expect(200);
    });
  });

  describe('schedule summary', () => {
    it('treats future dates as upcoming, and prepayment does not change outstanding due', async () => {
      const fx = await createFixture(app);
      const before = await summary(fx.token, fx.enrollmentId, '2026-10-10');
      expect(before).toMatchObject({
        dueDaysCount: 10,
        dueMinor: 1000000,
        outstandingDueMinor: 1000000,
        unpaidDatesCount: 10,
      });
      expect(before.unpaidDates).not.toContain('2026-10-11');

      await http()
        .post('/api/v1/contributions')
        .set(bearer(fx.token))
        .set('Idempotency-Key', 'prepay')
        .send(contributionBody(fx.enrollmentId, ['2026-10-20']))
        .expect(201);
      const after = await summary(fx.token, fx.enrollmentId, '2026-10-10');
      expect(after.recordedTotalMinor).toBe(before.recordedTotalMinor + 100000);
      expect(after.prepaidMinor).toBe(100000);
      expect(after.outstandingDueMinor).toBe(before.outstandingDueMinor);
    });

    it('rejects an invalid asOf', async () => {
      const fx = await createFixture(app);
      await http()
        .get(`/api/v1/enrollments/${fx.enrollmentId}/summary?asOf=2026-13-01`)
        .set(bearer(fx.token))
        .expect(400);
    });
  });

  describe('plan ledger', () => {
    it('lists members with balances, every contribution, and plan totals', async () => {
      const fx = await createFixture(app);
      const second = await http()
        .post('/api/v1/contributors')
        .set(bearer(fx.token))
        .send({ fullName: 'Chidi Okafor', phone: '+2348000000301' })
        .expect(201);
      const chidi = await http()
        .post('/api/v1/enrollments')
        .set(bearer(fx.token))
        .send({ contributorId: second.body.id, planId: fx.planId })
        .expect(201);

      await http()
        .post('/api/v1/contributions')
        .set(bearer(fx.token))
        .set('Idempotency-Key', 'plan-amina')
        .send(contributionBody(fx.enrollmentId, ['2026-10-01', '2026-10-02']))
        .expect(201);
      // Chidi prepays a future day; it must not reduce Amina's missed days.
      await http()
        .post('/api/v1/contributions')
        .set(bearer(fx.token))
        .set('Idempotency-Key', 'plan-chidi')
        .send(contributionBody(chidi.body.id, ['2026-10-01', '2026-10-20']))
        .expect(201);

      const totals = await http()
        .get(`/api/v1/plans/${fx.planId}/summary?asOf=2026-10-03`)
        .set(bearer(fx.token))
        .expect(200);
      expect(totals.body).toMatchObject({
        enrollmentsCount: 2,
        recordedTotalMinor: 400000,
        dueMinor: 600000,
        paidTowardDueMinor: 300000,
        outstandingDueMinor: 300000,
        prepaidMinor: 100000,
        missedDaysCount: 3,
        enrollmentsWithMissedDaysCount: 2,
      });

      const members = await http()
        .get(`/api/v1/plans/${fx.planId}/enrollments?asOf=2026-10-03`)
        .set(bearer(fx.token))
        .expect(200);
      expect(members.body.items).toHaveLength(2);
      const byName = Object.fromEntries(
        members.body.items.map((m: { contributor: { fullName: string } }) => [
          m.contributor.fullName,
          m,
        ]),
      );
      expect(byName['Amina Yusuf'].summary).toMatchObject({
        recordedTotalMinor: 200000,
        outstandingDueMinor: 100000,
      });
      expect(byName['Chidi Okafor'].summary).toMatchObject({
        recordedTotalMinor: 200000,
        prepaidMinor: 100000,
        unpaidDatesCount: 2,
      });

      const history = await http()
        .get(`/api/v1/plans/${fx.planId}/contributions?limit=1`)
        .set(bearer(fx.token))
        .expect(200);
      expect(history.body.items).toHaveLength(1);
      expect(history.body.items[0].contributor.fullName).toBe('Chidi Okafor');
      const next = await http()
        .get(`/api/v1/plans/${fx.planId}/contributions?limit=1&cursor=${history.body.nextCursor}`)
        .set(bearer(fx.token))
        .expect(200);
      expect(next.body.items[0]).toMatchObject({
        contributor: { fullName: 'Amina Yusuf' },
        scheduledDates: ['2026-10-01', '2026-10-02'],
      });
      expect(next.body.nextCursor).toBeNull();
    });

    it("hides another collector's plan and enforces scopes", async () => {
      const a = await createFixture(app);
      const b = await createFixture(app);
      for (const path of ['summary', 'enrollments', 'contributions']) {
        await http().get(`/api/v1/plans/${a.planId}/${path}`).set(bearer(b.token)).expect(404);
      }
      const { key } = await issueKey(app, a.collectorId, ['plans:read', 'contributions:read']);
      await http().get(`/api/v1/plans/${a.planId}/summary`).set(bearer(key)).expect(200);
      await http().get(`/api/v1/plans/${a.planId}/contributions`).set(bearer(key)).expect(200);
      await http().get(`/api/v1/plans/${a.planId}/enrollments`).set(bearer(key)).expect(403);
    });
  });

  describe('contribution intents (integration flow)', () => {
    let fx: Fixture;
    let key: string;

    beforeEach(async () => {
      fx = await createFixture(app);
      ({ key } = await issueKey(app, fx.collectorId));
    });

    const prepare = (credential: string, idemKey: string, dates = ['2026-10-25']) =>
      http()
        .post('/api/v1/contribution-intents')
        .set(bearer(credential))
        .set('Idempotency-Key', idemKey)
        .send(contributionBody(fx.enrollmentId, dates));
    const confirm = (credential: string, intentId: string) =>
      http().post(`/api/v1/contribution-intents/${intentId}/confirm`).set(bearer(credential));

    it('prepare has no financial effect', async () => {
      const before = await summary(fx.token, fx.enrollmentId);
      const res = await prepare(key, 'prep-only').expect(201);
      expect(res.body).toMatchObject({
        status: 'PENDING',
        contributorName: 'Amina Yusuf',
        amountMinor: 100000,
        contributionId: null,
      });
      expect(await summary(fx.token, fx.enrollmentId)).toEqual(before);
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(0);
    });

    it('replays prepare for the same key and rejects a changed payload', async () => {
      const first = await prepare(key, 'prep-replay').expect(201);
      const again = await prepare(key, 'prep-replay').expect(201);
      expect(again.body.intentId).toBe(first.body.intentId);
      const changed = await prepare(key, 'prep-replay', ['2026-10-24']).expect(409);
      expect(changed.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('confirms once; repeated and concurrent confirms return the same contribution', async () => {
      const intent = await prepare(key, 'prep-confirm').expect(201);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => confirm(key, intent.body.intentId)),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
      const ids = new Set(results.map((r) => r.body.contributionId));
      expect(ids.size).toBe(1);
      expect(results[0].body).toMatchObject({
        status: 'COMPLETED',
        verificationStatus: 'COLLECTOR_ATTESTED',
      });
      expect(results[0].body.summary.unpaidDates).not.toContain('2026-10-25');
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);

      const status = await http()
        .get(`/api/v1/contribution-intents/${intent.body.intentId}`)
        .set(bearer(key))
        .expect(200);
      expect(status.body).toMatchObject({ status: 'COMPLETED', contributionId: [...ids][0] });
    });

    it('returns 410 for an expired intent and posts nothing', async () => {
      const intent = await prepare(key, 'prep-expire').expect(201);
      await db.query(
        "UPDATE contribution_intents SET expires_at = now() - interval '1 second' WHERE id = $1",
        [intent.body.intentId],
      );
      const res = await confirm(key, intent.body.intentId).expect(410);
      expect(res.body.error.code).toBe('INTENT_EXPIRED');
      const rows: { status: string }[] = await db.query(
        'SELECT status FROM contribution_intents WHERE id = $1',
        [intent.body.intentId],
      );
      expect(rows[0].status).toBe('EXPIRED');
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(0);
    });

    it('returns 409 for a cancelled intent', async () => {
      const intent = await prepare(key, 'prep-cancel').expect(201);
      await db.query("UPDATE contribution_intents SET status = 'CANCELLED' WHERE id = $1", [
        intent.body.intentId,
      ]);
      const res = await confirm(key, intent.body.intentId).expect(409);
      expect(res.body.error.code).toBe('INTENT_ALREADY_CANCELLED');
    });

    it('rejects confirmation from a different credential of the same collector', async () => {
      const { key: other } = await issueKey(app, fx.collectorId);
      const intent = await prepare(key, 'prep-wrong-cred').expect(201);
      const res = await confirm(other, intent.body.intentId).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      await confirm(fx.token, intent.body.intentId).expect(403);
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(0);
    });

    it('requires the confirm scope', async () => {
      const { key: prepOnly } = await issueKey(app, fx.collectorId, ['contributions:prepare']);
      const intent = await prepare(prepOnly, 'prep-no-confirm').expect(201);
      await confirm(prepOnly, intent.body.intentId).expect(403);
    });

    it('re-checks paid dates at commit and leaves the intent pending on conflict', async () => {
      const intent = await prepare(key, 'prep-stale').expect(201);
      await http()
        .post('/api/v1/contributions')
        .set(bearer(fx.token))
        .set('Idempotency-Key', 'dashboard-wins')
        .send(contributionBody(fx.enrollmentId, ['2026-10-25']))
        .expect(201);
      const res = await confirm(key, intent.body.intentId).expect(409);
      expect(res.body.error.code).toBe('SCHEDULE_DATE_ALREADY_PAID');
      const status = await http()
        .get(`/api/v1/contribution-intents/${intent.body.intentId}`)
        .set(bearer(key))
        .expect(200);
      expect(status.body.status).toBe('PENDING');
      expect(await count('contributions', 'enrollment_id = $1', [fx.enrollmentId])).toBe(1);
    });

    it('rejects preparing an already-paid date', async () => {
      await http()
        .post('/api/v1/contributions')
        .set(bearer(fx.token))
        .set('Idempotency-Key', 'paid-first')
        .send(contributionBody(fx.enrollmentId, ['2026-10-24']))
        .expect(201);
      const res = await prepare(key, 'prep-paid', ['2026-10-24']).expect(409);
      expect(res.body.error.code).toBe('SCHEDULE_DATE_ALREADY_PAID');
    });
  });
});
