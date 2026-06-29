# Bookshelf Staged Roadmap

## Current Direction

Bookshelf is a full-stack personal reading tracker built backend-first. Establish the data model, authorization, Docker environment, Swagger-tested API boundaries, and persistence rules before building frontend buttons or screens.

Authoritative v1 defaults:

- Build the full-stack app, not the frontend-only alternative.
- Start with the backend: Nest.js, Postgres, Docker, auth, migrations, seed data, and book API integration.
- Keep Swagger/OpenAPI available before frontend work so backend contracts can be exercised directly.
- Use Nest-owned database auth with bearer tokens unless later changed.
- Use Prisma with the Postgres driver adapter for schema, migrations, generated types, and DB access.
- Use `data/sample-books.json` for guest/demo data.
- Do not rely on `starter/tailwind.css` or `data/sample-books.csv`; both were intentionally removed.
- Defer stretch goals and differentiators until the core backend/data foundation is stable.

## Stage Plan

### 1. Context + Repo Contract - DONE

- Update `AGENTS.md` to point to this roadmap.
- Record intentional deletions: no `starter/tailwind.css`, no `data/sample-books.csv`.
- Lock defaults: npm workspaces, Prisma, Open Library first, stretch goals later.

### 2. Workspace + Docker Foundation - DONE

- Set up root npm workspace structure for `backend/`, later `frontend/`, and infrastructure scripts.
- Scaffold the Nest backend.
- Add Docker Compose for backend, Postgres, and future proxy/frontend services.
- Add env templates, a health check endpoint, Swagger/OpenAPI, and local startup scripts.

### 3. Database Model + Migrations - DONE

- Use Prisma with Postgres.
- Model users, auth tokens, password reset tokens, books, shelves, library items, progress history, goals, preferences, activity events, and cached external book metadata.
- Add seed flow for default shelves and guest/sample data.

### 4. Authentication + Authorization - DONE

- Implement email/password signup, signin, signout, bearer JWT access tokens, refresh/session handling, and password reset token flow.
- Protect user-owned routes.
- Add ownership checks so one user cannot touch another user's library data.

### 5. Book API Boundary

- Integrate Open Library behind Nest.
- Normalize external results into app-shaped book DTOs.
- Handle missing covers, missing ISBNs, missing page counts, sparse authors, duplicate editions, rate limits, and API failures.
- Cache provider responses where useful.

### 6. Library Core APIs

- Build endpoints for shelves, shelf ordering, add-to-library, duplicate detection, moving books, deleting library items, book detail, ratings, notes, progress updates, and annual goals.
- Ensure a book belongs to exactly one shelf per user.
- Emit activity events for important actions.

### 7. Guest Mode Backend

- Add `POST /guest/session`.
- Seed temporary guest library data from `data/sample-books.json`.
- Use the same API shapes as authenticated users.
- Make guest data session-scoped with expiration/cleanup, not permanent account data.

### 8. Backend Test + Hardening Pass

- Add unit tests for normalization, duplicate detection, auth guards, shelf rules, goal pace, and progress completion.
- Add e2e/API tests for signup, guest session, book search, add book, move shelf, update progress, and goal update.
- Add validation DTOs, exception mapping, and helpful error messages.

### 9. Frontend Foundation

- Scaffold Angular after backend contracts are stable.
- Use standalone components, signals, strict typing, explicit access modifiers, and the existing design tokens.
- Build API client, auth state, guest state, route shells, and layout primitives before detailed screens.

### 10. Frontend Core Product

- Build landing page, guest entry, auth screens, library overview, shelves, search/add flow, book detail, progress update UX, ratings/notes, and reading goal UI.
- Keep accessibility requirements active from the first component.

### 11. Stats + Year-in-Review

- Use backend activity/progress/read-date data to power reading insights.
- Start with useful dashboard stats before any stretch "wow" differentiators.
- Defer AI, animated shelves, sharing cards, Goodreads import, and advanced analytics until core is stable.

### 12. Deployment + Portfolio Finish

- Add production Docker/proxy configuration.
- Prepare Heroku or equivalent deployment.
- Run Lighthouse, accessibility checks, API tests, and README documentation.
- Submit the guest route as the primary live demo path.

## Public Interfaces To Define Early

- Auth endpoints: signup, signin, refresh/session, signout, password reset request/confirm.
- Guest endpoint: create guest session.
- Book provider endpoints: search books, fetch/normalize book detail.
- Library endpoints: shelves, library items, progress, ratings, notes, goals.
- Shared response DTOs must be frontend-friendly and hide provider-specific weirdness.

## Test Plan

- Backend unit tests for pure rules and normalization.
- Backend e2e tests for auth, authorization, guest mode, and library workflows.
- Later frontend component/e2e tests for keyboard navigation, guest browsing, search, progress updates, and responsive layout.
- Final checks: Docker startup, migrations from a clean DB, Lighthouse, axe/WCAG pass.

## Decision Log

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-06-29 | Build full-stack, backend-first | Establish data handling, authorization, Docker, and API contracts before frontend UI. |
| 2026-06-29 | Use Nest-owned database auth by default | Email/password auth with bearer tokens is the starting assumption. |
| 2026-06-29 | Use `sample-books.json` only | `starter/tailwind.css` and `data/sample-books.csv` were intentionally removed. |
| 2026-06-29 | Defer stretch goals | Differentiators wait until the core product foundation is stable. |
| 2026-06-29 | Recommended defaults: npm workspaces, Prisma, Open Library | These stand unless explicitly changed later. |
| 2026-06-29 | Add Swagger before frontend work | Backend contracts should be testable at `/docs` before UI implementation starts. |
| 2026-06-29 | Keep Postgres internal to Docker network | Do not bind DB to host `5432`; backend reaches it by Compose service name `db`. |
| 2026-06-29 | Split Docker Compose base and override | Base Compose uses the production backend target; override uses the development target, bind mounts, and Nest watch mode. |
| 2026-06-29 | Approved Stage 3 defaults | Use Prisma, Postgres-backed guest sessions with expiration, Open Library first, and short-lived access tokens plus stored refresh sessions. |
| 2026-06-29 | Duplicate detection priority | Detect user-library duplicates by ISBN-13, ISBN-10, provider key, then normalized title plus primary author. Store a dedupe key on library items and enforce owner-scoped uniqueness. |
| 2026-06-29 | Prisma 7 driver adapter | Use `@prisma/adapter-pg` and `pg`; PrismaClient requires an explicit adapter. |
| 2026-06-29 | Stage 4 auth defaults | Use `argon2id` password hashing, 15-minute JWT access tokens, 30-day opaque refresh tokens stored as SHA-256 hashes, and JSON token responses for Swagger testing. |
| 2026-06-29 | Password reset testing path | Development/test password reset requests return the reset token in JSON; production must hide it until email delivery is implemented. |

## Open Questions

- Decide deployment target details after local Docker and backend contracts are stable.
- Decide when to add real email delivery for password reset tokens.

## Session Notes

### 2026-06-29

- Reviewed root project guidance, specs, design guidance, accessibility checklist, sample data, and frontend Angular instructions.
- Confirmed repository is pre-scaffold: `backend/` and `frontend/` are effectively empty.
- Confirmed `data/sample-books.json` exists with 45 sample records.
- Recorded backend-first direction and staged implementation plan.
- Completed Stage 2 foundation: root npm workspace, Nest backend, Swagger/OpenAPI, health endpoint, Docker Compose, backend Dockerfile, and env templates.
- Verified backend build, typecheck, audit, local health/Swagger endpoints, Docker image build, and Compose runtime smoke test.
- Split Compose behavior so dev settings live in `docker-compose.override.yml` and production-style defaults stay in `docker-compose.yml`.
- Completed Stage 2.5 hardening: environment validation, DB readiness endpoint, lint/format/test scripts, Docker utility scripts, and Swagger system endpoint structure.
- Completed Stage 3 foundation: Prisma config, initial Postgres schema, generated client, initial migration, Prisma service/module, and seed script for 45 sample books plus demo guest session data.
- Verified Stage 3 with build, typecheck, Jest, ESLint, format/Prisma validation, npm audit, production Docker build, Compose health/readiness/Swagger smoke test, and seed row counts.
- Hardened Swagger setup into a dedicated config helper with stable `/docs` and `/docs-json` endpoints, stable operation IDs, bearer auth persistence, product-area tags, and readiness failure documentation.
- Completed Stage 4 auth: signup, signin, current user, refresh rotation, signout, and password reset request/confirm endpoints.
- Added `AccessTokenGuard`, `CurrentUser` decorator, `AuthModule`, `UsersModule`, default shelf/preference creation on signup, and Swagger DTOs for auth responses.
- Verified Stage 4 with backend typecheck, ESLint, and Jest coverage for auth service, access token guard, user defaults, and health endpoints.
- Smoke-tested Stage 4 in Docker through health, Swagger JSON, signup, bearer `me`, refresh, password reset request/confirm, and signout; removed the temporary smoke account afterward.
