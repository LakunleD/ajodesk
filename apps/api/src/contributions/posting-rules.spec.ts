import { AppError } from '../common/errors';
import type { Enrollment } from '../enrollments/enrollment.entity';
import type { SavingsPlan } from '../plans/savings-plan.entity';
import {
  assertPostable,
  contributionRequestHash,
  normalizeScheduledDates,
  requireIdempotencyKey,
} from './posting-rules';

const enrollment = {
  status: 'ACTIVE',
  startOn: '2026-10-01',
  endOn: '2026-10-30',
} as Enrollment;
const plan = { status: 'ACTIVE', dailyAmountMinor: 100000 } as SavingsPlan;

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  return undefined;
}

describe('posting rules', () => {
  it('hash ignores date order but not values', () => {
    const a = contributionRequestHash({
      enrollmentId: 'ABC',
      scheduledDates: ['2026-10-02', '2026-10-01'],
      amountMinor: 200000,
      currency: 'NGN',
      paymentMethod: 'CASH',
    });
    const b = contributionRequestHash({
      enrollmentId: 'abc',
      scheduledDates: ['2026-10-01', '2026-10-02'],
      amountMinor: 200000,
      currency: 'NGN',
      paymentMethod: 'CASH',
    });
    const c = contributionRequestHash({
      enrollmentId: 'abc',
      scheduledDates: ['2026-10-01', '2026-10-03'],
      amountMinor: 200000,
      currency: 'NGN',
      paymentMethod: 'CASH',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('sorts dates and rejects duplicates', () => {
    expect(normalizeScheduledDates(['2026-10-03', '2026-10-01'])).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);
    expect(codeOf(() => normalizeScheduledDates(['2026-10-01', '2026-10-01']))).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('requires amount = daily × days', () => {
    expect(
      codeOf(() => assertPostable(enrollment, plan, ['2026-10-01', '2026-10-02'], 200000)),
    ).toBe(undefined);
    expect(
      codeOf(() => assertPostable(enrollment, plan, ['2026-10-01', '2026-10-02'], 100000)),
    ).toBe('VALIDATION_ERROR');
  });

  it('rejects dates outside the enrollment and inactive records', () => {
    expect(codeOf(() => assertPostable(enrollment, plan, ['2026-10-31'], 100000))).toBe(
      'VALIDATION_ERROR',
    );
    expect(
      codeOf(() =>
        assertPostable({ ...enrollment, status: 'CLOSED' }, plan, ['2026-10-01'], 100000),
      ),
    ).toBe('VALIDATION_ERROR');
  });

  it('validates idempotency keys and reserves colons', () => {
    expect(requireIdempotencyKey('dashboard-collection-001')).toBe('dashboard-collection-001');
    expect(codeOf(() => requireIdempotencyKey(undefined))).toBe('VALIDATION_ERROR');
    expect(codeOf(() => requireIdempotencyKey('intent:123'))).toBe('VALIDATION_ERROR');
  });
});
