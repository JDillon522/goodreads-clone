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
- Signup: `POST /api/auth/signup`
- Signin: `POST /api/auth/signin`
- Current user: `GET /api/auth/me`
- Refresh session: `POST /api/auth/refresh`
- Signout: `POST /api/auth/signout`
- Password reset request: `POST /api/auth/password-reset/request`
- Password reset confirm: `POST /api/auth/password-reset/confirm`
- Book search: `GET /api/books/search?query=kindred&page=1&limit=10`
- Open Library detail: `GET /api/books/open-library/works/OL123W` or `GET /api/books/open-library/books/OL123M`
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`

Swagger is the backend contract testing surface before frontend work. It uses stable operation IDs, keeps bearer auth between requests, and groups endpoints by product area.

Auth uses short-lived JWT access tokens and opaque refresh tokens stored as hashes in Postgres. In development and test, password reset requests return the reset token in the JSON response so the flow can be tested directly from Swagger. Production hides that token; real email delivery can be added later.

Book search is public. Open Library calls are normalized into app-owned DTOs and cached in `ExternalBookCache`. Missing provider data stays nullable; the frontend owns visual fallbacks like placeholder covers.

Open Library settings:

```bash
OPEN_LIBRARY_BASE_URL=https://openlibrary.org
OPEN_LIBRARY_USER_AGENT="Bookshelf/0.1.0 (local development; contact: local@example.com)"
OPEN_LIBRARY_SEARCH_CACHE_TTL_HOURS=24
OPEN_LIBRARY_DETAIL_CACHE_TTL_HOURS=168
OPEN_LIBRARY_REQUEST_TIMEOUT_MS=8000
```

If local Open Library requests fail with `SELF_SIGNED_CERT_IN_CHAIN`, the machine/network is intercepting HTTPS with an untrusted local certificate. Put the trusted CA at `certs/local-ca.pem`; `npm run dev:backend` and `npm run docker:up` will automatically set `NODE_EXTRA_CA_CERTS` for backend startup. Direct `docker compose up` also points the backend at `/app/certs/local-ca.pem` through the development override. You can still override the path manually with `NODE_EXTRA_CA_CERTS=/path/to/local-ca.pem`. Do not make `NODE_TLS_REJECT_UNAUTHORIZED=0` a runtime default.

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
