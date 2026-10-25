# Product requirements · AjoDesk

## 1. Problem
Small daily thrift collectors can manage dozens of contributors with notebooks, spreadsheets, and WhatsApp messages. Finding a payment record, identifying unpaid days, and proving a balance can require manual reconciliation. The initial paying customer is a **collector/operator** who needs reliable records and faster answers, not another consumer savings wallet.

## 2. Target customer and workflow
- **Collector:** owns the account and is responsible for receiving cash and attesting collections.
- **Contributor:** a person registered under a collector and enrolled in a daily plan; no contributor login in the MVP.
- **External integration:** a client authorized by the collector to read records or initiate collector-attested writes via REST. It is not a separate user type with unrestricted access.

Example: a collector sets up a ₦1,000 per day plan, enrolls Amina for 30 days, records that Amina paid for October 25, and can immediately show her contribution history and which scheduled dates remain unpaid.

## 3. MVP (must work)
1. Collector signup/login and collector-owned data isolation.
2. Register and search contributors; identical names are allowed.
3. Create an NGN **daily**, fixed-amount, date-bounded savings plan.
4. Enroll a contributor in a plan (one enrollment per contributor/plan in MVP).
5. Record collector-attested **cash** contributions for one or more explicit scheduled dates; each date represents exactly one full day's amount (no partial allocation in MVP).
6. Read contribution history, aggregate recorded savings, due-to-date amount and unpaid scheduled dates.
7. Prepare and confirm a contribution as a generic REST workflow so third-party clients can safely request a write after showing the operator the exact details.
8. Durable idempotency; atomic financial writes; audit trail.
9. Minimal collector dashboard for contributors, plans, enrollments, contribution history, and balance summaries.
10. Collector-scoped read/write integration credentials, authenticated independently of the dashboard.

## 4. MVP boundaries
**Not included:** Paystack, direct electronic payments, withdrawals, payouts, custody of savings, interest, lending, rotational ajo, SMS, automated reminders, contributor WhatsApp authentication, partial-day payments, reversible financial corrections, actual collection fees, multi-currency, and recurring background jobs. Document these as future possibilities, not functioning features.

A disputed payment may be noted manually outside the MVP; an in-app dispute workflow can be a later phase. Never correct a posted contribution by simply overwriting it.

## 5. Basic user journeys
### A. Set up a collection
1. Collector signs in.
2. Creates a daily plan with an amount, name, start and end date.
3. Adds or selects a contributor and enrolls them.
4. Views the initial schedule and expected contributions.

### B. Record cash (dashboard)
1. Collector selects an enrollment and one or more unpaid schedule dates.
2. UI displays the computed total and requests confirmation.
3. API records the event with an idempotency key and audit entry.
4. UI shows the returned contribution reference and refreshed summary.

### C. Record cash (external client)
1. Authenticated client looks up the contributor and enrollment.
2. Creates a pending contribution intent with requested scheduled dates.
3. Displays returned amount and exact details to the operator.
4. Operator confirms in the client; client submits the intent ID.
5. API validates ownership, single-use intent, and state; persists once.
6. Client fetches updated summary. An intent is **not** proof of cash receipt on its own.

### D. Find missed days
For a requested `asOf` date, list scheduled dates through that date with no active paid allocation. Future scheduled days are not overdue.

## 6. Business rules
- Money is represented internally in integer **kobo**; e.g., ₦1,000 = `100000`.
- Plans use `NGN` and `DAILY` for the MVP.
- The business calendar is `Africa/Lagos`, with ISO date-only scheduled dates.
- Each enrollment has a known effective start and end; no schedule outside its plan.
- Each scheduled day can be fully covered by **one** active allocation in the MVP.
- A single cash event may cover multiple unpaid dates; amount equals daily amount × number of selected dates.
- Never accept an asserted cash payment as bank-verified funds.
- Data belongs to the collector; names are not unique identifiers.

## 7. UX principles
Fast search, clear plan and contributor identification, large currency labels, prominent confirmation before writes, visible payment method/attestation status, and plain-language errors. Show both **total recorded contributions** and **due-to-date outstanding**; these are different values.

## 8. Acceptance criteria
- A new collector can create a contributor, plan, and enrollment via API.
- A ₦1,000 payment for one day produces one posted contribution and one allocation.
- The enrollment summary changes by ₦1,000 after confirmation.
- Repeated confirmation and duplicate idempotency keys do not create another record.
- Another collector cannot read or write the enrollment.
- Empty matches, multiple name matches, dates already paid, invalid amounts, and expired intents receive explicit errors.
- An independently authenticated integration credential can perform the same approved action via public HTTPS REST calls.

## 9. Later improvements (not required for first submission)
Partial installments and FIFO allocation, contribution reversals with compensating records, configurable collector fees, dispute handling, payout scheduling without disbursement, Paystack test payments with webhook reconciliation, multi-plan reporting, and contributor self-service after trusted identity proofing.
