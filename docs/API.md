# REST API contract · AjoDesk v1

## Conventions
- Base path: `/api/v1`.
- JSON requests/responses; HTTPS required outside localhost.
- Amounts use integer `amountMinor` in **kobo**, currency `NGN`.
- Dates use `YYYY-MM-DD` interpreted in the business calendar `Africa/Lagos`.
- Success response is the documented resource JSON (no unnecessary extra envelope). Errors use `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- All protected routes derive collector scope from credentials, never from a request `collectorId`.
- List endpoints support pagination (`limit`, `cursor`) with a bounded default limit.
- Concurrency-sensitive POST operations require `Idempotency-Key` for writes; pass stable values across retries.

## Authentication
Two credential types:
- Dashboard collector: `Authorization: Bearer <collector-jwt>` after login.
- External service: `Authorization: Bearer <collector-scoped-api-key>` with explicit scopes.

Never send the integration key in query strings or expose it to the Next.js browser. For demo integrations, provision the key server-side or with an operator-only CLI script.

| Method | Path | Auth | Function |
|---|---|---|---|
| `POST` | `/auth/register` | Public, rate limited | Register collector |
| `POST` | `/auth/login` | Public, rate limited | Collector login |
| `GET` | `/auth/me` | Collector JWT | Identity |
| `GET` | `/contributors` | `contributors:read` | Search (`?search=amina`) |
| `POST` | `/contributors` | `contributors:write` | Create contributor |
| `GET` | `/contributors/:id` | `contributors:read` | Contributor detail |
| `POST` | `/plans` | `plans:write` | Create daily plan |
| `GET` | `/plans` | `plans:read` | List plans |
| `GET` | `/plans/:id` | `plans:read` | Plan detail |
| `GET` | `/plans/:id/summary` | `plans:read`, `contributions:read` | Plan totals across all enrollments (`?asOf=YYYY-MM-DD`) |
| `GET` | `/plans/:id/enrollments` | `plans:read`, `enrollments:read`, `contributions:read` | Contributors in the plan, each with a balance summary (`?asOf`, paginated) |
| `GET` | `/plans/:id/contributions` | `plans:read`, `contributions:read` | Every posted contribution in the plan with contributor name (paginated) |
| `POST` | `/enrollments` | `enrollments:write` | Enroll contributor |
| `GET` | `/enrollments/:id` | `enrollments:read` | Enrollment detail |
| `GET` | `/enrollments/:id/summary` | `contributions:read` | Due/paid summary (`?asOf=YYYY-MM-DD`) |
| `GET` | `/enrollments/:id/contributions` | `contributions:read` | Contribution history |
| `POST` | `/contributions` | Collector JWT only | Direct authorized UI posting |
| `GET` | `/contributions/:id` | `contributions:read` | Posted record |
| `POST` | `/contribution-intents` | `contributions:prepare` | Prepare external write |
| `GET` | `/contribution-intents/:id` | `contributions:prepare` | Read status/uncertain outcome |
| `POST` | `/contribution-intents/:id/confirm` | `contributions:confirm` | Commit intent exactly once |
| `GET` | `/health` | Public | Liveness/health |

In the tables, collectors authenticated by dashboard JWT possess their own allowed operations; the named scopes principally constrain integration credentials. `POST /contributions` is reserved for collector JWTs in v1. External keys use the intent flow.

## Important request/response examples

### Create contributor
```http
POST /api/v1/contributors
Authorization: Bearer <collector-jwt>
Content-Type: application/json
```
```json
{ "fullName": "Amina Yusuf", "phone": "+2348000000101" }
```
Response `201`:
```json
{ "id": "<uuid>", "fullName": "Amina Yusuf", "phone": "+2348000000101", "status": "ACTIVE" }
```

### Create plan
```http
POST /api/v1/plans
```
```json
{ "name": "October Daily Savings", "dailyAmountMinor": 100000, "currency": "NGN", "frequency": "DAILY", "startOn": "2026-10-01", "endOn": "2026-10-30" }
```
Response `201`: plan with generated `id` and `status: ACTIVE`.

### Enroll contributor
```http
POST /api/v1/enrollments
```
```json
{ "contributorId": "<contributor-uuid>", "planId": "<plan-uuid>", "startOn": "2026-10-01", "endOn": "2026-10-30" }
```
Response `201`: enrollment with `id`.

### Retrieve summary
```http
GET /api/v1/enrollments/<enrollment-uuid>/summary?asOf=2026-10-25
```
Response `200` (values illustrative, determined by persisted records):
```json
{
  "enrollmentId": "<enrollment-uuid>",
  "currency": "NGN",
  "dailyAmountMinor": 100000,
  "asOf": "2026-10-25",
  "recordedTotalMinor": 2300000,
  "dueMinor": 2500000,
  "paidTowardDueMinor": 2300000,
  "outstandingDueMinor": 200000,
  "prepaidMinor": 0,
  "unpaidDatesCount": 2,
  "unpaidDates": ["2026-10-24", "2026-10-25"]
}
```
This example assumes all 23 earlier dates were paid and two dates remain due. The output must always be computed from actual records, not hardcoded.

### Prepare a contribution
```http
POST /api/v1/contribution-intents
Authorization: Bearer <collector-scoped-api-key>
Idempotency-Key: prepare-demo-001
Content-Type: application/json
```
```json
{
  "enrollmentId": "<enrollment-uuid>",
  "scheduledDates": ["2026-10-25"],
  "amountMinor": 100000,
  "currency": "NGN",
  "paymentMethod": "CASH"
}
```
Response `201`:
```json
{
  "intentId": "<intent-uuid>",
  "status": "PENDING",
  "enrollmentId": "<enrollment-uuid>",
  "contributorName": "Amina Yusuf",
  "scheduledDates": ["2026-10-25"],
  "amountMinor": 100000,
  "currency": "NGN",
  "paymentMethod": "CASH",
  "expiresAt": "2026-10-25T10:45:00Z"
}
```
Only the server computes/validates the authoritative amount; the input amount is a requested value that must match.

### Confirm the prepared contribution
```http
POST /api/v1/contribution-intents/<intent-uuid>/confirm
Authorization: Bearer <same-collector-scoped-api-key>
Idempotency-Key: confirm-demo-001
```
Response `200`:
```json
{
  "intentId": "<intent-uuid>",
  "status": "COMPLETED",
  "contributionId": "<contribution-uuid>",
  "amountMinor": 100000,
  "currency": "NGN",
  "verificationStatus": "COLLECTOR_ATTESTED"
}
```
The response never says bank-verified or funds-settled. A replay must return the same contribution ID without posting again.

### Direct dashboard contribution
```http
POST /api/v1/contributions
Authorization: Bearer <collector-jwt>
Idempotency-Key: dashboard-collection-001
Content-Type: application/json
```
```json
{ "enrollmentId": "<enrollment-uuid>", "scheduledDates": ["2026-10-25"], "amountMinor": 100000, "currency": "NGN", "paymentMethod": "CASH" }
```
Response `201`: posted contribution object with `id`, `amountMinor`, `status`, `verificationStatus`, and allocated dates.

## Required errors
| HTTP | Code | Trigger |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid dates/amount/input |
| 401 | `UNAUTHENTICATED` | Missing/invalid credential |
| 403 | `FORBIDDEN` | Insufficient scope or collector ownership |
| 404 | `NOT_FOUND` | Missing resource within current collector scope |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key, changed payload |
| 409 | `SCHEDULE_DATE_ALREADY_PAID` | Duplicate scheduled date |
| 409 | `INTENT_ALREADY_CANCELLED` | Cannot confirm cancelled intent |
| 409 | `EMAIL_ALREADY_REGISTERED` | Register with an existing email |
| 409 | `ENROLLMENT_ALREADY_EXISTS` | Contributor already enrolled in the plan |
| 410 | `INTENT_EXPIRED` | Intent has expired |
| 429 | `RATE_LIMITED` | Too many login/register attempts |
| 500 | `INTERNAL_ERROR` | Unexpected failure; the transaction was rolled back |
| 503 | `SERVICE_UNAVAILABLE` | Dependency unavailable, no false success |

Validation errors may include `error.details` (for example `fields`, `expectedAmountMinor`, `paidDates`, `outOfRangeDates`).

## Implementation notes (v1, as built)
- **OpenAPI:** Swagger UI at `/api/docs`, JSON at `/api/docs-json` (disable with `ENABLE_API_DOCS=false`).
- **Scopes:** `contributors:read|write`, `plans:read|write`, `enrollments:read|write`, `contributions:read|prepare|confirm`. Collector JWTs hold all of them. Integration keys are denied on any route that declares no scope (`/auth/me`, `POST /contributions`).
- **Idempotency-Key:** required on `POST /contributions` and `POST /contribution-intents`; 1–128 chars of `A-Z a-z 0-9 _ . -`. A replayed `POST /contributions` returns `201` with header `Idempotent-Replayed: true`. Confirm needs no key: the intent ID is the idempotency key, and the header is accepted and ignored.
- **Dates:** `scheduledDates` must be unique (duplicates → `400`), and the server sorts them. At most 366 per request.
- **Confirm response:** the intent view (`intentId`, `status`, `contributionId`, `amountMinor`, `currency`, `verificationStatus`, `scheduledDates`, …) plus `summary`, the enrollment summary computed as of today in Africa/Lagos.
- **Intent ownership:** only the exact principal that prepared an intent may confirm it (another key of the same collector, or the collector's JWT, gets `403`). `GET /contribution-intents/:id` reports `EXPIRED` for a lapsed pending intent.
- **Summary fields:** the example above plus `startOn`, `endOn`, `eligibleDaysCount`, `dueDaysCount`, `paidDaysCount`, `paidDates`, `upcomingUnpaidDatesCount`, `verificationStatus`, `contributorName`, `planName`.
- **Plan totals** are the sum of each enrollment's own summary, so one contributor paying ahead never offsets another contributor's missed days. Fields: `enrollmentsCount`, `activeEnrollmentsCount`, `recordedTotalMinor`, `dueMinor`, `paidTowardDueMinor`, `outstandingDueMinor`, `prepaidMinor`, `missedDaysCount`, `enrollmentsWithMissedDaysCount`.
- **Contributor detail** includes `enrollments[]` so clients can go from a name search to an enrollment ID.
- **Lists** return `{ "items": [...], "nextCursor": "<opaque>|null" }`; `limit` is 1–100, default 20.
- **Every response** carries an `X-Request-Id` header, which matches `error.requestId`.

## Endpoint design note
This is **AjoDesk's generic REST contract**. Any external client may consume it if properly authorized; do not add platform-specific endpoints to this repository. Generating client tool schemas or managing messaging channels belongs to the external integration project.
