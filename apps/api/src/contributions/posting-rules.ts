import { createHash } from 'node:crypto';
import { AppError } from '../common/errors';
import type { Enrollment } from '../enrollments/enrollment.entity';
import type { SavingsPlan } from '../plans/savings-plan.entity';
import type { ContributionRequestDto } from './contributions.dto';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.-]{1,128}$/;

/** Validates the client-supplied `Idempotency-Key` header. Colons are reserved for internal keys. */
export function requireIdempotencyKey(header: string | undefined): string {
  if (!header) throw AppError.validation('Idempotency-Key header is required for this operation');
  if (!IDEMPOTENCY_KEY.test(header)) {
    throw AppError.validation('Idempotency-Key must be 1-128 characters of A-Z a-z 0-9 _ . -');
  }
  return header;
}

/** Rejects duplicate dates and returns them in ascending order. */
export function normalizeScheduledDates(dates: string[]): string[] {
  const unique = new Set(dates);
  if (unique.size !== dates.length) {
    throw AppError.validation('scheduledDates must not contain duplicates');
  }
  return [...unique].sort();
}

/** Canonical SHA-256 over normalized fields, independent of JSON key order or date order. */
export function contributionRequestHash(request: ContributionRequestDto): string {
  const canonical = [
    request.enrollmentId.toLowerCase(),
    [...request.scheduledDates].sort().join(','),
    String(request.amountMinor),
    request.currency,
    request.paymentMethod,
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Posting invariants 2–5 (docs/DATABASE.md §3): active enrollment and plan, dates within
 * the enrollment, and amount == daily amount × days. Ownership is checked by the caller's
 * collector-scoped lookup; unpaid status is checked against the database.
 */
export function assertPostable(
  enrollment: Enrollment,
  plan: SavingsPlan,
  sortedDates: string[],
  amountMinor: number,
): void {
  if (enrollment.status !== 'ACTIVE') throw AppError.validation('Enrollment is not active');
  if (plan.status !== 'ACTIVE') throw AppError.validation('Plan is not active');

  const outOfRange = sortedDates.filter(
    (date) => date < enrollment.startOn || date > enrollment.endOn,
  );
  if (outOfRange.length > 0) {
    throw AppError.validation('scheduledDates fall outside the enrollment schedule', {
      outOfRangeDates: outOfRange,
      enrollmentStartOn: enrollment.startOn,
      enrollmentEndOn: enrollment.endOn,
    });
  }

  const expectedAmountMinor = plan.dailyAmountMinor * sortedDates.length;
  if (amountMinor !== expectedAmountMinor) {
    throw AppError.validation('amountMinor does not equal daily amount × number of dates', {
      expectedAmountMinor,
      dailyAmountMinor: plan.dailyAmountMinor,
      dateCount: sortedDates.length,
    });
  }
}

export function alreadyPaid(dates: string[]): AppError {
  return AppError.conflict(
    'SCHEDULE_DATE_ALREADY_PAID',
    'One or more scheduled dates are already paid',
    { paidDates: dates },
  );
}
