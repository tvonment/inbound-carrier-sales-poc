# Post-call extraction & classification

> Configuration for the workflow nodes that run after the call ends:
> AI Extract (offer data) → Classify (outcome) → Classify (sentiment)
> → Webhook POST /api/calls.

---

## 1. AI Extract node — offer data

Extract from the full call transcript. The platform's AI Extract can't emit
null, so unknown **string** fields are output as an empty string and unknown
**numeric** fields as `0` (never the word "null"). The API normalizes on
ingestion (`api/app/routers/calls.py`): non-positive `final_rate`/`initial_offer`
become null, and because `negotiation_rounds: 0` is ambiguous (a genuine
"accepted at list" vs. a call that never reached pricing), rounds are nulled
for any outcome other than `booked`/`negotiation_failed`.

| Parameter | Type | Extraction instruction |
|---|---|---|
| `mc_number` | string | The carrier's MC number, digits only. Null if never provided. |
| `carrier_name` | string | Carrier company name as confirmed during verification. |
| `load_id` | string | The load ID that was pitched or booked (e.g. "L-1001"). Null if no load was discussed. |
| `initial_offer` | number | The FIRST rate the carrier asked for, in USD. Null if the carrier never countered. |
| `final_rate` | number | The final agreed rate in USD if a deal was made; otherwise the last rate discussed. |
| `negotiation_rounds` | integer | How many counter-offers the carrier made (0 if they accepted the listed rate, max 3). |

## 2. Classify node — call outcome

Single label, exactly one of:

| Label | When |
|---|---|
| `booked` | A price was agreed and the load was booked / transfer announced. |
| `negotiation_failed` | A load was pitched but no price agreement was reached within 3 rounds. |
| `no_matching_load` | Carrier was eligible but no suitable load was found for their lane. |
| `carrier_not_eligible` | MC verification failed; call ended at the vetting stage. |
| `abandoned` | Caller hung up or the call ended before reaching any of the above. |

## 3. Classify node — carrier sentiment

Single label, exactly one of: `positive` | `neutral` | `negative`.

Judge the CARRIER's overall tone across the call: cooperative and satisfied =
positive; matter-of-fact = neutral; frustrated, rude, or annoyed = negative.

## 4. Webhook node — POST /api/calls

Maps the outputs above into the request body (see `tools.md` §5 for headers/URL):

```json
{
  "outcome": "<classify-outcome label>",
  "sentiment": "<classify-sentiment label>",
  "mc_number": "<extract.mc_number>",
  "carrier_name": "<extract.carrier_name>",
  "load_id": "<extract.load_id>",
  "negotiation_rounds": "<extract.negotiation_rounds>",
  "initial_offer": "<extract.initial_offer>",
  "final_rate": "<extract.final_rate>",
  "transcript": "<full transcript text>",
  "extracted": "<entire extract output as JSON object>"
}
```

Validation on the API side: `outcome` and `sentiment` must match the enums
above (HTTP 422 otherwise); everything except `outcome` may be null.
