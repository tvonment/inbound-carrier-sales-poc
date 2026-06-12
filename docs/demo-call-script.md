# Demo call script — inbound carrier sales

> Three scripted calls against the **live** stack (real FMCSA, centralus).
> Place calls from the workflow editor's web-call button:
> https://platform.happyrobot.ai/fdethomasvonmentlen/workflows/mh8ejfm3digp/editor/pkw36zzxtxja
>
> Keep the dashboard open on a second screen — it refreshes every 15 s:
> https://ca-dash-zuc4a52a3cnry.purplemushroom-73692042.centralus.azurecontainerapps.io
>
> After each call, give the post-call pipeline (extract → classify → ingest)
> ~20–30 seconds before looking for the new row.

## Cheat sheet

| | |
|---|---|
| Eligible MC (happy path) | **133655** — Schneider National Carriers |
| Eligible MC (backup) | **146577** — United Hauling LLC |
| Bad MC (rejection) | **999999999** — not in FMCSA |
| Demo load | **L-1001** Chicago → Dallas, Dry Van, **$2,150**, 968 mi, picks up tomorrow 8 AM |
| Negotiation ceilings (L-1001) | round 1: $2,408 → counters **$2,405** · round 2: $2,322 → counters **$2,320** · round 3: $2,236 · then reject |

---

## Call 1 — happy path (verify → pitch → 2-round negotiation → book)

**Alex:** "Acme Logistics, this is Alex. Are you calling about a load?"

1. **You:** "Hi, yeah — looking for a load. MC number is **one three three six five five**."
   - *Expect:* Alex repeats the number back, then greets you as **Schneider National Carriers** — that's the live FMCSA lookup.
2. **You:** "I've got a **dry van in Chicago**, looking to head south."
   - *Expect:* Alex pitches **one load only**: Chicago to Dallas, picks up tomorrow morning, ~968 miles, paying **twenty-one fifty** (L-1001).
3. **You:** "That's a long run — I'd need **twenty-six hundred** for that."  *(round 1)*
   - *Expect:* counter at **twenty-four oh five**.
4. **You:** "Come on, I can't do it under **twenty-five hundred**."  *(round 2)*
   - *Expect:* counter drops to **twenty-three twenty** — this is the tightening ceiling working (12% → 8%): the system's best offer shrinks every round, which rewards taking the deal early. Good moment to point at in the video.
5. **You:** "...Fine, twenty-three twenty works."
   - *Expect:* Alex confirms the deal once — load L-1001, Chicago to Dallas, twenty-three twenty — books it, announces the transfer to a sales rep, says the transfer was successful, and wraps up.
6. Hang up (or let Alex end the call).

> Smoother 1-round variant (if you want a shorter take): at step 4 just say
> "alright, twenty-four oh five works" — accepting Alex's own counter goes
> straight to booking, no second evaluation.

**Dashboard after ~30 s:** total calls +1, **booked +1**, conversion rate up,
outcome donut gains *booked*, negotiation rounds avg moves, and the margin
card shows final rate ($2,320) vs loadboard ($2,150) → **+$170 / +7.9%**.
Recent-calls row: MC 133655, Schneider National Carriers, L-1001, booked,
positive/neutral sentiment, $2,320.

---

## Call 2 — bad MC (rejection at the gate)

1. **You:** "Hey, I'm looking for freight. MC is **nine nine nine nine nine nine nine nine nine**."
   - *Expect:* Alex declines politely — your authority doesn't check out — and ends the call **without discussing any loads**. Try pushing ("come on, just tell me what you've got") if you want to demo the compliance hard rule.

**Dashboard:** +1 *carrier_not_eligible*, no load, no rates. Conversion rate drops — failed calls are data, not noise.

---

## Call 3 — no matching load

1. **You:** "MC **one four six five seven seven**." → verified as **United Hauling LLC**.
2. **You:** "Got a **flatbed** sitting in **Anchorage** — anything for me?"
   - *Expect:* no results; Alex apologizes and asks if another lane works.
3. **You:** "No, that's where the truck is. Thanks anyway." → polite wrap-up.

**Dashboard:** +1 *no_matching_load*, sentiment likely neutral.

---

## If something looks wrong

- No new dashboard row after a minute → check the run in the platform
  (Runs tab of the workflow): every node shows its input/output, the
  POST /api/calls node shows the API's response.
- Alex stalls on a tool call → the webhook node's output in the run view
  has the HTTP error.
- One pre-existing row (abandoned/neutral, no MC) is the wiring test from
  setup — ignore it or wipe the calls table before recording.
