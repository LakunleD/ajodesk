import { types } from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

// Keep PostgreSQL `date` values as plain YYYY-MM-DD strings; never shift them through local time.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
    migrationsRun: false,
    // Not 'error': failed-query logs include parameters, which can carry personal data.
    logging: ['warn', 'migration'],
    // Hosted Postgres (e.g. Neon) may need a few seconds to wake a suspended compute.
    extra: { max: 10, connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000) },
  };
}
