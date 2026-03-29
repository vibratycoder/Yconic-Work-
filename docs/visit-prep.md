# Visit Prep

Generates a one-page doctor visit summary the user can print and hand to their physician.

## Entry point

```
GET /api/visit-prep/{user_id}
```

No request body required — all data comes from the stored profile.

## Process

**File:** `backend/features/visit_prep.py`

```
GET /api/visit-prep/{user_id}
         │
         ▼
get_profile(user_id)   ← loads profile + recent labs from Supabase
         │
         ▼
generate_visit_summary(profile)
         │
         ▼
profile.to_context_string()  ← formats all health data as structured text
         │
         ▼
Claude claude-sonnet-4-6
  System: health advocate prompt (see below)
  User: "Generate a visit prep summary for this patient: {context}"
         │
         ▼
Parse response as full_text
Build structured fields from profile data directly
         │
         ▼
Return VisitSummary
```

## System prompt

> "You are a health advocate helping a patient prepare for a doctor's visit. Create a concise one-page summary they can hand to their doctor. Include: 1. Current chief complaints / questions to ask. 2. Medication list with doses. 3. Recent abnormal lab values. 4. Key health history points. 5. Three specific questions to ask the doctor. Be specific to their values. Reference actual lab numbers. Keep it under 400 words. Write in plain language the patient and doctor can both easily scan."

## Output model

```python
class VisitSummary(BaseModel):
    chief_complaints: list[str]    # populated by Claude in full_text
    medication_list: list[str]     # built from profile.current_medications
    abnormal_labs: list[str]       # abnormal results as "Test: value"
    health_history: list[str]      # first 5 health_facts from profile
    questions_to_ask: list[str]    # populated by Claude in full_text
    full_text: str                 # complete formatted markdown summary
```

`full_text` is the primary field — it contains the complete human-readable summary. The structured list fields provide programmatic access to the same data.

## Model used

**Claude Sonnet 4.6** (`claude-sonnet-4-6`) — max tokens: 1024. Uses the full profile context string, which includes demographics, conditions, medications, abnormal labs, wearable summary, and health facts.

## Files

| File | Role |
|------|------|
| `backend/features/visit_prep.py` | `generate_visit_summary()`, `VisitSummary` model |
| `backend/main.py` | `GET /api/visit-prep/{user_id}` route |
| `backend/health/profile.py` | Profile load |
| `backend/models/health_profile.py` | `to_context_string()` |
