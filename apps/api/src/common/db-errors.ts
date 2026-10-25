import { QueryFailedError } from 'typeorm';

interface PgDriverError {
  code?: string;
  constraint?: string;
}

/** Returns the violated constraint name when the error is a PostgreSQL unique violation. */
export function uniqueViolation(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driverError = error.driverError as PgDriverError;
  return driverError.code === '23505' ? (driverError.constraint ?? '') : null;
}

const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  '08000',
  '08003',
  '08006',
]);

/** True when the error indicates the database is unreachable rather than a query bug. */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: string; driverError?: { code?: string }; message?: string };
  const code = candidate.driverError?.code ?? candidate.code;
  if (code && UNAVAILABLE_CODES.has(code)) return true;
  return /Connection terminated|connect ECONNREFUSED|timeout exceeded when trying to connect/i.test(
    candidate.message ?? '',
  );
}
