# Bookshelf Backend

Nest.js API for the Bookshelf full-stack reading tracker.

## Local Development

```bash
npm install
npm run dev:backend
```

The backend listens on `http://localhost:3000` by default.

## API Surfaces

- Health check: `GET /api/health`
- Readiness check: `GET /api/health/ready`
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`

Swagger is the backend contract testing surface before frontend work. It uses stable operation IDs, keeps bearer auth between requests, and groups endpoints by product area.

## Database

Prisma is the database ORM and migration tool. The schema lives in `backend/prisma/schema.prisma`.

Useful root commands:

```bash
npm run db:generate
npm run db:migrate:dev -- --name your_migration_name
npm run db:migrate:deploy
npm run db:seed
```

The seed script loads `data/sample-books.json`, creates the sample book records, and creates a reusable demo guest session with shelves, library items, progress, and a reading goal.

## Docker

```bash
npm run docker:up
```

The default `docker compose up` command automatically merges `docker-compose.yml` with `docker-compose.override.yml`, so local development uses the Dockerfile `development` target, bind mounts the repo, and runs Nest in watch mode.

For the production-style Compose file only:

```bash
npm run docker:up:prod
```

The Compose stack starts Postgres and the backend. The local development database URL is declared in `backend/.env.docker`.
Postgres is exposed only inside the Compose network; the backend reaches it at the `db` service hostname.

Note: local Docker builds use a scoped `NODE_TLS_REJECT_UNAUTHORIZED=0` only for `prisma generate` because this machine's network presents a self-signed certificate chain for Prisma engine downloads. That setting is not applied to runtime.
