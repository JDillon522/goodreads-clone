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

### 5. Book API Boundary - DONE

- Integrate Open Library behind Nest.
- Normalize external results into app-shaped book DTOs.
- Handle missing covers, missing ISBNs, missing page counts, sparse authors, duplicate editions, rate limits, and API failures.
- Cache provider responses where useful.

### 6. Library Core APIs - DONE

- Build endpoints for shelves, shelf ordering, add-to-library, duplicate detection, moving books, deleting library items, book detail, ratings, notes, progress updates, and annual goals.
- Superseded in Stage 10: books now support multiple shelf memberships per user, with status tracked separately.
- Emit activity events for important actions.

### 7. Guest Mode Backend - DONE

- Add `POST /guest/session`.
- Seed temporary guest library data from `data/sample-books.json`.
- Use the same API shapes as authenticated users.
- Make guest data session-scoped with expiration/cleanup, not permanent account data.

### 8. Backend Test + Hardening Pass - DONE

- Add unit tests for normalization, duplicate detection, auth guards, shelf rules, goal pace, and progress completion.
- Add e2e/API tests for signup, guest session, book search, add book, move shelf, update progress, and goal update.
- Add validation DTOs, exception mapping, and helpful error messages.

### 9. Frontend Foundation - DONE

- Scaffold Angular after backend contracts are stable.
- Use standalone components, signals, strict typing, explicit access modifiers, and the existing design tokens.
- Build API client, auth state, guest state, route shells, and layout primitives before detailed screens.

### 10. Frontend Core Product - DONE

- Build landing page, guest entry, auth screens, library overview, shelves, search/add flow, book detail, progress update UX, ratings/notes, and reading goal UI.
- Add admin management for users and user-owned shelves.
- Keep accessibility requirements active from the first component.

### 11. Stats + Year-in-Review - DONE

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
| 2026-06-29 | Stage 5 book provider defaults | Book search is public; Open Library is hidden behind Nest-owned DTOs; missing covers stay `null`; search cache TTL is 24 hours and detail cache TTL is 7 days. |
| 2026-06-29 | Open Library detail route shape | Use `GET /api/books/open-library/:type/:id` with `type` as `works` or `books` and `id` as the bare Open Library id. |
| 2026-06-29 | Open Library request timeout | Outbound Open Library calls use an 8-second default timeout so provider slowness fails as a mapped API error. |
| 2026-06-29 | Runtime TLS stance | Do not disable TLS verification by default for external book API calls; local self-signed certificate interception should be handled with a trusted CA via `NODE_EXTRA_CA_CERTS`. |
| 2026-06-29 | Local CA startup helper | `npm run dev:backend` and `npm run docker:up` auto-detect `certs/local-ca.pem`; direct `docker compose up` also points the dev backend at `/app/certs/local-ca.pem`. |
| 2026-06-30 | Stage 6 shelf behavior | Superseded on 2026-07-08: only `Unshelved` is protected; the original standard shelves are editable user shelves. |
| 2026-06-30 | Stage 6 library behavior | Add-to-library uses normalized book DTOs, upserts app-owned books, rejects owner duplicates, and keeps each library item on exactly one shelf. |
| 2026-06-30 | Stage 6 progress behavior | Page or percent progress is supported; 100% completion marks `dateFinished` and moves the item to the `read` shelf when available. |
| 2026-06-30 | Stage 7 guest token behavior | `POST /api/guest/session` creates a 7-day opaque guest token and seeds an active-reader demo library. |
| 2026-06-30 | Stage 7 owner API behavior | Shelves, library, progress, and goals now accept either signed-in user access tokens or guest tokens through the same endpoints. |
| 2026-06-30 | Stage 7 guest cleanup | Expired guest sessions are deleted through a cleanup service method; cascade deletes remove guest-owned shelves, items, progress, goals, preferences, and activity events while shared books remain. |
| 2026-06-30 | Stage 8 progress transition hardening | Starting progress on a `want-to-read` item moves it to `currently-reading`; completion still moves items to `read`. |
| 2026-06-30 | Stage 9 design foundation | Shared frontend CSS follows Atomic Design layers; atoms style only primitive HTML tags, and unproven shared layers stay blank until real components justify selectors. |
| 2026-06-30 | Stage 9 API type generation | Use `openapi-typescript` for type/interface-only frontend API contract generation from `/docs-json`; do not generate runtime DTO classes or Angular services. |
| 2026-06-30 | Stage 9 Angular foundation | Use Angular v22 standalone lazy routes, `ChangeDetectionStrategy.OnPush`, signals, and signal forms for frontend foundation work. |
| 2026-06-30 | Stage 9 session storage | Store authenticated access/refresh tokens in `localStorage`; store guest tokens and guest expiration state in `sessionStorage`. |
| 2026-06-30 | Stage 9 proxy topology | Add nginx as the browser-facing container on `localhost:8080`; dev routes non-API traffic to Angular dev server and `/api`, `/docs`, `/docs-json` to Nest. Production proxy serves Angular static assets and forwards API/docs traffic to the backend. |
| 2026-06-30 | Stage 9 visual direction | Move tokens away from the starter beige/brown palette toward a cleaner neutral/teal foundation while keeping all colors adjustable through CSS variables. |
| 2026-06-30 | Stage 10 shelf model change | A library item can belong to multiple shelves through `LibraryItemShelf`; duplicate rejection now blocks duplicate shelf membership, not duplicate library ownership. |
| 2026-06-30 | Stage 10 status model | `LibraryItem.status` is explicit (`WANT_TO_READ`, `READING`, `READ`) and progress updates no longer move books between shelves. |
| 2026-06-30 | Stage 10 shelf deletion behavior | Superseded on 2026-07-08: only `Unshelved` is protected from deletion; the original three standard shelves are user-owned shelves and can be renamed, deleted, and reordered. |
| 2026-06-30 | Stage 10 add-book behavior | Add-book flow asks for a target shelf; shelf pages pass their shelf id as the default picker choice. |
| 2026-06-30 | Stage 10 shelf reordering | Superseded on 2026-07-08: shelf reordering is active for normal users and admins. |
| 2026-07-08 | Unshelved default shelf | Every user and guest owner gets a persisted `Unshelved` shelf first; new books default there unless a target shelf is chosen. |
| 2026-07-08 | Shelf deactivation behavior | Deactivated shelves remain in the database for admin/reactivation but are hidden from normal shelf and add-book flows; books with no active shelves appear through `Unshelved`. |
| 2026-07-08 | Admin access model | Seed an ADMIN user with username `admin` and password `Password123!`; normal sign-in accepts email or username, and deactivated users are blocked from auth/API use. |
| 2026-07-08 | Admin management scope | Admin v1 manages authenticated users and their shelves only; guest-session shelf admin and global default-template editing are out of scope. |
| 2026-07-08 | Stage 10 shelf reorder UX | Normal users can reorder any active shelf from the app shell through `/api/shelves/order`; `Unshelved` is protected from deletion only. |
| 2026-07-08 | Stage 10 book detail review UX | Rating and notes editing lives on the book detail page only; library filters, sorting, and card indicators remain out of Stage 10 scope. |
| 2026-07-08 | Stage 11 stats scope | Stats v1 supports authenticated users and guests, uses current-year UI, keeps the API year-ready, and excludes sharing cards, AI summaries, imports, and advanced analytics. |
| 2026-07-08 | Stage 11 completion rule | Yearly completed-book counts use `dateFinished` only; page totals are estimated from known page counts, completed-page fallback, and current progress where appropriate. |
| 2026-07-08 | Stage 11 highlights | Year-in-review includes useful portfolio-friendly highlights: monthly finishes, estimated pages, goal pace, favorite genres/authors, status/shelf breakdowns, top-rated books, and longest completed book. |

## Open Questions

- Decide deployment target details after local Docker and backend contracts are stable.
- Decide when to add real email delivery for password reset tokens.
- Decide how to normalize/cache Open Library series or relation data for expanded book detail pages.

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
- Completed Stage 5 book provider boundary: public Open Library search, Open Library work/edition detail endpoint, normalized book DTOs, provider response caching, error mapping, cache TTL env settings, and outbound request timeout config.
- Added normalization coverage for sparse provider data, missing covers/authors, ISBN selection, duplicate work grouping, and service cache behavior.
- Verified Stage 5 with backend build, typecheck, ESLint, Jest, Prettier/Prisma validation, npm audit, Docker health/readiness, and Swagger book path registration.
- Live Open Library smoke through Node was blocked locally by `SELF_SIGNED_CERT_IN_CHAIN`; the code returns a 503 for that failure and documentation records the trusted-CA fix instead of disabling runtime TLS.

### 2026-06-30

- Completed Stage 6 core authenticated APIs: shelves, shelf ordering, library add/list/detail/update/delete, shelf moves, progress updates, and annual reading goals.
- Added owner-scoped service boundaries so Stage 7 guest mode can reuse the same core logic instead of forking behavior.
- Added activity events for shelf creation/rename/delete, book add/move/finish, progress updates, ratings, notes, and goal updates.
- Added pure rule coverage for shelf deletion/slugging, progress completion, text normalization, and annual goal pace.
- Verified Stage 6 against the running Docker backend with signup, shelves, add-to-library, duplicate rejection, rating/notes, progress completion, goal completion, and Swagger path checks; removed temporary smoke users afterward.
- Completed Stage 7 guest mode: `POST /api/guest/session`, opaque guest bearer tokens, 7-day default expiration, active-reader demo seeding from `data/sample-books.json`, owner-token guard, guest cleanup service, and production Docker access to sample data.
- Refactored shelves, library, progress, and goals to use shared owner context so the same API routes support authenticated users and guest sessions without duplicating controllers.
- Completed Stage 8 hardening: added guest service and owner-token guard unit tests, added Docker-backed API workflow e2e tests, and verified cleanup removes temporary e2e users and guest sessions.
- Completed Stage 9 frontend foundation: Angular workspace, standalone lazy routes, route shell, minimal landing page, auth/reset screens, guest entry, library/shelf/search/book detail/goals/settings pages, typed API client, bearer-token interceptor, auth/guest/session/theme services, OpenAPI type aliases, and signal-form wiring.
- Added frontend Atomic Design CSS scaffolding with variables plus tag-only atoms, light/dark theme tokens, Phosphor icons, and route-scoped styles for the initial foundation UI.
- Added Docker frontend dev image and nginx proxy dev/production images; `docker compose up` now exposes the app through `http://localhost:8080`, proxies `/api`, `/docs`, and `/docs-json` to the backend, and keeps the frontend dev server internal.
- Verified Stage 9 with `ngc`, frontend typecheck, frontend unit tests, local production frontend build, dev/prod Docker proxy builds, Compose startup, proxy `/api/health`, proxy deep-route fallback, and `POST /api/guest/session` through nginx.
- Started Stage 10 shelf/status work: migrated library items from single `shelfId` ownership to multi-shelf memberships, added explicit manual reading status, and regenerated Swagger/OpenAPI frontend types.
- Added backend endpoints for adding/removing shelf memberships, delete-shelf result summaries, and `Unshelved` fallback handling when deleting a book's only shelf.
- Updated frontend shelf UX: create shelves, rename shelves, delete custom shelves with confirmation/result details, choose a shelf while adding a book, and manage a book's shelf memberships from the book detail page.
- Updated frontend progress UX so manual status control is separate from page/percent progress; setting progress to 100% marks status `READ` without forcing a shelf move.
- Verified Stage 10 shelf/status slice with backend/frontend typechecks, backend unit tests, frontend unit tests, backend e2e tests, live guest API smoke for multi-shelf deletion, and live `Unshelved` fallback smoke.

### 2026-07-08

- Updated the shelf model direction: `Unshelved` is a real default shelf for every owner, and the original three standard shelves are editable/deletable user shelves.
- Added admin direction: username-based ADMIN login, user deactivation, shelf deactivation, and admin-only user/shelf management.
- Finished Stage 10 frontend core product: normal users can create, rename, delete, and reorder shelves from the app shell while `Unshelved` remains deletion-protected.
- Added book-detail rating and notes editing with clearable 1-5 ratings and plain-text notes, submitted as `number | null` and `string | null`.
- Extended the shared `app-form-control` for text, email, password, number, select, and textarea use, then replaced remaining Stage 10 raw controls across app shell, auth, search, book detail, and goals where practical.
- Fixed Swagger nullable DTO metadata and regenerated `frontend/src/app/core/api/bookshelf-api.types.ts`; `rating`, `notes`, `pageCount`, and other nullable book fields now generate as concrete nullable primitives instead of object placeholders.
- Added focused frontend coverage for shared form controls, app-shell shelf management/reorder behavior, book-detail status/progress/shelf/rating/notes updates, and admin route guard smoke behavior.
- Verified Stage 10 with backend typecheck, backend Jest, regenerated OpenAPI types, frontend app typecheck, frontend tests, frontend production build, Docker proxy health, and Docker API smoke for admin login, shelf reorder, add-to-library, rating/notes save, and guest default shelves.
- Browser automation could not be completed in this session because the in-app browser connector exposed no available browser sessions; Docker API smoke covered the requested user/admin/guest workflows.
- Finished Stage 11 stats/year-in-review: added owner-scoped `/api/stats/summary` and `/api/stats/year-in-review/:year` endpoints for authenticated users and guests.
- Added stats calculation helpers for completed-page estimates, in-progress page estimates, monthly completion totals, ranked genres, and ranked authors.
- Added `/app/stats` as a current-year dashboard with summary metrics, year-in-review highlights, monthly finish bars, genre/author rankings, status/shelf breakdowns, and top-rated/longest-book sections.
- Kept the frontend UI current-year only while keeping the frontend service and backend endpoints year-aware for future multi-year navigation.
- Regenerated frontend OpenAPI types after adding Stats DTOs and added focused coverage for stats rules, stats e2e workflow paths, and the Angular stats route.
- Verified Stage 11 with backend lint, backend format check plus Prisma validate, backend typecheck, backend unit tests, backend build, backend Docker e2e, regenerated OpenAPI types, frontend app/spec typechecks, frontend unit tests, frontend production build, proxy `/app/stats` smoke, and guest stats API smoke through nginx.
