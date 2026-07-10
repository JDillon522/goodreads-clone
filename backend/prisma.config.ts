import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../.env') });

const databaseUrl =
  process.env.DATABASE_URL ??
  databaseUrlFromParts({
    database: process.env.POSTGRES_DB,
    schema: process.env.POSTGRES_SCHEMA,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_HOST_PORT,
  });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: databaseUrl,
  },
});

function databaseUrlFromParts({
  database,
  schema = 'public',
  user,
  password,
  host = 'localhost',
  port = '5432',
}: {
  database?: string;
  schema?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: string;
}): string {
  if (!database || !user || !password) {
    throw new Error(
      'DATABASE_URL or POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD must be set in .env.',
    );
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=${encodeURIComponent(schema)}`;
}
