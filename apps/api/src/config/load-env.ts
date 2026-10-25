import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads the nearest .env (apps/api or repository root) for host-side development.
 * Existing environment variables win, so containers and CI are unaffected.
 */
export function loadDotEnv(): void {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}
