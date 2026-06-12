# Acme Logistics — Inbound Carrier Sales PoC

AI voice agent that answers inbound carrier calls, vets the carrier against
FMCSA, pitches matching loads, negotiates price (max 3 rounds), books the
load, and feeds a live metrics dashboard. Built on the
[HappyRobot](https://happyrobot.ai) platform for the FDE technical challenge.

## Architecture

```
Carrier (browser, web call)
        │
        ▼
HappyRobot platform ── voice agent + tools ── post-call extract/classify
        │  webhooks (HTTPS + subscription key)
        ▼
Azure API Management (Consumption)        ← subscription-key auth
        │  Entra ID token (managed identity)
        ▼
Azure Container Apps                      ← Easy Auth: only APIM gets in
  ├─ api        FastAPI (Python 3.12)     ← verify-mc, loads/search,
  │                                          evaluate-offer, book, calls, metrics
  └─ dashboard  React + nginx             ← live metrics, polls /api/metrics
        │
        ▼
Azure Database for PostgreSQL Flexible Server (B1ms)
```

- **APIM Consumption** fronts everything with subscription-key auth, and
  authenticates *itself* to the backend with an **Entra ID token from its
  managed identity** — no shared secret between gateway and API.
- **Easy Auth on the API container app** rejects any request without a valid
  token issued to APIM's identity *at the platform layer*, before traffic
  reaches the container. The Container App FQDN stays publicly routable
  (Consumption APIM supports no VNet), but it is not a side door: only
  `/healthz` answers without a token. The FastAPI app still validates its
  own `X-API-Key` header (injected by APIM policy) as defense in depth.
- **Negotiation is backend logic**, not prompt logic: `/api/evaluate-offer`
  accepts an offer up to `loadboard_rate × (1 + threshold)` with thresholds
  shrinking per round (12% / 8% / 4%, configurable via
  `NEGOTIATION_THRESHOLDS`). Deterministic and unit-tested.
- **FMCSA verification** calls the QCMobile API when `FMCSA_WEBKEY` is set;
  `MOCK_FMCSA=true` (default) uses a deterministic mock so demos never depend
  on an external service (MC numbers ending in `999` → not authorized, `000`
  → inactive, anything else eligible).
- The dashboard's nginx proxies **only `GET /api/metrics`** to the API and
  injects the API key **server-side** — the key never ships to the browser,
  and the public dashboard URL is not a side door into the other endpoints.

## Repo layout

```
api/          FastAPI backend, seed data, pytest suite, Dockerfile
dashboard/    React + Vite metrics dashboard, nginx Dockerfile
platform/     HappyRobot artifacts: agent prompt, tool schemas, extract schema
infra/        Bicep (Container Apps, APIM, PostgreSQL, ACR) for azd
azure.yaml    azd service config
```

## Run locally

API (SQLite by default, seeds 24 demo loads on first start):

```bash
cd api
uv sync
EXPOSE_DOCS=true uv run uvicorn app.main:app --reload   # http://localhost:8000/docs
uv run pytest                                            # 30 tests
```

Dashboard (proxies to the API on :8000):

```bash
cd dashboard
npm install
npm run dev                                    # http://localhost:5173
```

All endpoints except `/healthz` require `X-API-Key: dev-secret-key`
(configurable via `API_KEY`; see `api/.env.example`). That includes the
interactive docs unless `EXPOSE_DOCS=true` is set — it never is in Azure.

Or with Docker:

```bash
docker build -t acme-api ./api && docker run -p 8000:8000 acme-api
docker build -t acme-dash ./dashboard && \
  docker run -p 8080:80 -e API_URL=http://host.docker.internal:8000 acme-dash
```

## Deploy to Azure

Prerequisites: [azd](https://aka.ms/azd), Azure CLI, an Azure subscription.
Docker is NOT required: images are built remotely by ACR
(`remoteBuild: true` in `azure.yaml`).

```bash
azd auth login
azd up        # provisions everything + builds/pushes/deploys both containers
```

`azd up` first runs a preprovision hook that creates the Entra **app
registration** Easy Auth validates against (idempotent; requires `az login`
with permission to create app registrations) — then creates the resource
group, Container Apps environment, ACR, PostgreSQL Flexible Server, and
APIM, generates the database password and API key as azd secrets, and
prints:

- `DASHBOARD_URL` — the public dashboard
- `APIM_GATEWAY_URL` — base URL for the HappyRobot webhooks
- `API_BASE_URL` — direct API FQDN (Easy Auth: rejects everything but
  `/healthz` without an Entra token)

Get the APIM subscription key for the platform webhooks:

```bash
az rest --method post \
  --url "$(az apim list -g rg-<env-name> --query '[0].id' -o tsv)/subscriptions/happyrobot/listSecrets?api-version=2023-05-01-preview" \
  --query primaryKey -o tsv
```

The API seeds its 24 demo loads automatically on first startup (pickup dates
relative to deploy time). To re-seed later, restart the api container app
revision or run `python -m app.seed.seeder` against `DATABASE_URL`.

When the FMCSA webkey arrives: `azd env set FMCSA_WEBKEY <key> && azd up`
(this also flips `MOCK_FMCSA` to `false`).

### CI/CD (deliberately not set up)

Deploys are plain `azd up` / `azd deploy` — reproducible from a clean clone
with no pipeline dependency. If push-to-main deploys are ever wanted,
`azd pipeline config` generates a GitHub Actions workflow with OIDC
federated credentials (no secrets in the repo) in one command.

## HappyRobot platform setup

1. Create an inbound voice agent on a **web call trigger**.
2. Paste `platform/agent_prompt.md` as the root prompt.
3. Add the four tools from `platform/tools.md` (each tool's child = webhook
   POST/GET to `{{APIM_GATEWAY_URL}}` with the subscription key header).
4. Add the post-call nodes per `platform/extract_schema.md`, ending in a
   webhook `POST /api/calls` that fires on every call end.

### Post-deploy smoke tests

A read-only smoke suite runs against the deployed environment (skipped
locally unless configured):

```bash
cd api
SMOKE_GATEWAY_URL=$(azd env get-value APIM_GATEWAY_URL) \
SMOKE_API_BASE_URL=$(azd env get-value API_BASE_URL) \
SMOKE_SUBSCRIPTION_KEY=<apim subscription key> \
uv run pytest tests/test_smoke_deployed.py -v
```

It checks the happy paths through the gateway *and* that the side doors are
shut: no subscription key → 401, direct container access without an Entra
token → 401, `/docs` closed.

## Security

Layered, outside in:

1. **HTTPS everywhere** (Container Apps + APIM managed certs, no cert work).
2. **APIM subscription key** for all consumers (HappyRobot webhooks and the
   dashboard's nginx alike); rotate/revoke per consumer in seconds without
   redeploying.
3. **Gateway→backend auth via managed identity**: APIM acquires an Entra ID
   token with a user-assigned identity; **Easy Auth** on the API container
   app rejects any caller without a valid token for that exact identity —
   enforced by the platform sidecar before the app is reached. No shared
   secret, nothing to rotate or leak. (Consumption APIM has no VNet support
   and no static IP, so this is the supported way to shield the backend at
   this tier — identity instead of network perimeter.)
4. **App-level `X-API-Key`** (injected by APIM policy) as defense in depth;
   interactive docs are key-protected unless `EXPOSE_DOCS=true` (never set
   in Azure).
5. **Dashboard nginx proxies only `GET /api/metrics`** with the key held
   server-side; the metrics payload excludes transcripts.
6. **Secrets** (DB connection string, API key, FMCSA webkey) live in
   Container Apps secrets, generated/stored by azd — never in the repo.
7. **Postgres** accepts connections from Azure services only; TLS required.

Production roadmap beyond the PoC: see "Security hardening" in
`docs/acme-build-description.md`.
