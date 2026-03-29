# Emergency Triage

## Overview

The emergency triage gate is a deterministic safety mechanism that runs **before every LLM call** in the Sana Health backend. It uses pure string matching — no AI involvement — to ensure zero false negatives on life-threatening symptom presentations.

This is the single most safety-critical component in the codebase. It must have 100% test coverage and must never be bypassed.

---

## `check_emergency()`

**File:** `backend/health/injector.py`

**Signature:** `def check_emergency(text: str) -> str | None`

### What it does

1. Lowercases the input text
2. Iterates over `EMERGENCY_PATTERNS` — a list of AND-groups
3. For each pattern group, checks that **all** terms in the group are present in the lowercased text
4. Returns `EMERGENCY_RESPONSE` (the standard 911 directive string) if any group matches
5. Returns `None` if no group matches

### Why it must run before every LLM call

The LLM can hallucinate, time out, or return a delayed response. If a user is describing a cardiac arrest or stroke, waiting even a few seconds for an LLM to process the query is unacceptable. The `check_emergency()` function uses only Python string operations and returns in microseconds — it has no external dependencies and cannot fail.

The `/api/chat` route enforces this by calling `check_emergency()` as the very first statement, before any `await` calls.

```python
# In /api/chat — this is the first thing that runs
emergency_response = check_emergency(request.get_text())
if emergency_response:
    return ChatResponse(
        answer=emergency_response,
        is_emergency=True,
        triage_level="emergency",
    )
```

If an emergency is detected, the route returns immediately. No profile load, no domain classification, no LLM call.

### What it returns

**Emergency detected:** The constant string `EMERGENCY_RESPONSE`:

```
"Call 911 immediately. This sounds like a medical emergency. "
"Do not wait — call emergency services or go to your nearest emergency room right now. "
"I am an AI and cannot provide emergency medical care."
```

**No emergency:** `None`

---

## Emergency Patterns

`EMERGENCY_PATTERNS` is a `list[list[str]]`. Each inner list is an **AND-group** — all terms must be present in the text to trigger. Single-item lists match any text containing that term.

| # | Pattern Group | Example Trigger |
|---|--------------|----------------|
| 1 | `["chest pain", "left arm"]` | "chest pain radiating to left arm" |
| 2 | `["chest pain", "jaw"]` | "chest pain going to my jaw" |
| 3 | `["chest pain", "pressure"]` | "chest pain with pressure" |
| 4 | `["chest pain", "sweating"]` | "chest pain and sweating" |
| 5 | `["heart attack"]` | "I think I'm having a heart attack" |
| 6 | `["stroke"]` | "I think I'm having a stroke" |
| 7 | `["not breathing"]` | "he is not breathing" |
| 8 | `["stopped breathing"]` | "she stopped breathing" |
| 9 | `["can't breathe"]` | "I can't breathe" |
| 10 | `["cannot breathe"]` | "I cannot breathe" |
| 11 | `["suicidal"]` | "I am suicidal" |
| 12 | `["suicide"]` | "thinking about suicide" |
| 13 | `["overdose"]` | "I took an overdose" |
| 14 | `["anaphylaxis"]` | "I think I'm having anaphylaxis" |
| 15 | `["severe allergic"]` | "severe allergic reaction" |
| 16 | `["unconscious"]` | "they are unconscious" |
| 17 | `["unresponsive"]` | "patient is unresponsive" |
| 18 | `["worst headache"]` | "worst headache of my life" |
| 19 | `["sudden severe headache"]` | "sudden severe headache" |
| 20 | `["coughing blood"]` | "coughing blood" |
| 21 | `["vomiting blood"]` | "vomiting blood" |

The AND-group design for cardiac patterns (items 1–4) avoids false positives from mentioning chest pain alone (e.g. "I had chest pain three weeks ago, is that normal?").

---

## `classify_triage_level()`

**File:** `backend/features/triage.py`

**Signature:** `def classify_triage_level(text: str) -> TriageLevel`

This function runs **after** the LLM call, for UI purposes only. It assigns an urgency level that the frontend uses to display colour-coded badges.

### TriageLevel Enum

```python
class TriageLevel(str, Enum):
    EMERGENCY     = "emergency"    # Returned directly from check_emergency(), never from this fn
    URGENT        = "urgent"       # Needs same-day medical attention
    ROUTINE       = "routine"      # Schedule a visit
    INFORMATIONAL = "informational"  # General health question
```

### URGENT_PATTERNS

15 patterns trigger `URGENT`:

| Pattern Group | Rationale |
|--------------|-----------|
| `["fever", "stiff neck"]` | Meningitis red flag |
| `["fever", "confusion"]` | Sepsis red flag |
| `["high fever"]` | Temperature > 103°F |
| `["severe pain"]` | Acute pain |
| `["sudden vision"]` | Sudden visual change |
| `["sudden hearing"]` | Sudden hearing loss |
| `["blood urine"]` | Haematuria |
| `["black stool"]` | GI bleed indicator |
| `["dark urine", "yellow"]` | Jaundice/liver |
| `["difficulty swallowing"]` | Dysphagia |
| `["swollen", "painful", "leg"]` | DVT red flag |
| `["shortness of breath"]` | Dyspnoea |
| `["rapid heart"]` | Tachycardia |
| `["heart racing"]` | Palpitations |
| `["chest tightness"]` | Non-emergency chest symptom |

After checking urgent patterns, the function checks for any generic symptom word (`pain`, `ache`, `hurt`, `symptom`, `feeling`, `nausea`, `dizzy`) to return `ROUTINE`. Otherwise returns `INFORMATIONAL`.

### Relationship between the two functions

```
User text
    │
    ├─► check_emergency()   ← RUNS FIRST, in /api/chat BEFORE LLM
    │       │ match → return 911 directive immediately
    │       │ no match → continue
    │
    ▼
  LLM call (Claude)
    │
    ▼
  classify_triage_level()  ← RUNS AFTER LLM, for UI badge only
    │
    └─► TriageLevel enum value → included in ChatResponse.triage_level
```

---

## Test Matrix

Tests are in `tests/test_triage.py` and `tests/test_health_injector.py`.

### Positive Cases — Must Return Emergency String

| Input | Pattern Triggered |
|-------|-----------------|
| `"I have chest pain radiating to my left arm"` | `["chest pain", "left arm"]` |
| `"chest pain going up to my jaw"` | `["chest pain", "jaw"]` |
| `"I think I'm having a heart attack"` | `["heart attack"]` |
| `"I think I'm having a stroke"` | `["stroke"]` |
| `"I am suicidal"` | `["suicidal"]` |
| `"I took an overdose of pills"` | `["overdose"]` |
| `"he is not breathing"` | `["not breathing"]` |
| `"I think I'm having anaphylaxis"` | `["anaphylaxis"]` |
| `"this is the worst headache of my life"` | `["worst headache"]` |
| `"CHEST PAIN radiating to LEFT ARM"` | `["chest pain", "left arm"]` (case-insensitive) |
| `"chest pain and pressure"` | `["chest pain", "pressure"]` |

### Negative Cases — Must Return None

| Input | Why it should NOT trigger |
|-------|--------------------------|
| `"my stomach hurts a little"` | No emergency pattern |
| `"what does high LDL mean for my heart health?"` | Heart health question, no emergency keywords |
| `"I have a mild headache"` | Mild qualifier does not match patterns |
| `"should I take my metformin with food?"` | Medication question, no symptoms |

### EMERGENCY_RESPONSE Invariants

- Must contain `"911"`
- Must contain `"Call 911"` directive
- Must NOT give any medical advice — only escalate

---

## Coverage Requirement

Emergency triage is **safety-critical** and must have **100% test coverage**. When adding new emergency patterns to `EMERGENCY_PATTERNS`, a corresponding test must be added to `tests/test_triage.py` before the change is merged.

Run tests with:

```bash
cd backend && python -m pytest tests/test_triage.py tests/test_health_injector.py -v
```
