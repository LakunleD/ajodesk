# AjoDesk

AjoDesk is a standalone record-management application for Nigerian daily thrift collectors. It provides a NestJS REST API, PostgreSQL persistence, and a small Next.js dashboard for contributor and daily cash contribution records.

**Product boundary:** AjoDesk records cash collections attested by an authorized collector. It does not receive, hold, transfer, or independently verify funds. This repo is independent of any AI platform. A separate project may call its REST API using a scoped integration credential.

## Documentation
| File | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Persistent coding brief for Claude Code |
| [`docs/PRD.md`](docs/PRD.md) | Product scope and business workflow |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System components and responsibility boundaries |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema and invariants |
| [`docs/API.md`](docs/API.md) | Public REST API contract |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Authentication and integration-security rules |
| [`docs/TESTING.md`](docs/TESTING.md) | Test plan and example scenarios |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Ordered implementation tasks |

## Layout
```text
ajodesk/
  apps/
    api/                 # NestJS + TypeORM (implemented)
    web/                 # Next.js dashboard (implemented)
  docker/postgres/       # test DB container init (creates ajodesk_test)
  docs/
  docker-compose.yml
  .env.example
```

## Implementation status
- **Done:** API (Phases 0–2 in `docs/IMPLEMENTATION_PLAN.md`), collector dashboard (Phase 4), migrations, demo seed, operator credential CLI, API unit and e2e tests, Docker Compose for DB, API and web.
- **Not done:** remote deployment (Phase 3). The dashboard has no automated tests yet; it was checked with a scripted headless-browser walkthrough.

## Local development
Requires Node 22+ and Docker.

```bash
cp .env.example .env            # set DATABASE_URL (e.g. Neon), JWT_SECRET, INTEGRATION_KEY_PEPPER
npm install
```
The app uses **one database**, `DATABASE_URL`, both from your machine and inside Docker. For Neon, use the direct (non-`-pooler`) connection string with `sslmode=verify-full`. The local Postgres container exists only for the e2e tests.

### Option A: everything in Docker
```bash
docker compose up --build -d    # migrate (one-shot, on DATABASE_URL) → api :3001 → web :3000
curl localhost:3001/api/v1/health
open http://localhost:3000      # sign in as the seeded demo collector (DEMO_COLLECTOR_* in .env)
docker compose exec -e ALLOW_DEMO_SEED=true api node dist/database/seed.js
docker compose exec api node dist/database/credential-cli.js create \
  --email demo.collector@ajodesk.test --label "Demo client"
```
The image runs with `NODE_ENV=production`, so the seed refuses to run unless `ALLOW_DEMO_SEED=true` is set.

### Option B: API and web on the host
```bash
npm run migration:run -w apps/api
npm run seed -w apps/api        # idempotent; fictional data only
npm run start:dev -w apps/api   # http://localhost:3001/api/v1, docs at /api/docs
npm run dev -w apps/web         # http://localhost:3000 (API_URL defaults to http://localhost:3001)
```

### Tests and checks
```bash
npm test -w apps/api                       # unit tests (no DB)
docker compose up -d db                    # local test Postgres on 127.0.0.1:5433 (ajodesk_test)
npm run test:e2e -w apps/api               # e2e against TEST_DATABASE_URL (schema is dropped and recreated)
npm test -w apps/api -- src/contributions/summary.spec.ts   # one unit file
npm run test:e2e -w apps/api -- -t "expired intent"         # one e2e test by name
npm run lint -w apps/api
npm run build -w apps/api
npm run lint -w apps/web
npm run typecheck -w apps/web
npm run build -w apps/web
```
The e2e suite refuses to run unless the database name ends in `_test`, so it can never wipe the application database.

### Integration credentials (operator only; there is no HTTP endpoint)
```bash
npm run credential:create -w apps/api -- --email <collector> --label <text> [--scopes a,b] [--expires-days N]
npm run credential:list   -w apps/api -- [--email <collector>]
npm run credential:revoke -w apps/api -- --id <credential-uuid>
```
The key is printed once. Default scopes are read + `contributions:prepare` + `contributions:confirm`.

## Deploying to Render
`render.yaml` is a Render Blueprint for two Docker web services in the Ohio region (next to the Neon database). Both are on the `free` plan.

| Service | Built from | Notes |
|---|---|---|
| `ajodesk-api` | `apps/api/Dockerfile` | Serves `/api/v1`. Health check `/api/v1/health`. Does **not** run migrations. |
| `ajodesk-web` | `apps/web/Dockerfile` | Calls the API at its public URL (`API_URL`). Health check `/login`. |

1. Push this repository to GitHub or GitLab.
2. In Render: **New → Blueprint**, then pick the repository. Render reads `render.yaml`.
3. Fill in the prompted values:
   - `DATABASE_URL`: the Neon direct connection string (`sslmode=verify-full`).
   - `INTEGRATION_KEY_PEPPER`: the same value as in your local `.env`, so integration keys issued with the local CLI work on Render.
   - `API_URL`: `https://ajodesk-api.onrender.com`. If Render gives the API a different URL, update it on `ajodesk-web` and redeploy.
4. After deploy, open the web URL and sign in.

**Schema changes:** Render never migrates the database. When a release adds a migration, apply it to Neon from your machine **before** deploying the code that needs it:
```bash
npm run migration:run -w apps/api   # uses DATABASE_URL from .env (Neon)
```

Free-plan behaviour: each service sleeps after 15 idle minutes and takes about a minute to wake. The web app waits up to 70 seconds (`API_TIMEOUT_MS`) so the first request after a sleep doesn't fail. Free services have no Shell, so issue integration keys from your machine with the credential CLI (same `DATABASE_URL` and pepper).

Known limitation: login and registration go through the web server, so the API's per-IP rate limit (`AUTH_RATE_LIMIT_PER_MINUTE`, default 10/min) is shared by everyone using the dashboard.

## Dashboard
The Next.js app calls the API **only from the server** (Server Components and Server Actions). The collector JWT is kept in an HttpOnly cookie and never reaches browser JavaScript. Integration keys are never used by the web app. `API_URL` is a server-side variable; there is no `NEXT_PUBLIC_*` API URL.

Pages: sign in/register, contributors (search, create, detail, enroll), plans (list, create, and a plan page showing totals, every enrolled contributor with their balance, all contributions, and an enroll dialog for several people at once), and enrollment. The enrollment page has a balance summary (recorded vs outstanding), a selectable day-by-day schedule, a cash confirmation dialog and paged history. `COOKIE_SECURE=false` is only for running the production build over plain-HTTP localhost (Compose sets it).

## Demo contract
1. Seed a collector, Amina, an active daily plan at ₦1,000/day, an enrollment, and a cash record for Oct 1–23.
2. Authenticate as the collector (`POST /auth/login`) or with a collector-bound integration key.
3. `GET /enrollments/{id}/summary?asOf=2026-10-25` → `recordedTotalMinor: 2300000`, unpaid `2026-10-24`, `2026-10-25`.
4. `POST /contribution-intents` (Idempotency-Key), then `POST /contribution-intents/{id}/confirm` for `2026-10-25`.
5. Summary again → `recordedTotalMinor: 2400000`; `2026-10-25` is no longer unpaid.
6. Repeat the confirm → same `contributionId`; no duplicate.

Verified locally against the Docker Compose stack on 2026-10-25. Not yet verified against a remote deployment. See [`docs/API.md`](docs/API.md) for request examples.
