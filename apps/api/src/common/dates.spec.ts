import { addDays, dateRange, daysInclusive, isDateOnly, todayInLagos } from './dates';

describe('dates', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isDateOnly('2026-10-25')).toBe(true);
    expect(isDateOnly('2026-02-29')).toBe(false);
    expect(isDateOnly('2028-02-29')).toBe(true);
    expect(isDateOnly('2026-10-25T00:00:00Z')).toBe(false);
    expect(isDateOnly('2026-1-5')).toBe(false);
    expect(isDateOnly(20261025)).toBe(false);
  });

  it('computes Lagos calendar date (UTC+1) across the UTC midnight boundary', () => {
    expect(todayInLagos(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25');
    expect(todayInLagos(new Date('2026-10-24T22:59:59Z'))).toBe('2026-10-24');
  });

  it('builds inclusive ranges across month boundaries', () => {
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
    expect(daysInclusive('2026-10-01', '2026-10-30')).toBe(30);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
