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
managed PostgreSQL database. Everything is HTTPS. Every API call — including
the voice platform's — must present a valid API key, enforced at two
layers (the API gateway and the application itself), with rate limiting at
the gateway. Secrets live in Azure's secret store, never in code.

The entire environment is defined as code: one command (`azd up`) recreates
it from scratch, and every change pushed to the code repository deploys
automatically. That means a staging copy for testing costs minutes, not days.

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
  27 of our automated tests cover exactly that logic — not an LLM's mood.
- **Boring, explainable integration.** The voice platform talks to your
  systems through plain webhooks. Any engineer on your team can read,
  debug, and extend them.
- **Right-sized infrastructure.** Consumption-tier gateway, one small
  database, two containers. At pilot volume this runs for roughly the cost
  of a coffee per day, and it scales by changing a number, not the design.
