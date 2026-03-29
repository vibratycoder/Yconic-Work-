# Drug Interactions

Quick safety check for known interactions between a new drug and the user's current medications.

## Entry point

```
POST /api/drug-check
```

**Request:** `{ "user_id": "...", "new_drug": "ibuprofen" }`
**Response:** `{ "warnings": ["Potential interaction: warfarin + ibuprofen — Increased bleeding risk"] }`

## How it works

**File:** `backend/features/drug_interactions.py`

```
user_id + new drug name
         │
         ▼
Load profile → extract current_medications
         │
         ▼
check_drug_interactions(medications, new_drug)
  - Lowercase new_drug name
  - Lowercase all current medication names
  - Substring match against KNOWN_INTERACTIONS table
         │
         ▼
Return list of warning strings (empty = no interactions found)
```

## Known interaction table

Hardcoded pairs with clinical risk description:

| Drug A | Drug B | Risk |
|--------|--------|------|
| warfarin | aspirin | Increased bleeding risk |
| warfarin | ibuprofen | Increased bleeding risk |
| warfarin | naproxen | Increased bleeding risk |
| metformin | alcohol | Risk of lactic acidosis |
| ssri | tramadol | Risk of serotonin syndrome |
| maoi | ssri | Risk of serotonin syndrome — potentially fatal |
| lithium | ibuprofen | NSAIDs may elevate lithium levels |
| digoxin | amiodarone | Amiodarone increases digoxin toxicity risk |

Matching is case-insensitive substring — `"ibuprofen 400mg"` matches `"ibuprofen"`.

## Limitations

- Only checks against the hardcoded table — not a comprehensive interaction database
- Does not check dose-dependent interactions
- Not a substitute for clinical pharmacist review

The response includes a note directing users to confirm with their pharmacist or prescriber.

## Files

| File | Role |
|------|------|
| `backend/features/drug_interactions.py` | `check_drug_interactions()` |
| `backend/main.py` | `POST /api/drug-check` route |
