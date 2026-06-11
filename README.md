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
Azure API Management (Consumption)        ← key auth, rate limiting
        │
        ▼
Azure Container Apps
  ├─ api        FastAPI (Python 3.12)     ← verify-mc, loads/search,
  │                                          evaluate-offer, book, calls, metrics
  └─ dashboard  React + nginx             ← live metrics, polls /api/metrics
        │
        ▼
Azure Database for PostgreSQL Flexible Server (B1ms)
```

- **APIM Consumption** fronts everything with subscription-key auth (the
  Consumption sku has no rate-limit policy support); the FastAPI app
  additionally validates its own `X-API-Key` header (defense in depth — the
  Container App FQDN is also reachable directly).
- **Negotiation is backend logic**, not prompt logic: `/api/evaluate-offer`
  accepts an offer up to `loadboard_rate × (1 + threshold)` with thresholds
  shrinking per round (12% / 8% / 4%, configurable via
  `NEGOTIATION_THRESHOLDS`). Deterministic and unit-tested.
- **FMCSA verification** calls the QCMobile API when `FMCSA_WEBKEY` is set;
  `MOCK_FMCSA=true` (default) uses a deterministic mock so demos never depend
  on an external service (MC numbers ending in `999` → not authorized, `000`
  → inactive, anything else eligible).
- The dashboard's nginx proxies `/api/*` to the API and injects the API key
  **server-side** — the key never ships to the browser.

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
uv run uvicorn app.main:app --reload          # http://localhost:8000/docs
uv run pytest                                  # 29 tests
```

Dashboard (proxies to the API on :8000):

```bash
cd dashboard
npm install
npm run dev                                    # http://localhost:5173
```

All API endpoints except `/healthz` require `X-API-Key: dev-secret-key`
(configurable via `API_KEY`; see `api/.env.example`).

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

`azd up` creates the resource group, Container Apps environment, ACR,
PostgreSQL Flexible Server, and APIM, generates the database password and API
key as azd secrets, and prints:

- `DASHBOARD_URL` — the public dashboard
- `APIM_GATEWAY_URL` — base URL for the HappyRobot webhooks
- `API_BASE_URL` — direct API FQDN (still key-protected)

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

### CI/CD

```bash
azd pipeline config
```

Generates a GitHub Actions workflow with OIDC federated credentials (no
secrets in the repo); every push to `main` redeploys.

## HappyRobot platform setup

1. Create an inbound voice agent on a **web call trigger**.
2. Paste `platform/agent_prompt.md` as the root prompt.
3. Add the four tools from `platform/tools.md` (each tool's child = webhook
   POST/GET to `{{APIM_GATEWAY_URL}}` with the subscription key header).
4. Add the post-call nodes per `platform/extract_schema.md`, ending in a
   webhook `POST /api/calls` that fires on every call end.

## Security

- HTTPS everywhere (Container Apps + APIM managed certs, no cert work).
- APIM subscription key at the gateway + `X-API-Key` enforced by the app.
- Secrets (DB connection string, API key, FMCSA webkey) live in Container
  Apps secrets, generated/stored by azd — never in the repo.
- Postgres accepts connections from Azure services only; TLS required.
