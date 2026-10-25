export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  integrationKeyPepper: string;
  intentTtlMinutes: number;
  corsOrigins: string[];
  authRateLimit: number;
  trustProxy: boolean;
  enableDocs: boolean;
}

function required(env: NodeJS.ProcessEnv, name: string, minLength = 1): string {
  const value = env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      minLength > 1
        ? `Environment variable ${name} is required and must be at least ${minLength} characters`
        : `Environment variable ${name} is required`,
    );
  }
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return value;
}

/** Reads and validates process environment once at boot; fails fast on missing secrets. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: integer(env, 'API_PORT', integer(env, 'PORT', 3001)),
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET', 32),
    jwtExpiresInSeconds: integer(env, 'JWT_EXPIRES_IN_SECONDS', 3600),
    integrationKeyPepper: required(env, 'INTEGRATION_KEY_PEPPER', 32),
    intentTtlMinutes: integer(env, 'INTENT_TTL_MINUTES', 15),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    authRateLimit: integer(env, 'AUTH_RATE_LIMIT_PER_MINUTE', 10),
    trustProxy: env.TRUST_PROXY === 'true',
    enableDocs: env.ENABLE_API_DOCS !== 'false',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
