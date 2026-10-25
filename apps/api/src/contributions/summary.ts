import { dateRange } from '../common/dates';

export interface SummaryInput {
  enrollmentId: string;
  startOn: string;
  endOn: string;
  dailyAmountMinor: number;
  asOf: string;
  allocations: { scheduledOn: string; amountMinor: number }[];
}

export interface EnrollmentSummary {
  enrollmentId: string;
  currency: 'NGN';
  dailyAmountMinor: number;
  asOf: string;
  startOn: string;
  endOn: string;
  eligibleDaysCount: number;
  dueDaysCount: number;
  paidDaysCount: number;
  /** Every scheduled date with a posted allocation, ascending (due or prepaid). */
  paidDates: string[];
  /** All posted allocations, including future prepayments. */
  recordedTotalMinor: number;
  /** Due-to-date expectation: due days × daily amount. */
  dueMinor: number;
  paidTowardDueMinor: number;
  outstandingDueMinor: number;
  /** Allocations for dates after asOf. */
  prepaidMinor: number;
  unpaidDatesCount: number;
  /** Due dates (≤ asOf) with no allocation. Future dates are never overdue. */
  unpaidDates: string[];
  /** Future scheduled dates not yet paid. */
  upcomingUnpaidDatesCount: number;
  verificationStatus: 'COLLECTOR_ATTESTED';
}

/** Pure schedule/balance computation; see docs/DATABASE.md §4. Never conflates the totals. */
export function computeEnrollmentSummary(input: SummaryInput): EnrollmentSummary {
  const eligible = dateRange(input.startOn, input.endOn);
  const due = eligible.filter((date) => date <= input.asOf);
  const paid = new Map(input.allocations.map((a) => [a.scheduledOn, a.amountMinor]));

  let recordedTotalMinor = 0;
  let paidTowardDueMinor = 0;
  let prepaidMinor = 0;
  for (const allocation of input.allocations) {
    recordedTotalMinor += allocation.amountMinor;
    if (allocation.scheduledOn <= input.asOf) paidTowardDueMinor += allocation.amountMinor;
    else prepaidMinor += allocation.amountMinor;
  }

  const dueMinor = due.length * input.dailyAmountMinor;
  const unpaidDates = due.filter((date) => !paid.has(date));
  const upcomingUnpaid = eligible.filter((date) => date > input.asOf && !paid.has(date));

  return {
    enrollmentId: input.enrollmentId,
    currency: 'NGN',
    dailyAmountMinor: input.dailyAmountMinor,
    asOf: input.asOf,
    startOn: input.startOn,
    endOn: input.endOn,
    eligibleDaysCount: eligible.length,
    dueDaysCount: due.length,
    paidDaysCount: paid.size,
    paidDates: [...paid.keys()].sort(),
    recordedTotalMinor,
    dueMinor,
    paidTowardDueMinor,
    outstandingDueMinor: Math.max(0, dueMinor - paidTowardDueMinor),
    prepaidMinor,
    unpaidDatesCount: unpaidDates.length,
    unpaidDates,
    upcomingUnpaidDatesCount: upcomingUnpaid.length,
    verificationStatus: 'COLLECTOR_ATTESTED',
  };
}

export interface PlanSummary {
  planId: string;
  currency: 'NGN';
  dailyAmountMinor: number;
  asOf: string;
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  recordedTotalMinor: number;
  dueMinor: number;
  paidTowardDueMinor: number;
  outstandingDueMinor: number;
  prepaidMinor: number;
  /** Enrollments with at least one missed (due, unpaid) day as of asOf. */
  enrollmentsWithMissedDaysCount: number;
  missedDaysCount: number;
  verificationStatus: 'COLLECTOR_ATTESTED';
}

/**
 * Plan totals are the sum of per-enrollment summaries, so a prepayment by one contributor
 * never offsets another contributor's missed days.
 */
export function aggregatePlanSummary(
  plan: { id: string; dailyAmountMinor: number },
  asOf: string,
  enrollments: { status: string; summary: EnrollmentSummary }[],
): PlanSummary {
  const total: PlanSummary = {
    planId: plan.id,
    currency: 'NGN',
    dailyAmountMinor: plan.dailyAmountMinor,
    asOf,
    enrollmentsCount: enrollments.length,
    activeEnrollmentsCount: enrollments.filter((e) => e.status === 'ACTIVE').length,
    recordedTotalMinor: 0,
    dueMinor: 0,
    paidTowardDueMinor: 0,
    outstandingDueMinor: 0,
    prepaidMinor: 0,
    enrollmentsWithMissedDaysCount: 0,
    missedDaysCount: 0,
    verificationStatus: 'COLLECTOR_ATTESTED',
  };
  for (const { summary } of enrollments) {
    total.recordedTotalMinor += summary.recordedTotalMinor;
    total.dueMinor += summary.dueMinor;
    total.paidTowardDueMinor += summary.paidTowardDueMinor;
    total.outstandingDueMinor += summary.outstandingDueMinor;
    total.prepaidMinor += summary.prepaidMinor;
    total.missedDaysCount += summary.unpaidDatesCount;
    if (summary.unpaidDatesCount > 0) total.enrollmentsWithMissedDaysCount += 1;
  }
  return total;
}
