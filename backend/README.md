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
- Guest session: `POST /api/guest/session`
- Book search: `GET /api/books/search?query=kindred&page=1&limit=10`
- Open Library detail: `GET /api/books/open-library/works/OL123W` or `GET /api/books/open-library/books/OL123M`
- Shelves: `GET /api/shelves`, `POST /api/shelves`, `PATCH /api/shelves/:id`, `DELETE /api/shelves/:id`, `PUT /api/shelves/order`
- Library: `GET /api/library`, `POST /api/library`, `GET /api/library/:id`, `PATCH /api/library/:id`, `DELETE /api/library/:id`
- Library movement/progress: `PATCH /api/library/:id/shelf`, `POST /api/library/:id/progress`
- Reading goals: `GET /api/goals/current`, `GET /api/goals/:year`, `PUT /api/goals/:year`
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`

Swagger is the backend contract testing surface before frontend work. It uses stable operation IDs, keeps bearer auth between requests, and groups endpoints by product area.

Auth uses short-lived JWT access tokens and opaque refresh tokens stored as hashes in Postgres. In development and test, password reset requests return the reset token in the JSON response so the flow can be tested directly from Swagger. Production hides that token; real email delivery can be added later.

Book search is public. Open Library calls are normalized into app-owned DTOs, cached in `ExternalBookCache`, and persisted into shared `Book` rows for long-term use. Persisted books are enriched from Google Books when possible; Google sync runs for pending or failed rows on backend startup, when a user opens a saved book detail page, and when a user adds a book to a shelf. Google sync status, volume id, raw payload, and errors stay on the `Book` row so provider failures can be inspected later. Missing provider data stays nullable; the frontend owns visual fallbacks like placeholder covers.

Shelves, library items, progress, ratings, notes, and goals require bearer auth. These routes accept either a signed-in user access token or a guest token from `POST /api/guest/session`. Library add uses a normalized book DTO from search/detail, upserts the app-owned book record, rejects owner-scoped duplicates, creates a single shelf assignment, and emits activity events for meaningful actions.

Guest sessions are temporary, session-scoped demo libraries. A guest token expires after `GUEST_SESSION_TTL_DAYS` days, defaulting to 7. Expired tokens are rejected immediately. Deleting expired `GuestSession` records cascades guest shelves, library items, progress entries, goals, preferences, and activity events; shared `Book` records remain.

Runtime settings:

```bash
GUEST_SESSION_TTL_DAYS=7
GOOGLE_BOOKS_API_KEY=
GOOGLE_BOOKS_BASE_URL=https://www.googleapis.com/books/v1
GOOGLE_BOOKS_REQUEST_TIMEOUT_MS=8000
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
npm run test:e2e:backend
```

The seed script loads `data/sample-books.json`, creates the sample book records, and creates a reusable demo guest session with shelves, library items, progress, and a reading goal.
The e2e command expects the local Docker backend and database to be running; it uses the HTTP API and cleans up its temporary users and guest sessions afterward.

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
The backend reaches Postgres at the `db` service hostname inside the Compose network. In local development, `docker-compose.override.yml` also exposes Postgres on `127.0.0.1:5433` for tools like PGAdmin; the production-style Compose file keeps the database internal.

Note: local Docker builds use a scoped `NODE_TLS_REJECT_UNAUTHORIZED=0` only for `prisma generate` because this machine's network presents a self-signed certificate chain for Prisma engine downloads. That setting is not applied to runtime.
