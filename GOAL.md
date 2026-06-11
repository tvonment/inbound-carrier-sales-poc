# GOAL.md - Inbound Carrier Sales PoC (HappyRobot FDE Technical Challenge)

> Handover brief for Claude Code. Read this fully before writing any code.
> This file is the source of truth for scope, architecture decisions, and their rationale.
> When in doubt: simpler, explainable, demoable. This is a PoC for an interview, not a product.

---

## 1. Context

I (Thomas) am interviewing for a Forward Deployed Engineer role at HappyRobot.
The technical challenge: build a working proof of concept on the HappyRobot platform
that automates **inbound carrier load sales** for a fictional freight brokerage
("Acme Logistics"), then present it to a customer (played by the interviewer, Carlos Becker).

The system: carriers call in, an AI voice agent vets them (FMCSA MC number check),
matches them to available loads, pitches the load, negotiates price (max 3 rounds),
and on agreement mock-transfers to a sales rep. After the call, structured data is
extracted, the call is classified by outcome and carrier sentiment, and everything
feeds a custom-built metrics dashboard.

**What is being assessed:** technical depth, customer-centric thinking, product vision,
clear communication. Every architecture choice must have a one-sentence justification
a non-engineer customer would accept.

---

## 2. Hard requirements (from the challenge PDF)

### Objective 1 - Inbound use case on HappyRobot
- Inbound voice agent using the **web call trigger** (do NOT buy a phone number)
- Agent must:
  1. Collect MC number, verify carrier eligibility via the **FMCSA API**
  2. Search loads via our REST API and pitch details
  3. Ask if carrier accepts the load
  4. Evaluate counter-offers, max **3 negotiation rounds**
  5. On agreement: mock transfer ("Transfer was successful..."), wrap up
  6. Post-call: extract offer data, classify call outcome, classify carrier sentiment

### Load data schema (fixed, from the brief)
| Field | Type |
|---|---|
| load_id | string, PK |
| origin | string |
| destination | string |
| pickup_datetime | timestamp |
| delivery_datetime | timestamp |
| equipment_type | string (Dry Van, Reefer, Flatbed, ...) |
| loadboard_rate | numeric |
| notes | text |
| weight | numeric |
| commodity_type | string |
| num_of_pieces | integer |
| miles | numeric |
| dimensions | string |

### Objective 2 - Metrics dashboard
- Build it ourselves (explicitly NOT platform analytics)
- Shows use case metrics: call volume, outcome distribution, conversion rate,
  sentiment distribution, avg negotiation rounds, accepted price vs loadboard rate delta

### Objective 3 - Deployment & infrastructure
- Containerize with Docker
- Deploy to a cloud provider (we use **Azure**)
- HTTPS + **API key auth on all endpoints**
- Clear instructions to access and reproduce the deployment

### Deliverables checklist
1. Email to Carlos Becker (c.becker@happyrobot.ai, recruiter in CC) with latest advancements
2. Build description document addressed to "Acme Logistics" (customer-facing writing!)
3. Access to deployed dashboard
4. Link to code repository
5. Link to HappyRobot workflow
6. 5-minute video: use case setup, demo, dashboard

---

## 3. Architecture (decided, do not re-litigate)

```
Carrier (browser, Web Call SDK)
        |
        v
HappyRobot platform
  - Inbound voice agent (web call trigger)
  - Tool nodes: verify_mc / search_loads / evaluate_offer / book_load
    -> each tool's child = Webhook POST action to our API
  - Post-call: AI Extract (offer data, sentiment) + classify outcome
    -> Webhook POST /api/calls (saves call record = metrics pipeline)
        |
        v
Azure API Management (Consumption tier)
  - subscription key auth, rate limiting, single HTTPS facade
        |
        v
Azure Container Apps environment
  - api:       FastAPI (Python 3.12)  -> /loads /verify-mc /evaluate-offer /book /calls /metrics
  - dashboard: React + Vite (served by nginx or FastAPI static)
        |
        v
Azure Database for PostgreSQL Flexible Server (B1ms free tier)
  - tables: loads, carriers, calls
  - raw transcript / extracted payload in jsonb columns

External: FMCSA QCMobile API (MC number verification, requires registered webkey)
```

### Decision log (the "why" for each, in customer language)

| Decision | Choice | Rationale |
|---|---|---|
| Integration style | Plain Webhook POST tool nodes (NOT MCP) | Simplest to explain, debug, and show in the platform editor. One integration pattern, not two. |
| Gateway | APIM **Consumption** tier | Pay-per-call (~free at PoC volume), provisions in minutes, gives key auth + rate limiting + key rotation without touching backend. Developer tier ($50/mo, 40min provision) would be over-engineering. |
| Database | PostgreSQL Flexible Server, free tier | Load schema is fixed and relational; dashboard is pure GROUP BY aggregations. Transcript goes in jsonb. Cosmos was considered and rejected: aggregations are awkward, schema isn't loose. |
| Negotiation logic | Backend endpoint `/evaluate-offer`, NOT prompt-only | Deterministic, testable, demoable in code. The prompt orchestrates; the backend decides accept/counter/reject. |
| Deployment | **azd** (Azure Developer CLI) + Bicep | This IS the reproducible-deployment deliverable. `azd up` = full environment. |
| CI/CD | `azd pipeline config` -> GitHub Actions with OIDC | Auto-generated, federated credentials (no secrets in repo), "every push to main redeploys". |
| Compute | Azure Container Apps, min replicas = 1 | Docker requirement satisfied; min 1 replica because tool calls happen mid-conversation - a cold start during the live demo is unacceptable. |

---

## 4. Backend API spec (FastAPI)

All endpoints behind API key (APIM subscription key; ALSO validate an `X-API-Key`
header in FastAPI middleware as defense in depth, since direct ACA FQDN is reachable).

| Method | Path | Purpose |
|---|---|---|
| GET | /healthz | liveness, no auth |
| POST | /api/verify-mc | body: `{mc_number}` -> calls FMCSA, returns `{eligible: bool, carrier_name, status, reason}`. Cache result in `carriers` table. **Must support MOCK_FMCSA=true env flag** (fallback if FMCSA is slow/down during demo). |
| GET | /api/loads/search | query: origin, destination?, equipment_type?, pickup_date? -> ranked list of matching loads. Fuzzy/partial match on cities. Return max 3. |
| POST | /api/evaluate-offer | body: `{load_id, offer_amount, round_number}` -> `{decision: accept\|counter\|reject, counter_amount?, reason}`. Logic: accept if offer <= loadboard_rate * (1 + threshold), threshold shrinks per round (e.g. 12% / 8% / 4%), reject after round 3. Thresholds via env vars. |
| POST | /api/book | body: `{load_id, mc_number, agreed_rate}` -> marks load booked, returns confirmation id. |
| POST | /api/calls | body: full post-call payload (mc_number, load_id?, outcome, sentiment, rounds, initial_offer, final_rate, transcript, extracted jsonb). This is the metrics ingestion endpoint. **Must accept failed/abandoned calls too** (outcome enum below), otherwise conversion metrics are fiction. |
| GET | /api/metrics | aggregated stats for the dashboard (or let dashboard query its own read endpoints; keep it one endpoint returning a metrics JSON for simplicity). |

### Enums
- `outcome`: booked | negotiation_failed | no_matching_load | carrier_not_eligible | abandoned
- `sentiment`: positive | neutral | negative
- `decision`: accept | counter | reject

### Latency budget
Every endpoint called mid-conversation (< 1s p95). The carrier is literally waiting
on the phone. No N+1 queries, connection pool warm, keep it lean.

---

## 5. HappyRobot workflow (platform side)

Org: `fdethomasvonmentlen` (enterprise tier), platform.happyrobot.ai/fdethomasvonmentlen
There is an MCP server connected to this org that can manage workflows programmatically
(Claude chat has it; not needed from Claude Code - I configure the platform myself,
but Claude Code should generate the agent prompt text and tool/function schemas as files).

Workflow shape:
```
Web call trigger (event_id: 6e32e01e-722f-4b8b-9372-500b845686d1)
  -> Inbound voice agent
       root prompt (negotiation orchestration, persona: "Alex from Acme Logistics")
       tools:
         - verify_mc(mc_number)            -> child: Webhook POST /api/verify-mc
         - search_loads(origin, equipment) -> child: Webhook POST(GET) /api/loads/search
         - evaluate_offer(load_id, offer_amount, round_number) -> child: POST /api/evaluate-offer
         - book_load(load_id, agreed_rate) -> child: POST /api/book
  -> AI Extract node (from transcript: mc_number, load_id, rates, rounds, sentiment)
  -> Classify outcome (AI Generate or extract param)
  -> Webhook POST /api/calls  (fires on EVERY call end, including failures)
```

Agent prompt requirements (generate as `platform/agent_prompt.md`):
- Greet, ask for MC number FIRST, verify before discussing loads
- If not eligible: politely end call (outcome: carrier_not_eligible)
- Collect lane preference (origin, equipment), call search_loads, pitch best match
  (origin -> destination, pickup, equipment, rate, miles)
- Ask if interested; handle counter-offers by calling evaluate_offer, relay decision
- Max 3 rounds, track round_number itself
- On agreement: "Transfer was successful and now you can wrap up the conversation" (mock)
- Keep responses SHORT (voice channel: 1-2 sentences per turn)

---

## 6. Dashboard (React)

Single page, reads GET /api/metrics (+ optional /api/calls list). Cards/charts:
- KPI row: total calls, booked count, conversion rate, avg negotiation rounds
- Outcome distribution (donut/bar)
- Sentiment distribution (bar)
- Avg agreed rate vs loadboard rate delta (the "margin" story - customers care)
- Recent calls table (time, MC, load, outcome, sentiment, final rate)
- Auto-refresh every ~15s (polling is fine, no websockets)

Keep dependencies minimal: Vite + React + recharts (or chart.js). No state library.
Visual quality matters (product vision is assessed) but no design-system yak shaving.

---

## 7. Repo structure

```
.
├── GOAL.md                  <- this file
├── README.md                <- setup, access, reproduce instructions (deliverable!)
├── azure.yaml               <- azd config
├── infra/                   <- Bicep (ACA env, APIM consumption, Postgres flex, ACR)
├── api/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/ (loads, verify, offers, calls, metrics)
│   │   ├── services/fmcsa.py   (with mock flag)
│   │   ├── services/negotiation.py
│   │   ├── db.py + models.py (SQLAlchemy) + migrations (alembic or simple init.sql)
│   │   └── seed/loads_seed.json + seeder
│   └── tests/                (negotiation logic + endpoint tests, pytest)
├── dashboard/
│   ├── Dockerfile
│   └── src/
├── platform/
│   ├── agent_prompt.md       (voice agent root prompt, ready to paste)
│   ├── tools.md              (tool/function schemas + webhook configs)
│   └── extract_schema.md     (AI Extract parameter definitions)
└── docs/
    ├── acme-build-description.md   (deliverable 2, customer-facing)
    └── email-carlos.md             (deliverable 1 draft)
```

---

## 8. Seed data requirements

20-30 loads, designed for a scripted demo:
- Guaranteed hits: several Dry Van loads out of **Chicago, IL** (demo line:
  "I'm looking for a dry van out of Chicago"), plus Dallas, Atlanta clusters
- Mix of equipment types (Dry Van, Reefer, Flatbed)
- Realistic rates ($1.8-3.5k range), miles, pickup dates within next 7 days
  (generate relative to deploy date, not hardcoded past dates!)
- A couple of deliberately unattractive loads (low rate) for negotiation color

---

## 9. Constraints, gotchas, sequencing

1. **FMCSA webkey**: register at FMCSA QCMobile API immediately (external dependency,
   unknown issuance time). Build mock fallback FIRST, wire real API when key arrives.
2. **Web call trigger only** - no phone number purchase.
3. ACA gives HTTPS automatically on its FQDN; APIM gives HTTPS on the gateway.
   No cert work needed.
4. Secrets: Postgres conn string, API key, FMCSA key -> ACA secrets / Key Vault refs,
   never in repo. azd handles env plumbing.
5. Min replicas 1 on the API container app (no cold starts mid-call).
6. Postgres free tier: B1ms, 750h/month, 32GB - one instance, fits.
7. Don't build: auth/user management, multi-tenancy, queues, the second "control plane"
   MCP idea (explicitly cut), websockets, k8s. PoC discipline.
8. Time-box the dashboard; the customer-facing docs (email + Acme doc) are graded
   deliverables and need real writing time.

## 10. Definition of done

- [ ] `azd up` from clean clone provisions everything and seeds the DB
- [ ] GitHub Actions deploys on push to main (azd pipeline config, OIDC)
- [ ] Web call demo: eligible MC -> search -> pitch -> 2-round negotiation -> book -> mock transfer
- [ ] Failure paths work: bad MC rejected, no-match handled gracefully
- [ ] /api/calls receives post-call payload from platform on every call end
- [ ] Dashboard live at public URL, shows real data from test calls
- [ ] README has access + reproduce instructions
- [ ] pytest green (negotiation thresholds + endpoint smoke tests)
- [ ] Email draft + Acme build description written
- [ ] 5-min video recorded
