# Data Models

## Overview

Sana Health uses Pydantic v2 models in the backend for request/response validation and database serialisation. Persistent data lives in Supabase (Postgres) with Row Level Security enforced on all tables. The schema is defined in `schema.sql` at the project root.

---

## Pydantic Models

All models are defined in `backend/models/health_profile.py`.

---

### `HealthProfile`

The central model. Every Claude system prompt is built from a serialised `HealthProfile`. It is also the request/response model for `/api/profile`.

```python
class HealthProfile(BaseModel):
    user_id: str                              # Supabase auth UUID
    display_name: str = ""
    age: int | None = None
    sex: str | None = None                    # e.g. "male", "female"
    height_cm: float | None = None
    weight_kg: float | None = None
    primary_conditions: list[str] = []        # e.g. ["Type 2 Diabetes", "Hypertension"]
    current_medications: list[Medication] = []
    allergies: list[str] = []
    recent_labs: list[LabResult] = []         # fetched from lab_results table
    health_facts: list[str] = []              # extracted from conversations + onboarding
    wearable_summary: WearableSummary | None = None
    conversation_count: int = 0
    member_since: datetime                    # defaults to utcnow()
```

**Key method: `to_context_string()`**

Renders the profile as a structured text block for LLM injection. Sections included (when populated):
- `DEMOGRAPHICS:` — age, sex, height, weight
- `CONDITIONS:` — comma-separated `primary_conditions`
- `MEDICATIONS:` — `name dose frequency` for each medication
- `ALLERGIES:` — comma-separated
- `ABNORMAL LABS:` — results with status `low`, `high`, or `critical`
- `RECENT LABS:` — up to 5 results (shown only if no abnormal labs)
- `WEARABLES (7-day avg):` — HR, HRV, sleep, steps, glucose
- `HEALTH HISTORY:` — last 10 entries from `health_facts`

Returns `"No health profile data available."` when no fields are populated.

---

### `LabResult`

A single laboratory test result. Stored in the `lab_results` Supabase table and returned as `recent_labs` inside `HealthProfile`.

```python
class LabResult(BaseModel):
    test_name: str                            # e.g. "LDL Cholesterol"
    loinc_code: str | None = None             # LOINC code if available
    value: float | None = None               # Numeric result
    value_text: str | None = None            # Text result for qualitative tests
    unit: str | None = None                  # e.g. "mg/dL"
    reference_range_low: float | None = None
    reference_range_high: float | None = None
    status: LabStatus = LabStatus.UNKNOWN
    date_collected: date | None = None
    lab_source: LabSource = LabSource.MANUAL

    # Computed properties
    is_abnormal: bool    # True if status is LOW, HIGH, or CRITICAL
    display_value: str   # "158.0 mg/dL" or value_text
```

### `LabStatus` Enum

```python
class LabStatus(str, Enum):
    NORMAL   = "normal"
    LOW      = "low"
    HIGH     = "high"
    CRITICAL = "critical"
    UNKNOWN  = "unknown"
```

The `is_abnormal` computed field returns `True` for `LOW`, `HIGH`, and `CRITICAL` statuses.

### `LabSource` Enum

```python
class LabSource(str, Enum):
    MANUAL     = "manual"
    PHOTO_OCR  = "photo_ocr"
    HEALTHKIT  = "healthkit"
    EHR_IMPORT = "ehr_import"
    PDF        = "pdf"
```

---

### `Medication`

```python
class Medication(BaseModel):
    name: str                                 # Generic or brand name
    dose: str                                 # e.g. "10mg"
    frequency: str                            # e.g. "twice daily"
    prescribing_condition: str | None = None  # Condition the drug treats
```

---

### `WearableSummary`

A 7-day rolling summary of data from HealthKit or similar wearable integrations.

```python
class WearableSummary(BaseModel):
    avg_resting_heart_rate: float | None = None   # bpm
    avg_hrv_ms: float | None = None               # milliseconds
    avg_sleep_hours: float | None = None
    avg_sleep_quality: str | None = None          # "good" / "fair" / "poor"
    avg_steps_per_day: int | None = None
    avg_blood_glucose: float | None = None        # mg/dL
    week_starting: date | None = None
```

---

## Supabase Tables

All tables have Row Level Security (RLS) enabled. The general RLS policy pattern is:

```sql
create policy "Users own their <table>"
  on <table> for all using (auth.uid() = user_id);
```

This means every query is automatically filtered to the authenticated user's rows. There is no need for application-level filtering.

---

### `health_profiles`

Stores one row per user. The `user_id` column is unique, enforcing a one-to-one relationship with `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, `uuid_generate_v4()` |
| `user_id` | `uuid` | FK → `auth.users(id)`, `UNIQUE`, `ON DELETE CASCADE` |
| `display_name` | `text` | Required |
| `age` | `integer` | Nullable |
| `sex` | `text` | Nullable |
| `height_cm` | `float` | Nullable |
| `weight_kg` | `float` | Nullable |
| `primary_conditions` | `jsonb` | Default `'[]'` |
| `current_medications` | `jsonb` | Default `'[]'` — array of `Medication` objects |
| `allergies` | `jsonb` | Default `'[]'` |
| `health_facts` | `jsonb` | Default `'[]'` |
| `wearable_summary` | `jsonb` | Nullable — `WearableSummary` object |
| `conversation_count` | `integer` | Default `0` |
| `member_since` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

**Profile upsert pattern:** `backend/health/profile.py` uses `upsert` with `on_conflict="user_id"` so that `POST /api/profile` is idempotent — the same call works for both creation and update.

---

### `lab_results`

Stores individual lab results. Multiple rows per user. `recent_labs` in `HealthProfile` is populated by joining this table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → `auth.users(id)`, `ON DELETE CASCADE` |
| `test_name` | `text` | Required |
| `loinc_code` | `text` | Nullable |
| `value` | `float` | Nullable |
| `value_text` | `text` | Nullable |
| `unit` | `text` | Nullable |
| `reference_range_low` | `float` | Nullable |
| `reference_range_high` | `float` | Nullable |
| `status` | `text` | CHECK constraint: `normal`, `low`, `high`, `critical`, `unknown` |
| `date_collected` | `date` | Nullable |
| `lab_source` | `text` | CHECK constraint: `photo_ocr`, `healthkit`, `manual`, `pdf` |
| `created_at` | `timestamptz` | Default `now()` |

**Index:** `idx_lab_results_user_date ON lab_results(user_id, date_collected DESC)` — supports efficient fetching of recent labs.

---

### Additional Tables

| Table | Purpose |
|-------|---------|
| `conversations` | Stores full conversation message history with citations and health domain |
| `symptom_logs` | User-reported symptom logs with severity (1–10 scale) |
| `documents` | Uploaded file metadata with extracted health facts |

All follow the same RLS pattern: `auth.uid() = user_id`.

---

## RLS Policy Summary

```sql
-- Example: health_profiles
create policy "Users own their health profiles"
  on health_profiles for all using (auth.uid() = user_id);
```

The `for all` clause covers `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. Every table has exactly one policy using `auth.uid() = user_id`. No cross-user data access is possible at the database layer.

**Important:** RLS must be explicitly enabled on each table:

```sql
alter table health_profiles enable row level security;
alter table lab_results enable row level security;
-- ... etc.
```

---

## Profile Upsert Pattern

The backend calls Supabase with `upsert(..., on_conflict="user_id")` rather than separate insert/update logic:

```python
# backend/health/profile.py
await supabase.table("health_profiles").upsert(
    profile_dict,
    on_conflict="user_id"
).execute()
```

This is safe to call on every profile save regardless of whether the row already exists.
