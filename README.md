# Note!

This is a virtually 100% vibe coded application! I did this as an experiment to see what I could do if I leveraged AI to the max with no concern for token usage. I'm quite pleased how well it turned out

# Bookshelf

Bookshelf is a full-stack personal reading tracker built from the Frontend Mentor Product Challenge prompt. The app lets people search Google Books, save ISBN-backed books, organize them across multiple shelves, track progress, write ratings and notes, manage annual goals, and review reading stats.

This is no longer the stock challenge starter. The repo is now a working Nest + Angular + Postgres application with Docker-backed local development and a small set of local tooling scripts.

## What Works

- Account signup, sign-in, refresh, sign-out, password reset token flow, and username-or-email admin login.
- Guest sessions with seeded demo data from `data/sample-books.json`.
- Google Books search, provider normalization, permanent book metadata caching, response-backed pagination, availability filters, print-type controls, and relevance/newest sorting.
- Google-only metadata caching, related-book discovery, series signals, cover theming, and explicit sparse-data fallbacks.
- ISBN-owned user library rows: personal state lives on `LibraryItem`, while reusable metadata lives in the shared `Book` cache.
- User library management with duplicate detection, progress tracking, ratings, notes, and explicit reading status.
- Multi-shelf membership: a book can be on more than one shelf, and every owner has a protected `Unshelved` shelf.
- User shelf management through the app, including create, rename, delete, reorder, and `Unshelved` fallback behavior.
- Admin user and shelf management at `/app/admin`.
- Session-status guard at app load so stale user or guest tokens redirect to sign-in.
- Current-year stats and year-in-review summary for authenticated users and guests.
- Read-only Postgres MCP server for inspecting the Docker database.
- Signed-in bookshelf-photo scanning with Gemini visual extraction, Google Books candidate review,
  edition comparison, explicit Postgres photo storage, and saved physical-location associations.

## Architecture

```txt
.
├── backend/                 Nest API, Prisma schema, migrations, tests
├── frontend/                Angular app, route screens, shared UI, API clients
├── proxy/                   Nginx browser-facing proxy for Docker
├── data/                    Guest/demo seed data
├── docs/                    Roadmap, decision log, and implementation notes
├── tools/bookshelf-db-mcp/  Read-only MCP server for local Postgres inspection
├── scripts/                 Small Node utilities used by npm/bin commands
└── bin/run                  Human-friendly local command runner
```

The browser normally talks to the nginx proxy on `localhost:8080`. The proxy sends `/api`, `/docs`, and `/docs-json` to the Nest backend and all app routes to Angular.

Backend ownership flows use a shared owner context so authenticated users and guest sessions hit the same library, shelf, goals, and stats APIs. Authenticated users are identified by access tokens; guests use an opaque guest bearer token stored on the client.

Bookshelf-photo scanning is intentionally signed-in-only because it spends a server-owned Gemini
API key and stores user-owned media. Gemini identifies visible spine text and normalized image
coordinates; Google Books remains the sole authority for ISBNs, editions, covers, and reusable book
metadata. Detected spines render before edition lookup, and the browser orchestrates paced,
one-at-a-time candidate requests through the backend rather than exposing provider credentials.
Unsaved scan images remain browser-held and are not written to Postgres.

## Tech Stack

- Backend: Nest 11, Prisma 7, Postgres 16
- Frontend: Angular 22 standalone routes, signals, signal forms
- External data: Google Books only
- Visual extraction: Gemini Interactions API (`gemini-3.5-flash` by default)
- Local runtime: Docker Compose, nginx proxy
- API contracts: Swagger/OpenAPI at `/docs` and `/docs-json`, with generated frontend types
- Tooling: npm workspaces plus `bin/run`

## Local URLs

| Surface            | URL                             |
| ------------------ | ------------------------------- |
| App through proxy  | http://localhost:8080           |
| Backend API        | http://localhost:3000/api       |
| Swagger UI         | http://localhost:3000/docs      |
| Swagger JSON       | http://localhost:3000/docs-json |
| Postgres host port | `127.0.0.1:5433`                |

## Quick Start

Create your local root environment file:

```sh
cp .env.example .env
```

Set `GEMINI_API_KEY` to enable signed-in shelf-photo scanning. The default API root is
`https://generativelanguage.googleapis.com/v1beta`; stateless scans set `store: false` and use a
90-second timeout because dense shelf photographs require substantially more processing than
ordinary metadata requests.

Install dependencies:

```sh
npm install
```

The committed guest/demo metadata cache can be refreshed explicitly from Google Books:

```sh
npm run books:snapshot:refresh
```

Start the full local stack:

```sh
bin/run up
```

Start detached:

```sh
bin/run up -d
```

Check the environment:

```sh
bin/run doctor
```

See all local commands:

```sh
bin/run help
```

## Command Runner

`bin/run` is the preferred entry point for local workflows. It wraps the lower-level npm and Docker commands so you do not have to remember the whole spellbook.

Common commands:

```sh
bin/run up                 # Start full Docker dev stack
bin/run down               # Stop Docker dev stack
bin/run logs backend       # Follow logs for one service
bin/run ps                 # Show container status
bin/run db                 # Start only Postgres
bin/run db-shell           # Open psql in the db container
bin/run api-types          # Regenerate frontend OpenAPI types
bin/run mcp-db-role        # Create/update local read-only DB role
bin/run mcp-db             # Start read-only DB MCP server over stdio
bin/run test               # Run all workspace tests
bin/run typecheck          # Run all workspace typechecks
bin/run validate           # Typecheck, test, backend build, frontend build
bin/run doctor             # Check Docker, DB, backend, proxy, route fallback
```

Use command-specific help when needed:

```sh
bin/run help mcp-db
```

## Database

The development database runs in Docker as `bookshelf-db`.

Runtime database values live in the root `.env` under the `Database` section. Docker Compose reads that file automatically, and host-side backend, Prisma, seed, and MCP commands load the same file.

Default host connection:

```txt
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_HOST_PORT}/${POSTGRES_DB}
```

Default container-network connection:

```txt
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_CONTAINER_HOST}:${POSTGRES_CONTAINER_PORT}/${POSTGRES_DB}
```

Prisma schema and migrations live under `backend/prisma/`.

Useful commands:

```sh
bin/run db
npm run db:generate
npm run db:migrate:dev -- --name your_migration_name
npm run db:seed
```

## MCP Database Tooling

The repo includes a committable read-only MCP server for inspecting the local Docker Postgres database:

```sh
bin/run mcp-db
```

Before using it with a read-only role, apply the local role helper:

```sh
bin/run mcp-db-role
```

MCP client config and safety details live in `tools/bookshelf-db-mcp/README.md`. The server exposes:

- `database_overview`
- `list_tables`
- `describe_table`
- `query_readonly`

`query_readonly` runs in a read-only transaction, blocks mutation/DDL keywords, rejects multiple statements, sets timeouts, and caps returned rows. The database role is still the real safety boundary.

## API Types

Frontend API types are generated from the running backend Swagger JSON:

```sh
bin/run api-types
```

The generated file is `frontend/src/app/core/api/bookshelf-api.types.ts`. Do not hand-edit it.

## Validation

Main local validation:

```sh
bin/run validate
```

Focused commands:

```sh
npm run typecheck:backend
npm run test:backend
./node_modules/.bin/tsc --noEmit -p frontend/tsconfig.app.json
./node_modules/.bin/tsc --noEmit -p frontend/tsconfig.spec.json
npm run test:frontend -- --watch=false
npm run build:frontend
```

Angular production builds can fail inside the Codex sandbox with an esbuild-related exit `134`; rerunning outside the sandbox is the useful signal when TypeScript and tests are clean.

## Documentation Map

- `docs/project-roadmap.md`: running decision log, stage history, and current implementation direction.
- `AGENTS.md`: AI collaboration context and repo-specific working rules.
- `backend/README.md`: backend setup and operational notes.
- `frontend/src/app/core/api/README.md`: generated API type guidance.
- `tools/bookshelf-db-mcp/README.md`: read-only DB MCP setup.

## Product Notes

Bookshelf started as a Frontend Mentor Product Challenge. The active implementation direction is full-stack, backend-first, with guest mode as the portfolio/demo path. The original challenge reference files are intentionally development context, not the shipped product documentation.
