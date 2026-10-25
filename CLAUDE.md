# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose
AjoDesk is an independent thrift **record-management** product for Nigerian daily savings collectors. Collectors register contributors, create daily plans, enroll people, record cash collections, and inspect contribution histories, balances, and missed days. It does **not** hold or move funds.

This repository is the **third-party business system** consumed by a separate Chord agent repository. AjoDesk must work without Chord. Do not add Chord skills, simulator configuration, `/agent/*` routes, prompt logic, or model SDKs here.

## Current status
`apps/api` (Phases 0–2) and `apps/web` (Phase 4) are implemented. Remote deployment (Phase 3) is not started. `apps/web` has no automated tests yet. npm workspaces: `node_modules` is hoisted to the repository root.

## Commands
Run from the repository root. There is **one application database**: `DATABASE_URL` in the root `.env` (currently Neon), used by host scripts (via `src/config/load-env.ts`) and by the Compose containers (`env_file`). Existing environment variables take precedence. Never point `TEST_DATABASE_URL` at it, because the e2e suite drops the schema.
```bash
docker compose up --build -d                # migrate one-shot → api :3001 → web :3000, all on DATABASE_URL
docker compose up -d db                     # test-only Postgres (profile "test-db") on 127.0.0.1:5433 / ajodesk_test
npm run migration:run -w apps/api           # ts-node; migration:run:prod uses dist
npm run seed -w apps/api                    # idempotent demo data (refuses NODE_ENV=production without ALLOW_DEMO_SEED=true)
npm run start:dev -w apps/api               # watch mode; Swagger at /api/docs
npm test -w apps/api                        # unit (*.spec.ts in src, no DB)
npm test -w apps/api -- src/contributions/summary.spec.ts
npm run test:e2e -w apps/api                # test/*.e2e-spec.ts against TEST_DATABASE_URL; drops the schema
npm run test:e2e -w apps/api -- -t "expired intent"
npm run lint -w apps/api && npm run typecheck -w apps/api && npm run build -w apps/api
npm run credential:create -w apps/api -- --email <collector> --label <text> [--scopes a,b]
npm run dev -w apps/web                     # :3000, API_URL defaults to http://localhost:3001
npm run lint -w apps/web && npm run typecheck -w apps/web && npm run build -w apps/web
```
New migrations must be added by hand to `src/database/migrations/index.ts`: the explicit list keeps ts-node, jest and dist consistent. Nothing runs migrations automatically on Render; apply them to Neon with `npm run migration:run -w apps/api` before deploying code that depends on them.

## Architecture and stack
- Monorepo with `apps/api` (NestJS, TypeScript, TypeORM, PostgreSQL) and `apps/web` (Next.js App Router, TypeScript, Tailwind, shadcn/ui).
- Docker Compose for local API, web, and database; TypeORM migrations, never `synchronize: true`.
- HTTP JSON REST API under `/api/v1`, documented with OpenAPI.
- API modules (`apps/api/src/<module>/`): `auth`, `collectors`, `contributors`, `plans`, `enrollments`, `contributions`, `contribution-intents`, `integration-credentials` (service + CLI only, no controller), `idempotency`, `audit`, `health`. `app.setup.ts` holds the global prefix, ValidationPipe, CORS and error filter, and is shared by `main.ts` and e2e tests. `database/seed.ts` and `database/credential-cli.ts` boot a Nest application context so they reuse the real services.
- Auth is a global `APP_GUARD` (`auth/auth.guard.ts`). Annotate each route with `@Public()`, `@CollectorOnly()`, or `@RequireScopes(...)`; a route with none of these is denied to integration keys. Keys look like `ajd_<prefix>_<secret>`; anything else is treated as a JWT.
- Every request resolves a server-side principal `{ collectorId, actorType: 'COLLECTOR' | 'INTEGRATION', actorId, scopes }`. Collector JWTs and integration keys both arrive as `Authorization: Bearer …`. Guards decide which kind it is, and all queries are scoped by `principal.collectorId`. Prefer 404 over 403 for another collector's resource IDs.
- The backend owns authentication, authorization, financial calculations, idempotency, and audit events.

### Two write paths, one posting service
- **Dashboard:** `POST /contributions` (collector JWT only in v1).
- **Integrations:** `POST /contribution-intents` creates an expiring `PENDING` intent with no financial effect. It is bound to the creating principal, and its dates and amount are immutable. `POST /contribution-intents/:id/confirm` (same principal only) completes it once. A repeat confirm returns the same contribution.
- Both paths call `ContributionPostingService` (`contributions/contribution-posting.service.ts`): lock the enrollment → check idempotency → re-validate ownership, active status, date range, unpaid dates, and amount (`dailyAmountMinor × dates.length`) → insert the contribution, one allocation per date, the idempotency record, and the audit event in one transaction. The unique `(enrollment_id, scheduled_on)` constraint on allocations is the final guard.
- Idempotency: `Idempotency-Key` header. The request hash comes from canonical normalized fields, not JSON key order. Same key + same payload → stored result. Same key + different payload → `409 IDEMPOTENCY_CONFLICT`. Already-paid date → 409. Expired intent → 410.

### Summary math (`GET /enrollments/:id/summary?asOf=`)
Keep these values distinct (`docs/DATABASE.md` §4): `recordedTotalMinor` (all posted, including future prepayments), `dueMinor`, `paidTowardDueMinor`, `outstandingDueMinor = max(0, due − paidTowardDue)`, `prepaidMinor` (allocations after `asOf`), `unpaidDates` (due dates with no allocation; future dates are never overdue). `asOf` defaults to today in Africa/Lagos. Tests should pass it explicitly.

### Web app (`apps/web`)
- **Next.js 16** with breaking changes from older versions: read `node_modules/next/dist/docs/` before using an unfamiliar API (see `apps/web/AGENTS.md`). Middleware is now `src/proxy.ts`; `params` and `searchParams` are Promises (`PageProps<'/route'>`); use `refresh()` from `next/cache` after mutations. `cacheComponents` is deliberately **off**, so every page renders fresh financial data.
- **Data flow:** the browser never talks to the API. Server Components call `apiGet` (`src/lib/api.ts`, server-only): 401 redirects to `/login?expired=1` and 404 renders `notFound()`. Writes go through `src/app/actions.ts`, and API errors map to form state via `src/lib/errors.ts`. The JWT lives only in the HttpOnly `ajodesk_session` cookie.
- **UI kit:** shadcn/ui `base-nova` style on **Base UI**, not Radix. Use `render={<Link …/>}` with `nativeButton={false}` instead of `asChild`. `cn` comes from the `cn` package. Custom tokens: `paid` and `overdue` (`globals.css`).
- **Money:** display with `formatNaira(kobo)`. Parse naira input with `parseNairaToKobo` (no floats). Don't compute balances in the UI; the schedule grid comes from the summary's `paidDates` and `unpaidDates`.

### API conventions
Errors use `{ "error": { "code", "message", "requestId" } }` and never leak SQL or stack traces. Successful responses are the resource JSON with no wrapper. List endpoints use `limit`/`cursor` pagination.

## Engineering rules
- Use strict TypeScript, NestJS modules, DTO validation, guards, dependency injection, and thin controllers.
- Use integer **kobo** for NGN money (`amountMinor` / `amount_minor`), `YYYY-MM-DD` for collection schedule dates, and UTC for event timestamps; compute the calendar in `Africa/Lagos`.
- Scope **every** read and write by the authenticated collector on the server. Never accept a supplied `collectorId` as authority.
- Financial writes need database transactions, durable idempotency, and an audit event. Never silently edit or delete a posted contribution (reversals are out of scope).
- Never describe collector-attested cash as independently verified by a bank (`verification_status = 'COLLECTOR_ATTESTED'`).
- Keep integration credentials out of the browser. Hash them at rest, store a non-secret prefix, and return a new secret only once. Demo keys are provisioned by an operator-only seed/CLI, not a public endpoint.
- Implement and test only documented MVP functionality. Do not add Paystack, wallet accounts, disbursements, loans, partial payments, SMS, queues, or a separate AI layer without a scope change.
- Reuse services for both dashboard and external integrations; no duplicated business rules.
- Integration tests run against a real disposable PostgreSQL with migrations, not SQLite, because uniqueness and concurrency behavior matter. `docs/TESTING.md` lists the minimum required cases and the Amina fixture (₦1,000/day, 2026-10-01 → 2026-10-30, `asOf` 2026-10-25).
- Don't claim code, tests, deployment, or integration work unless verified.

- Schema protections: `contributions`, `contribution_allocations` and `audit_events` have append-only triggers. `date` columns are strings (pg parser override in `database/typeorm-options.ts`). Money is `bigint`, mapped through the `bigintKobo` transformer.
- Errors: throw `AppError` (`common/errors.ts`) with a stable code. Never let raw SQL or stack traces reach responses. TypeORM `error` logging is off because it logs query parameters.

## Repository map
- `apps/api/` — NestJS app, entities, migrations, seed script, tests.
- `apps/web/` — collector-facing Next.js dashboard (server-side API client, Server Actions).
- `docs/PRD.md` — product scope, personas, journeys, acceptance criteria.
- `docs/ARCHITECTURE.md` — boundaries, auth, data flow, failure behavior.
- `docs/DATABASE.md` — schema, posting invariants, summary formulas.
- `docs/API.md` — HTTP contracts and examples.
- `docs/SECURITY.md` — access controls, integration credentials, threat model.
- `docs/TESTING.md` — automated and manual test strategy.
- `docs/IMPLEMENTATION_PLAN.md` — ordered phases and gates.
- `README.md` — setup and demo contract (keep commands accurate as implementation evolves).

## Build priorities
1. Working API/database with seeded demo collector, Amina, one plan and enrollment.
2. Reliable contribution recording, idempotency, history and summary endpoints.
3. Secure collector-bound integration credential and generic contribution intent/confirmation endpoints.
4. Deploy and verify the API via real HTTP calls.
5. Minimal dashboard, tests, and documentation.

When requirements conflict, preserve financial correctness and the repo's independence from Chord. Use the documents above; update them when decisions change.
