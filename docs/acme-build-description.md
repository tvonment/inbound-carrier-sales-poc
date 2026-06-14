# Inbound Carrier Sales Automation — Build Description

**Prepared for:** Acme Logistics
**Prepared by:** Thomas von Mentlen
**Date:** June 2026

---

## What we built

Every day your brokerage takes calls from carriers looking for freight. Each
call follows the same script: check the carrier out, find a load that fits
their truck and lane, haggle over the rate, and hand the deal to a rep. We
automated that script.

Carriers now talk to an AI sales agent — "Alex" — that answers instantly,
24/7, never puts anyone on hold, and follows your pricing rules on every
single call. Your team only gets involved when there's a deal to close.

## How a call flows

1. **Verification first.** Alex asks for the carrier's MC number and checks
   it against FMCSA (the federal carrier registry) before discussing any
   freight. Carriers without active operating authority are politely turned
   away. No exceptions, no judgment calls.

2. **Load matching.** Alex asks where they want to run and what equipment
   they've got, searches your live load board, and pitches the best match —
   origin, destination, pickup time, miles, and rate, the way a broker would
   say it on the phone.

3. **Negotiation with guardrails.** If the carrier counters, the price logic
   runs in **your system, not in the AI's head**. The agent can accept up to a
   configurable margin over the listed rate, and that ceiling tightens each
   round — 12%, then 8%, then 4% by default. After three rounds it walks away
   politely. The AI never invents a number; every figure it quotes comes from
   your rate engine. You change the thresholds, the agent's behavior changes
   — no retraining, no prompt surgery.

4. **Booking and handoff.** On an agreed price the load is booked under the
   carrier's MC with a confirmation ID, and the call is handed to your sales
   rep to finalize paperwork.

5. **After every call** — including hang-ups and failed negotiations — the
   system extracts the offer data, classifies the outcome (booked, negotiation
   failed, no matching load, carrier not eligible, abandoned) and the
   carrier's sentiment, and stores it. Failed calls are data, not noise:
   that's how you find out which lanes you're losing and why.

## The dashboard

A live web dashboard shows the numbers a desk manager actually asks for:

- Call volume, loads booked, and **conversion rate**
- Outcome breakdown — where calls end and why
- Carrier sentiment across calls
- **Average agreed rate vs. listed rate** — what the automation is paying
  above board, i.e. your margin story
- A table of recent calls with MC, load, outcome, and final rate

It refreshes itself every 15 seconds. No logins to a vendor console, no
spreadsheet exports.

## Where it runs and how it's protected

The solution runs on Microsoft Azure in containers, with your load data in a
managed PostgreSQL database. The entire environment is defined as code: one
command (`azd up`) recreates it from scratch — a staging copy for testing
costs minutes, not days.

### Security hardening

Security is layered, so no single mistake exposes your data:

- **Encrypted everywhere.** Every connection — caller to gateway, gateway to
  application, application to database — is HTTPS/TLS. There is no
  unencrypted path.
- **One front door.** All traffic enters through an API gateway (Azure API
  Management). Each consumer — the voice platform, the dashboard — has its
  own access key that can be rotated or revoked in seconds, without
  touching the application.
- **No passwords between systems.** Behind the gateway, services prove who
  they are with **Microsoft Entra ID identities** (the same directory that
  runs your corporate logins) instead of shared secrets. The application
  platform itself rejects any caller that isn't the gateway — before a
  single line of our code runs. There is no key to steal for that hop, and
  nothing to rotate.
- **Belt and braces.** The application additionally checks its own API key
  on every request, so even a misconfigured gateway wouldn't expose data.
- **The dashboard sees numbers, not conversations.** The public dashboard
  can read exactly one thing: aggregated metrics. Call transcripts never
  leave the protected store, and the dashboard's credentials never reach
  the browser.
- **Secrets stay in Azure's vaulted store** — generated at deployment,
  never in code, never in the repository.
- **The database has no public address at all.** It lives behind a private
  endpoint inside our own virtual network: the application reaches it over
  Azure's internal backbone, and from the public internet there is nothing
  to connect to, let alone attack.

For a production rollout we would add, in order of value: Azure Key Vault
as the single secret authority, per-consumer rate limiting at the gateway,
custom domains, and audit logging of every administrative action. None of
these change the architecture — they're configuration, not surgery.

### Where your data lives

The platform runs in a US Azure region — deliberately. Acme is a US
brokerage, your carriers are FMCSA-registered, and the federal registry
only answers queries from inside the United States. The data sits next to
the customer and the regulator.

The same blueprint answers the opposite question too. For a European
brokerage we would deploy the identical stack to a Swiss or EU region, so
every call, transcript, and rate stays under European jurisdiction — and
route only the FMCSA eligibility check through a single relay container in
a peered US network. The only thing that would ever cross the Atlantic is a
carrier registration number. Because the whole environment is defined as
code, the region is a deployment parameter, not an architecture decision.

## What this is, and what it isn't (yet)

This is a working proof of concept built against a realistic but simulated
load board (24 demo loads) and web-based calls. To take it to production we
would connect your actual TMS/load board, switch on real phone numbers,
add carrier identity hardening (callback verification against FMCSA-listed
phone numbers), and agree negotiation thresholds per lane or per customer
rather than globally. The architecture was deliberately chosen so none of
those steps require a rebuild — they're integrations, not surgery.

## Why this approach

- **Deterministic pricing.** Rate decisions are code you can audit and test —
  half of our 33 automated tests cover exactly that negotiation and booking
  logic — not an LLM's mood.
- **Boring, explainable integration.** The voice platform talks to your
  systems through plain webhooks. Any engineer on your team can read,
  debug, and extend them.
- **Right-sized infrastructure.** Consumption-tier gateway, one small
  database, two containers. At pilot volume this runs for roughly the cost
  of a coffee per day, and it scales by changing a number, not the design.
