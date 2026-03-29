# Profile Management

The `HealthProfile` is the core data object injected into every Claude prompt. It is created at onboarding and updated by the edit modal and conversation learning.

## Data model

**File:** `backend/models/health_profile.py`

```python
class HealthProfile(BaseModel):
    user_id: str
    display_name: str
    age: int | None
    sex: str | None
    height_cm: float | None
    weight_kg: float | None
    primary_conditions: list[str]
    current_medications: list[Medication]   # name, dose, frequency
    allergies: list[str]
    recent_labs: list[LabResult]            # fetched from lab_results table
    health_facts: list[str]                 # extracted from conversations
    wearable_summary: WearableSummary | None
    conversation_count: int
    member_since: datetime
```

`to_context_string()` renders the profile as a plain-text block injected into every system prompt.

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/profile/{user_id}` | Load profile + recent labs |
| `POST` | `/api/profile` | Create profile (onboarding) |
| `PUT` | `/api/profile/{user_id}` | Update profile (edit modal) |

## Supabase storage

**Table:** `health_profiles`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid | FK → `auth.users`, unique |
| `display_name` | text | not null |
| `age`, `sex`, `height_cm`, `weight_kg` | various | nullable |
| `primary_conditions` | jsonb | `[]` default |
| `current_medications` | jsonb | `[]` default |
| `allergies` | jsonb | `[]` default |
| `health_facts` | jsonb | `[]` default |
| `wearable_summary` | jsonb | nullable |
| `conversation_count` | integer | incremented by updater |
| `member_since`, `updated_at` | timestamptz | managed by DB / backend |

Lab results are stored separately in the `lab_results` table and joined on every `get_profile()` call (last 20 results, ordered by `date_collected` desc).

## Onboarding flow

```
Sign up / log in
      │
      ▼
Check GET /api/profile/{user_id}
      │ 404 / null?
      ├──► redirect to /onboarding
      │
      ▼
Onboarding form (5 steps)
  Step 1 — Your basics (age, sex, height, weight)
  Step 2 — Medical conditions (multi-select + custom)
  Step 3 — Current medications (name, dose, frequency)
  Step 4 — Allergies (multi-select + custom)
  Step 5 — Lifestyle & goals (exercise, sleep, smoking, alcohol, health goals)
      │
      ▼
POST /api/profile  →  upsert_profile()  →  Supabase
      │
      ▼
Redirect to home / chat
```

**File:** `web/app/onboarding/page.tsx`

## Edit profile modal

**File:** `web/components/EditProfileModal.tsx`

Five tabs:
- **Basics** — age, sex, height, weight
- **Conditions** — 26 common conditions + custom entry
- **Medications** — add/remove with dose and frequency
- **Allergies** — 15 common allergens + custom entry
- **Learned** — lifestyle presets from the questionnaire (exercise, sleep, smoking, alcohol, health goals) plus AI-learned facts from conversations

On save: `PUT /api/profile/{user_id}`. After upsert, the endpoint re-fetches the full profile (including labs) before returning, so the UI stays in sync.

## Files

| File | Role |
|------|------|
| `backend/health/profile.py` | `get_profile()`, `upsert_profile()` — Supabase CRUD |
| `backend/models/health_profile.py` | Pydantic models (HealthProfile, Medication, LabResult, WearableSummary) |
| `backend/main.py` | Route handlers |
| `web/app/onboarding/page.tsx` | Web onboarding form |
| `web/components/EditProfileModal.tsx` | Web edit modal |
| `web/components/HealthProfileSidebar.tsx` | Sidebar display |
