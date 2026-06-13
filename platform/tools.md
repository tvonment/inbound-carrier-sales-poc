# Tool / function definitions + webhook configs

> One tool node per function on the voice agent; each tool's child node is a
> Webhook action that calls our API through APIM.
>
> Replace `{{GATEWAY_URL}}` with the APIM gateway base URL
> (e.g. `https://apim-acme-poc.azure-api.net/carrier-api`) and
> `{{SUBSCRIPTION_KEY}}` with the APIM subscription key.
>
> Headers on the deployed webhooks:
> - `Ocp-Apim-Subscription-Key: {{SUBSCRIPTION_KEY}}` (APIM gateway auth)
> - `Content-Type: application/json`
>
> The FastAPI `X-API-Key` is NOT set on the nodes — APIM fronts the API and
> supplies the backend credentials (managed-identity Easy Auth + the API key),
> so the workflow only carries the subscription key.

---

## 1. verify_mc

**Tool description (for the agent):**
Verify a carrier's MC number against FMCSA records. Call this before discussing any loads. Returns whether the carrier is eligible to work with us.

**Parameters:**

```json
{
  "type": "object",
  "properties": {
    "mc_number": {
      "type": "string",
      "description": "The carrier's MC number, digits only (e.g. '123456'). Strip any 'MC' prefix."
    }
  },
  "required": ["mc_number"]
}
```

**Webhook child node:**
- Method: `POST`
- URL: `{{GATEWAY_URL}}/api/verify-mc`
- Body: `{"mc_number": "{{mc_number}}"}`

**Response (relay to agent):**

```json
{"mc_number": "123456", "eligible": true, "carrier_name": "Sunrise Freight LLC", "status": "ACTIVE", "reason": "Carrier is authorized and active."}
```

---

## 2. search_loads

**Tool description (for the agent):**
Search available loads by origin city and optional filters. Returns up to 3 matching loads, best match first. Pitch only the first result unless the carrier declines it.

**Parameters:**

```json
{
  "type": "object",
  "properties": {
    "origin": {
      "type": "string",
      "description": "Origin city the carrier wants to pick up from, e.g. 'Chicago'. City name is enough."
    },
    "destination": {
      "type": "string",
      "description": "Optional destination city if the carrier mentioned one."
    },
    "equipment_type": {
      "type": "string",
      "description": "Optional equipment type: 'Dry Van', 'Reefer', or 'Flatbed'.",
      "enum": ["Dry Van", "Reefer", "Flatbed"]
    },
    "pickup_date": {
      "type": "string",
      "description": "Optional pickup date in YYYY-MM-DD format if the carrier mentioned one."
    }
  },
  "required": ["origin"]
}
```

**Webhook child node:**
- Method: `GET`
- URL: `{{GATEWAY_URL}}/api/loads/search?origin={{origin}}&destination={{destination}}&equipment_type={{equipment_type}}&pickup_date={{pickup_date}}`
  (omit empty params)

**Response (relay to agent):**

```json
{
  "results": [
    {
      "load_id": "L-1001",
      "origin": "Chicago, IL",
      "destination": "Dallas, TX",
      "pickup_datetime": "2026-06-12T08:00:00",
      "delivery_datetime": "2026-06-13T08:00:00",
      "equipment_type": "Dry Van",
      "loadboard_rate": 2150.0,
      "miles": 968.0,
      "weight": 42000.0,
      "commodity_type": "Paper products",
      "num_of_pieces": 26,
      "dimensions": "53' trailer, standard pallets",
      "notes": "No-touch freight, drop and hook at origin."
    }
  ],
  "count": 1
}
```

---

## 3. evaluate_offer

**Tool description (for the agent):**
Evaluate a carrier's counter-offer on a load. Call once per negotiation round with the round number (1, 2, or 3 — you count the rounds). Returns accept, counter (with our counter amount), or reject.

**Parameters:**

```json
{
  "type": "object",
  "properties": {
    "load_id": {
      "type": "string",
      "description": "The load being negotiated, e.g. 'L-1001'."
    },
    "offer_amount": {
      "type": "number",
      "description": "The carrier's offered rate in USD, e.g. 2400."
    },
    "round_number": {
      "type": "integer",
      "description": "Which negotiation round this is: 1 for the first counter-offer, 2 for the second, 3 for the third and final."
    }
  },
  "required": ["load_id", "offer_amount", "round_number"]
}
```

**Webhook child node:**
- Method: `POST`
- URL: `{{GATEWAY_URL}}/api/evaluate-offer`
- Body: `{"load_id": "{{load_id}}", "offer_amount": {{offer_amount}}, "round_number": {{round_number}}}`

**Response (relay to agent):**

```json
{"decision": "counter", "counter_amount": 2405.0, "reason": "Offer $2,500 is above our limit this round; we can do $2,405.", "round_number": 1, "max_rounds": 3}
```

---

## 4. book_load

**Tool description (for the agent):**
Book a load for a verified carrier at the agreed rate. Only call this after a price has been explicitly agreed. Returns a confirmation ID.

**Parameters:**

```json
{
  "type": "object",
  "properties": {
    "load_id": {
      "type": "string",
      "description": "The load to book, e.g. 'L-1001'."
    },
    "mc_number": {
      "type": "string",
      "description": "The carrier's verified MC number."
    },
    "agreed_rate": {
      "type": "number",
      "description": "The final agreed rate in USD."
    }
  },
  "required": ["load_id", "mc_number", "agreed_rate"]
}
```

**Webhook child node:**
- Method: `POST`
- URL: `{{GATEWAY_URL}}/api/book`
- Body: `{"load_id": "{{load_id}}", "mc_number": "{{mc_number}}", "agreed_rate": {{agreed_rate}}}`

**Response (relay to agent):**

```json
{"confirmation_id": "ACME-1A2B3C4D", "load_id": "L-1001", "agreed_rate": 2300.0, "message": "Load L-1001 booked at $2,300. Confirmation ACME-1A2B3C4D."}
```

Errors: `409` = load already booked (tell the carrier it was just taken); `404` = unknown load.

---

## 5. Post-call webhook (not a tool — workflow node after the call ends)

Fires on EVERY call end, including failures and hangups. See `extract_schema.md`
for how the payload fields are produced by the AI Extract / classify nodes.

- Method: `POST`
- URL: `{{GATEWAY_URL}}/api/calls`
- Headers: same as above
- Body:

```json
{
  "outcome": "{{outcome}}",
  "mc_number": "{{mc_number}}",
  "load_id": "{{load_id}}",
  "sentiment": "{{sentiment}}",
  "negotiation_rounds": {{negotiation_rounds}},
  "initial_offer": {{initial_offer}},
  "final_rate": {{final_rate}},
  "transcript": "{{transcript}}",
  "extracted": {{extracted_json}}
}
```

Only `outcome` is required — every other field may be null (e.g. a caller who
hangs up before giving an MC number still produces a row with
`outcome: "abandoned"`).
