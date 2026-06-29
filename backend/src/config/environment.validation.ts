import * as Joi from 'joi';

type Environment = {
  API_PREFIX: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  NODE_ENV: 'development' | 'test' | 'production';
  PASSWORD_RESET_TOKEN_TTL_MINUTES: number;
  PORT: number;
};

const defaultDatabaseUrl =
  'postgresql://bookshelf:bookshelf@localhost:5432/bookshelf?schema=public';
const devAccessSecret = 'dev-only-access-secret-replace-before-deploy';
const devRefreshSecret = 'dev-only-refresh-secret-replace-before-deploy';

const environmentSchema = Joi.object<Environment>({
  API_PREFIX: Joi.string().trim().default('api'),
  CORS_ORIGIN: Joi.string().trim().allow('').default('http://localhost:4200'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .default(defaultDatabaseUrl),
  JWT_ACCESS_SECRET: Joi.string().min(32).default(devAccessSecret),
  JWT_REFRESH_SECRET: Joi.string().min(32).default(devRefreshSecret),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number().integer().positive().default(30),
  PORT: Joi.number().port().default(3000),
}).unknown(true);

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const { error, value } = environmentSchema.validate(config, {
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
