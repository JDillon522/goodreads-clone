# Bookshelf Backend

Nest.js API for the Bookshelf full-stack reading tracker.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev:backend
```

Run those commands from the repo root. The backend reads runtime config from the root `.env`; there are no backend-local env files. The backend listens on `http://localhost:3000` by default.

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
- Book search: `GET /api/books/search?query=kindred&page=1&limit=10&orderBy=relevance&printType=books`
- Google info detail: `GET /api/books/google/GOOGLE_VOLUME_ID`
- Shelves: `GET /api/shelves`, `POST /api/shelves`, `PATCH /api/shelves/:id`, `DELETE /api/shelves/:id`, `PUT /api/shelves/order`
- Library: `GET /api/library`, `POST /api/library`, `GET /api/library/:id`, `PATCH /api/library/:id`, `DELETE /api/library/:id`
- Library movement/progress: `PATCH /api/library/:id/shelf`, `POST /api/library/:id/progress`
- Shelf-photo analysis: `POST /api/bookshelf-scans/analyze`, `GET /api/bookshelf-scans/search`
- Saved shelf photos: `GET|POST /api/bookshelf-photos`, detail/image/thumbnail/rename/delete routes,
  and `PATCH /api/bookshelf-photos/:photoId/detections/:detectionId`
- Reading goals: `GET /api/goals/current`, `GET /api/goals/:year`, `PUT /api/goals/:year`
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`

Swagger is the backend contract testing surface before frontend work. It uses stable operation IDs, keeps bearer auth between requests, and groups endpoints by product area.

Auth uses short-lived JWT access tokens and opaque refresh tokens stored as hashes in Postgres. In development and test, password reset requests return the reset token in the JSON response so the flow can be tested directly from Swagger. Production hides that token; real email delivery can be added later.

Book search is public and Google Books is the sole metadata provider. Search uses Google-native pagination and controls and persists raw Google volumes into reusable `Book` cache rows. Related-book candidate searches, series detection, external links, covers, and theme palettes all use the same Google-backed cache. Google sync status, volume id, raw payload, and errors stay on the `Book` row so provider failures can be inspected later. Missing provider data stays nullable; the frontend owns visual fallbacks like placeholder covers.

Shelves, library items, progress, ratings, notes, and goals require bearer auth. These routes accept either a signed-in user access token or a guest token from `POST /api/guest/session`. Library add requires at least one ISBN, stores ISBNs and personal state on `LibraryItem`, resolves reusable metadata through the shared `Book` cache, rejects owner-scoped duplicates, creates the requested shelf membership when provided, and emits activity events for meaningful actions. ISBN-less Google results can be viewed through the info-only route but cannot be saved.

Guest sessions are temporary, session-scoped demo libraries. A guest token expires after `GUEST_SESSION_TTL_DAYS` days, defaulting to 7. Expired tokens are rejected immediately. Deleting expired `GuestSession` records cascades guest shelves, library items, progress entries, goals, preferences, and activity events; shared `Book` records remain.

Bookshelf scans require a signed-in user access token; guest tokens are rejected. The backend sends
one validated JPEG, PNG, or WebP image to the Gemini Interactions API with `store: false`, then
returns the extracted spine text and normalized coordinates immediately. The browser then requests
one owner-aware Google Books match at a time through `POST /api/bookshelf-scans/match`; this keeps
provider traffic paced while retaining server-side caching and library comparison. Analysis results
are ephemeral. A photo and its normalized spine coordinates are stored as Postgres bytes only after
the user explicitly saves the reviewed scan. Authenticated image endpoints keep the binary data out
of JSON and public URLs. Gemini SSE text deltas are reassembled before strict application-side
validation; raw provider responses are not retained or logged.

Runtime settings live in the root `.env` and are grouped by app area. Backend-specific values include:

```bash
GUEST_SESSION_TTL_DAYS=7
GOOGLE_BOOKS_API_KEY=
GOOGLE_BOOKS_BASE_URL=https://www.googleapis.com/books/v1
GOOGLE_BOOKS_REQUEST_TIMEOUT_MS=8000
GEMINI_API_KEY=
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-3.5-flash
GEMINI_REQUEST_TIMEOUT_MS=90000
```

If local Google Books requests fail with `SELF_SIGNED_CERT_IN_CHAIN`, the machine/network is intercepting HTTPS with an untrusted local certificate. Put the trusted CA at `certs/local-ca.pem`; `npm run dev:backend` and `npm run docker:up` will automatically set `NODE_EXTRA_CA_CERTS` for backend startup. Direct `docker compose up` also points the backend at `/app/certs/local-ca.pem` through the development override. You can still override the path manually with `NODE_EXTRA_CA_CERTS=/path/to/local-ca.pem`. Do not make `NODE_TLS_REJECT_UNAUTHORIZED=0` a runtime default.

`data/google-books-snapshot.json` contains the committed raw Google volumes used to prewarm all 45 curated demo books during database seeding. Refresh it from the repository root with `npm run books:snapshot:refresh`; guest-session creation itself performs no provider calls.

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

The Compose stack starts Postgres and the backend. Docker Compose reads the root `.env`; `docker-compose.override.yml` builds the in-container backend database URL from the same `POSTGRES_*` values used by host tools.
The backend reaches Postgres at the `db` service hostname inside the Compose network. In local development, `docker-compose.override.yml` also exposes Postgres on `127.0.0.1:5433` for tools like PGAdmin; the production-style Compose file keeps the database internal.

Note: local Docker builds use a scoped `NODE_TLS_REJECT_UNAUTHORIZED=0` only for `prisma generate` because this machine's network presents a self-signed certificate chain for Prisma engine downloads. That setting is not applied to runtime.
