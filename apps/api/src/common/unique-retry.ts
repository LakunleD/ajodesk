import { uniqueViolation } from './db-errors';

/**
 * Runs `fn` again once when it fails on one of the named unique constraints. Used where two
 * concurrent requests race to insert the same idempotency row: the retry observes the
 * committed winner and returns a replay or a conflict instead of a 500.
 */
export async function retryOnUniqueViolation<T>(
  constraints: readonly string[],
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const constraint = uniqueViolation(error);
    if (constraint !== null && constraints.includes(constraint)) return fn();
    throw error;
  }
}
