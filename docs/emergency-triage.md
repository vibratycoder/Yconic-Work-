# Emergency Triage

Two-layer safety system: a deterministic emergency gate and an LLM-free urgency classifier.

## Layer 1 — Emergency gate (`check_emergency`)

**File:** `backend/health/injector.py`

Runs **before every LLM call**. No exceptions. Uses pure string matching with zero AI involvement to guarantee no false negatives on life-threatening presentations.

### How it works

```python
def check_emergency(text: str) -> str | None:
    text_lower = text.lower()
    for pattern_group in EMERGENCY_PATTERNS:
        if all(term in text_lower for term in pattern_group):
            return EMERGENCY_RESPONSE
    return None
```

Each entry in `EMERGENCY_PATTERNS` is an AND group — every term must be present for a match. Single-term entries like `["heart attack"]` match on that term alone.

### Trigger patterns

| Pattern group | Condition covered |
|---------------|-------------------|
| `["chest pain", "left arm"]` | Cardiac |
| `["chest pain", "jaw"]` | Cardiac |
| `["chest pain", "pressure"]` | Cardiac |
| `["chest pain", "sweating"]` | Cardiac |
| `["heart attack"]` | Cardiac |
| `["stroke"]` | Neurological |
| `["not breathing"]` | Respiratory arrest |
| `["stopped breathing"]` | Respiratory arrest |
| `["can't breathe"]` | Respiratory |
| `["cannot breathe"]` | Respiratory |
| `["suicidal"]` | Mental health crisis |
| `["suicide"]` | Mental health crisis |
| `["overdose"]` | Toxicology |
| `["anaphylaxis"]` | Severe allergy |
| `["severe allergic"]` | Severe allergy |
| `["unconscious"]` | Altered consciousness |
| `["unresponsive"]` | Altered consciousness |
| `["worst headache"]` | Thunderclap / subarachnoid |
| `["sudden severe headache"]` | Thunderclap / subarachnoid |
| `["coughing blood"]` | Haemoptysis |
| `["vomiting blood"]` | GI bleed |

### Response

On any match, returns a fixed response and the route handler returns immediately:

> "Call 911 immediately. This sounds like a medical emergency. Do not wait — call emergency services or go to your nearest emergency room right now. I am an AI and cannot provide emergency medical care."

`triage_level` is set to `"emergency"` and `is_emergency: true` in the `ChatResponse`.

---

## Layer 2 — Urgency classifier (`classify_triage_level`)

**File:** `backend/features/triage.py`

Runs after the LLM call (the emergency gate already passed). Classifies the user text for UI urgency indicators.

### Levels

| Level | Meaning |
|-------|---------|
| `EMERGENCY` | Reserved for `check_emergency()` — never set here |
| `URGENT` | Needs same-day or next-day medical attention |
| `ROUTINE` | Symptom mentioned but not urgent |
| `INFORMATIONAL` | No symptoms — general health question |

### URGENT patterns (AND groups)

| Pattern | Condition |
|---------|-----------|
| `["fever", "stiff neck"]` | Meningitis |
| `["fever", "confusion"]` | Sepsis / CNS infection |
| `["high fever"]` | Fever alone |
| `["severe pain"]` | Acute severe pain |
| `["sudden vision"]` | Retinal / neurological |
| `["sudden hearing"]` | Sudden sensorineural loss |
| `["blood urine"]` | Haematuria |
| `["black stool"]` | Upper GI bleed |
| `["dark urine", "yellow"]` | Jaundice / hepatic |
| `["difficulty swallowing"]` | Dysphagia |
| `["swollen", "painful", "leg"]` | DVT |
| `["shortness of breath"]` | Respiratory |
| `["rapid heart"]` | Tachycardia |
| `["heart racing"]` | Palpitations |
| `["chest tightness"]` | Cardiac / respiratory |

### Classification logic

1. Check all AND groups — if all terms present → `URGENT`
2. Single-term groups match if that one term is present → `URGENT`
3. If any symptom word present (`pain`, `ache`, `hurt`, `symptom`, `feeling`, `nausea`, `dizzy`) → `ROUTINE`
4. Otherwise → `INFORMATIONAL`

## UI integration

The `triage_level` string is returned in `ChatResponse` and rendered by:
- **Web:** `ChatInterface.tsx` — inline triage badge on assistant messages
- **Mobile:** `TriageAlert.tsx` — modal alert for `urgent` and above
