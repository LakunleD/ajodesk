# Implementation plan · AjoDesk

This plan covers the **standalone thrift management application only**. The external Chord agent has a separate repository and delivery plan. AjoDesk's API is the external system that agent will call.

## Phase 0 · Set up the repository
- [x] Create npm-workspace monorepo, `apps/api` (NestJS) and `apps/web` (Next.js).
- [x] Configure strict TS, linting, formatting and sane shared commands.
- [x] Configure Docker Compose for API, web, PostgreSQL with health checks.
- [x] Add `.env.example`, secure secret loading and `/api/v1/health`.
- [x] Set up TypeORM DataSource, migrations and safe seed scripts.

**Gate:** fresh clone can build/run API and DB; health endpoint works; migration runs.

## Phase 1 · Core domain API (first priority)
- [x] Implement collectors and JWT login.
- [x] Build collector ownership guard/policies.
- [x] Implement contributors: create/search/detail.
- [x] Implement fixed NGN daily plans and enrollments.
- [x] Implement scheduled date generation in Africa/Lagos.
- [x] Implement balance/paid/unpaid summary and contribution history.
- [x] Implement direct cash contribution write with immutable records, full-day allocations, idempotency and an audit event.
- [x] Seed fictional collector, Amina, plans, dates and contributions.
- [x] Add core unit + integration tests.

**Gate:** using the API alone, create Amina and record a cash payment; validate summaries and duplicate protection.

## Phase 2 · Generic third-party API access (second priority)
- [x] Implement collector-bound, hashed, revocable, scoped integration credentials.
- [x] Make read routes available to a credential with corresponding scopes.
- [x] Implement `POST /contribution-intents`, `GET /contribution-intents/:id`, and `POST /contribution-intents/:id/confirm`.
- [x] Bind each intent to the initiating credential/principal, immutable payload and short expiry.
- [x] Reuse the same contribution posting service as Phase 1.
- [x] Test auth isolation, idempotency, repeated confirmation, timeout recovery and concurrent date conflicts.
- [x] Generate OpenAPI schemas and clear error codes.

**Gate:** external curl/Postman client using the demo integration key can prepare/confirm, observe the database write, and receive the same result on retry. **No Chord-specific code is required.**

## Phase 3 · Deploy the API (third priority)
- [ ] Host NestJS over HTTPS and use a private PostgreSQL service.
- [x] Configure production migrations and environment secrets (`render.yaml`; Render prompts for or generates secrets. Migrations are applied to Neon manually with `npm run migration:run`, never on deploy).
- [ ] Smoke-test external HTTPS from outside the hosting network.
- [ ] Capture redacted request/response evidence and real deployment problems.

**Gate:** a remote HTTPS client completes the Phase 2 flow and the stored record remains accessible afterwards.

## Phase 4 · Minimal dashboard
- [x] Collector login and protected pages.
- [x] Contributor search/create and detail.
- [x] Plan/create and enrollment.
- [x] Contribution schedule, history and clear balance summary.
- [x] Cash recording confirmation and result display.
- [x] Graceful empty/error/loading states.

**Gate:** a collector can complete the same core workflow from the UI. UI uses backend values and rules, not hardcoded figures.

## Phase 5 · Cleanup and handoff
- [ ] Run tests and lint checks; fix financial correctness regressions.
- [ ] Verify Docker fresh boot, migrations and demo seed.
- [ ] Update README to only include commands tested against the implementation.
- [ ] Document deployment and operating limitations, API examples and credential rotation.
- [ ] Share API URL, read/write integration key securely, and OpenAPI contracts with the separate agent project.

## Timeboxing
For the TSG Labs exercise, **do not make the dashboard a blocker** for the external agent. Phases 1 to 3 provide the value the other repository needs. No Paystack integration is required to demonstrate a real external tool action. Add it only as a separately scoped future feature.

## Out of scope
Bank payment processing, payout/wallets, loans, rotational thrift, partial allocations, reversal implementation, fees/commissions, automated reminders, WhatsApp integration, AI models, Chord tools, and Chord skill files.
