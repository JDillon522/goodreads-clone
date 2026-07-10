import * as Joi from 'joi';

/**
 * Validates and normalizes environment variables before Nest modules read configuration values.
 */
type Environment = {
  API_PREFIX: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  GUEST_SESSION_TTL_DAYS: number;
  GOOGLE_BOOKS_API_KEY?: string;
  GOOGLE_BOOKS_BASE_URL: string;
  GOOGLE_BOOKS_REQUEST_TIMEOUT_MS: number;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  NODE_ENV: 'development' | 'test' | 'production';
  OPEN_LIBRARY_BASE_URL: string;
  OPEN_LIBRARY_DETAIL_CACHE_TTL_HOURS: number;
  OPEN_LIBRARY_REQUEST_TIMEOUT_MS: number;
  OPEN_LIBRARY_SEARCH_CACHE_TTL_HOURS: number;
  OPEN_LIBRARY_USER_AGENT: string;
  PASSWORD_RESET_TOKEN_TTL_MINUTES: number;
  PORT: number;
};

const devAccessSecret = 'dev-only-access-secret-replace-before-deploy';
const devRefreshSecret = 'dev-only-refresh-secret-replace-before-deploy';

const environmentSchema = Joi.object<Environment>({
  API_PREFIX: Joi.string().trim().default('api'),
  CORS_ORIGIN: Joi.string().trim().allow('').default('http://localhost:4200'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  GUEST_SESSION_TTL_DAYS: Joi.number().integer().positive().default(7),
  GOOGLE_BOOKS_API_KEY: Joi.string().trim().allow('').optional(),
  GOOGLE_BOOKS_BASE_URL: Joi.string().uri().default('https://www.googleapis.com/books/v1'),
  GOOGLE_BOOKS_REQUEST_TIMEOUT_MS: Joi.number().integer().positive().default(8000),
  JWT_ACCESS_SECRET: Joi.string().min(32).default(devAccessSecret),
  JWT_REFRESH_SECRET: Joi.string().min(32).default(devRefreshSecret),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  OPEN_LIBRARY_BASE_URL: Joi.string().uri().default('https://openlibrary.org'),
  OPEN_LIBRARY_DETAIL_CACHE_TTL_HOURS: Joi.number().integer().positive().default(168),
  OPEN_LIBRARY_REQUEST_TIMEOUT_MS: Joi.number().integer().positive().default(8000),
  OPEN_LIBRARY_SEARCH_CACHE_TTL_HOURS: Joi.number().integer().positive().default(24),
  OPEN_LIBRARY_USER_AGENT: Joi.string()
    .trim()
    .min(10)
    .default('Bookshelf/0.1.0 (local development; contact: local@example.com)'),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number().integer().positive().default(30),
  PORT: Joi.number().port().default(3000),
}).unknown(true);
/**
 * Applies defaults, coerces numeric values, and blocks unsafe production JWT secrets.
 */
export function validateEnvironment(config: Record<string, unknown>): Environment {
  const hydratedConfig = {
    ...config,
    DATABASE_URL: config['DATABASE_URL'] ?? databaseUrlFromParts(config),
  };

  const { error, value } = environmentSchema.validate(hydratedConfig, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
  }

  const environment = value;

  if (environment.NODE_ENV === 'production') {
    const usesDevelopmentSecret =
      environment.JWT_ACCESS_SECRET === devAccessSecret ||
      environment.JWT_REFRESH_SECRET === devRefreshSecret ||
      environment.JWT_ACCESS_SECRET.startsWith('replace-with-') ||
      environment.JWT_REFRESH_SECRET.startsWith('replace-with-');

    if (usesDevelopmentSecret) {
      throw new Error('Production JWT secrets must be explicitly configured.');
    }
  }

  return environment;
}

/**
 * Builds the local host database URL from the root .env POSTGRES_* values when DATABASE_URL is not
 * provided directly.
 */
function databaseUrlFromParts(config: Record<string, unknown>): string | undefined {
  const database = stringValue(config['POSTGRES_DB']);
  const schema = stringValue(config['POSTGRES_SCHEMA']) ?? 'public';
  const user = stringValue(config['POSTGRES_USER']);
  const password = stringValue(config['POSTGRES_PASSWORD']);
  const host = stringValue(config['POSTGRES_HOST']) ?? 'localhost';
  const port = stringValue(config['POSTGRES_HOST_PORT']) ?? '5432';

  if (!database || !user || !password) {
    return undefined;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);
  const encodedSchema = encodeURIComponent(schema);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}?schema=${encodedSchema}`;
}

/**
 * Narrows environment-like values to non-empty strings.
 */
function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
