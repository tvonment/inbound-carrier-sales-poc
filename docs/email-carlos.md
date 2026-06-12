# Email draft — deliverable 1

> To: c.becker@happyrobot.ai
> Cc: [recruiter]
> Subject: Inbound carrier sales PoC — ready for our meeting

Hi Carlos,

Ahead of our meeting, a quick update on the inbound carrier sales proof of
concept for Acme Logistics — it's live end to end.

**What's working today**

- Carriers call in via web call and talk to "Alex", our inbound agent. It
  verifies their MC number against FMCSA before any load talk, pitches the
  best match from the load board, and negotiates price — up to three rounds,
  with the accept/counter decision made deterministically by our pricing API
  rather than by the prompt. On agreement the load is booked and the call is
  handed off to a rep.
- Every call — booked, failed, or abandoned — is classified by outcome and
  carrier sentiment, and the offer data is extracted into a metrics store.
- A live dashboard (link below) shows call volume, conversion, outcome and
  sentiment breakdowns, and agreed-vs-listed rate — the margin view.

**Under the hood:** FastAPI + PostgreSQL on Azure Container Apps, fronted by
Azure API Management — HTTPS and key auth at the gateway, and the backend
itself only accepts the gateway's Microsoft Entra ID identity (zero shared
secrets behind the front door). Fully containerized and reproducible with a
single `azd up`.

**Links**

- Dashboard: [DASHBOARD_URL]
- Code repository: [REPO_URL]
- HappyRobot workflow: [WORKFLOW_URL]
- Demo video (5 min): [VIDEO_URL]

If you'd like to try it before we talk: call in, give MC 123456 ("Sunrise
Freight"), and ask for a dry van out of Chicago — then counter the rate and
see how Alex holds the line. An ineligible carrier (try MC 111999) gets
politely turned away.

Looking forward to walking you through it.

Best,
Thomas

---

*Before sending: replace the four bracketed links, set the recruiter in Cc,
and adjust the demo MC numbers if the FMCSA webkey has been wired in
(real verification replaces the mock).*
