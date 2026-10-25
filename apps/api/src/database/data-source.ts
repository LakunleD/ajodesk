import 'reflect-metadata';
import { loadDotEnv } from '../config/load-env';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm-options';

loadDotEnv();

/** Used by the TypeORM CLI (`npm run migration:run`). */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run migrations');
}

export default new DataSource(buildDataSourceOptions(process.env.DATABASE_URL));
