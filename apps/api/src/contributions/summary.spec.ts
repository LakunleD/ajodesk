import { aggregatePlanSummary, computeEnrollmentSummary, SummaryInput } from './summary';

const base: SummaryInput = {
  enrollmentId: 'e1',
  startOn: '2026-10-01',
  endOn: '2026-10-30',
  dailyAmountMinor: 100000,
  asOf: '2026-10-03',
  allocations: [],
};

describe('computeEnrollmentSummary', () => {
  it('keeps recorded, due, outstanding and prepaid distinct (DATABASE.md §4 example)', () => {
    const summary = computeEnrollmentSummary({
      ...base,
      allocations: [
        { scheduledOn: '2026-10-01', amountMinor: 100000 },
        { scheduledOn: '2026-10-02', amountMinor: 100000 },
        { scheduledOn: '2026-10-10', amountMinor: 100000 },
      ],
    });
    expect(summary).toMatchObject({
      recordedTotalMinor: 300000,
      dueMinor: 300000,
      paidTowardDueMinor: 200000,
      outstandingDueMinor: 100000,
      prepaidMinor: 100000,
      unpaidDates: ['2026-10-03'],
      unpaidDatesCount: 1,
      paidDates: ['2026-10-01', '2026-10-02', '2026-10-10'],
      dueDaysCount: 3,
      eligibleDaysCount: 30,
      upcomingUnpaidDatesCount: 26,
    });
  });

  it('never treats future dates as overdue', () => {
    const summary = computeEnrollmentSummary({ ...base, asOf: '2026-09-15' });
    expect(summary.dueMinor).toBe(0);
    expect(summary.unpaidDates).toEqual([]);
    expect(summary.outstandingDueMinor).toBe(0);
  });

  it('prepaying a future date raises recorded total but leaves outstanding unchanged', () => {
    const before = computeEnrollmentSummary(base);
    const after = computeEnrollmentSummary({
      ...base,
      allocations: [{ scheduledOn: '2026-10-20', amountMinor: 100000 }],
    });
    expect(after.recordedTotalMinor - before.recordedTotalMinor).toBe(100000);
    expect(after.outstandingDueMinor).toBe(before.outstandingDueMinor);
    expect(after.prepaidMinor).toBe(100000);
  });

  it('caps due days at the enrollment end', () => {
    const summary = computeEnrollmentSummary({ ...base, asOf: '2026-12-01' });
    expect(summary.dueDaysCount).toBe(30);
    expect(summary.dueMinor).toBe(3000000);
    expect(summary.unpaidDatesCount).toBe(30);
  });
});

describe('aggregatePlanSummary', () => {
  it('sums per-enrollment figures; one member prepaying does not cover another member', () => {
    const ahead = computeEnrollmentSummary({
      ...base,
      enrollmentId: 'ahead',
      allocations: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((scheduledOn) => ({
        scheduledOn,
        amountMinor: 100000,
      })),
    });
    const behind = computeEnrollmentSummary({ ...base, enrollmentId: 'behind' });
    const plan = aggregatePlanSummary({ id: 'p', dailyAmountMinor: 100000 }, base.asOf, [
      { status: 'ACTIVE', summary: ahead },
      { status: 'CLOSED', summary: behind },
    ]);
    expect(plan).toMatchObject({
      enrollmentsCount: 2,
      activeEnrollmentsCount: 1,
      recordedTotalMinor: 400000,
      dueMinor: 600000,
      paidTowardDueMinor: 300000,
      prepaidMinor: 100000,
      outstandingDueMinor: 300000,
      missedDaysCount: 3,
      enrollmentsWithMissedDaysCount: 1,
    });
  });
});
