import type { ValueTransformer } from 'typeorm';

export const CURRENCY = 'NGN' as const;
export type Currency = typeof CURRENCY;

/** Maps PostgreSQL bigint (returned as string) to a safe JS integer number of kobo. */
export const bigintKobo: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) => {
    if (value === null || value === undefined) return value;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error('Monetary value exceeds safe integer range');
    return parsed;
  },
};
