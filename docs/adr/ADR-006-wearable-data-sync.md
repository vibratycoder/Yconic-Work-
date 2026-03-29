# ADR-006: Wearable Data Sync

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Sana Health engineering team

## Context

Wearable biometric data — resting heart rate, heart rate variability, sleep, step count, and blood glucose — provides meaningful longitudinal context that enriches Claude's ability to reason about a user's physical health trends. The mobile app has access to Apple HealthKit via the `react-native-health` library, but the AI backend needs a normalized, stable representation of this data to include in system prompts without overwhelming the context window with raw time-series samples. A decision was needed on how to ingest raw HealthKit samples, what aggregation window and metrics to compute, how to store the result, and how to surface it to Claude — while keeping wearable data clearly separated from safety-critical emergency triage logic.

## Decision

The mobile app reads HealthKit samples and posts raw data to `POST /api/healthkit/sync`. The backend computes 7-day moving averages for seven metrics — resting heart rate, HRV, sleep hours, sleep quality, daily step count, and blood glucose — and stores the result as a `WearableSummary` embedded within the user's `HealthProfile` row in Supabase. The `week_starting` field records the ISO date of the Monday that begins the averaging window. This summary is injected into the Claude system prompt as a single compact line of prose so that trend context is available without token overhead. Wearable data is explicitly advisory only and plays no role in the `check_emergency` triage path.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Store raw HealthKit time-series samples in Supabase | Generates very high data volume (heart rate samples every few seconds), inflates storage costs, and cannot be directly embedded in a Claude system prompt. Aggregation is always required before AI use. |
| Compute averages client-side and send only the summary | Moves business logic to the mobile client, making it harder to audit, recompute, or backfill. Server-side aggregation keeps the computation in a single testable location. |
| Use a 24-hour window instead of 7-day averages | Single-day snapshots are noisy and unrepresentative (e.g., one poor night's sleep, a rest day). A 7-day window smooths natural variation and aligns with standard clinical reporting windows for metrics like resting HR and HRV. |
| Store `WearableSummary` in a separate `wearable_summaries` table | The summary is a single denormalized value used exclusively as part of the health profile context. Embedding it in `HealthProfile` avoids an extra join on every chat request. A dedicated table would be warranted only if historical summaries needed to be queried independently. |
| Support Google Fit, Fitbit, and Garmin at launch | Each platform has a different OAuth flow, permissions model, and data schema. Multi-platform support would triple integration complexity before product-market fit is established. Apple HealthKit covers the initial iOS-first user base and can be expanded later. |
| Include wearable data in emergency triage logic | Wearable metrics are inherently delayed (batch sync, not real-time) and can be inaccurate (consumer-grade sensors, missing permissions). Using them in safety-critical triage paths would introduce false negatives. Emergency detection must rely only on the user's explicit symptom description. |
| Send wearable data as a structured JSON block in the system prompt | A prose summary ("Resting HR 65 bpm · HRV 42 ms · Sleep 7.2h") consumes far fewer tokens than a JSON object and is easier for the model to incorporate naturally into its reasoning. Structured JSON is appropriate for profile fields where programmatic access is needed, not for this context hint. |

## Consequences

### Positive
- Claude can reference concrete biometric trends ("your resting HR has averaged 65 bpm and HRV 42 ms this week") rather than relying solely on self-reported symptoms, improving the quality of health trend conversations.
- 7-day averages are stable across daily variation; the system prompt content changes at most once per sync, not per-request, so Claude sees consistent context within a given week.
- Embedding `WearableSummary` in `HealthProfile` means no additional database query is needed at chat time — the summary is fetched as part of the existing profile load.
- Server-side aggregation keeps all computation auditable and testable independently of the mobile client.
- Explicit exclusion from triage logic ensures wearable data cannot introduce false safety signals.

### Negative / Trade-offs
- Only Apple HealthKit is supported. Android users receive no wearable context. This is a deliberate deferral, not a permanent exclusion, but creates feature disparity.
- The 7-day average is recomputed only when the user manually syncs or the app triggers a background sync. There is no streaming or real-time update; the summary may be up to a week stale for infrequent users.
- `week_starting` is stored as an ISO date string in Supabase rather than a `date` type, requiring explicit parsing on read (`date.fromisoformat(row["week_starting"])`). A mismatch between stored format and parse expectations would cause a runtime error.
- HealthKit permissions are granular and user-controlled. If the user denies access to specific data types (e.g., HRV), those fields will be `None` in `WearableSummary`. The system prompt must handle partial data gracefully and must not fabricate missing values.
- Blood glucose readings from HealthKit are typically from consumer CGM devices or manual entries; they are not equivalent to lab-ordered fasting glucose. The system prompt and any Claude response must not treat them as clinical lab values.
- There is no versioning of `WearableSummary`. If the schema changes (e.g., adding VO2 max), existing rows in Supabase will have `None` for new fields until the next sync.

## Implementation Notes

**Key files:**
- `backend/intake/healthkit_sync.py` — `POST /api/healthkit/sync` endpoint; receives raw HealthKit samples, calls `compute_wearable_averages(samples)` to produce a `WearableSummary`, then upserts the result into the user's `HealthProfile` via `save_profile`.
- `backend/models/health_profile.py` — `WearableSummary` Pydantic v2 model:
  ```python
  class WearableSummary(BaseModel):
      avg_resting_heart_rate: float | None  # bpm
      avg_hrv_ms: float | None              # milliseconds
      avg_sleep_hours: float | None
      avg_sleep_quality: float | None       # 0.0 – 1.0 scale
      avg_steps_per_day: float | None
      avg_blood_glucose: float | None       # mg/dL
      week_starting: date
  ```

**Sync endpoint contract:**
- `POST /api/healthkit/sync` — authenticated; request body contains arrays of raw HealthKit samples keyed by type (e.g., `heartRate`, `heartRateVariabilitySDNN`, `sleepAnalysis`, `stepCount`, `bloodGlucose`).
- Response: `200 OK` with the computed `WearableSummary` on success; `422` if the payload is malformed.

**System prompt injection format:**
```
WEARABLES (7-day avg): Resting HR 65 bpm · HRV 42 ms · Sleep 7.2h (good) · Steps 8,500/day · Blood glucose 94 mg/dL
```
Fields that are `None` are omitted from the line rather than rendered as "N/A" to avoid Claude reasoning about absent data as if it were present.

**Sleep quality label mapping** (used in prose rendering):
- `>= 0.8` → "good"
- `0.5 – 0.79` → "fair"
- `< 0.5` → "poor"

**`week_starting` round-trip:** stored as `"2026-03-23"` (ISO string) in Supabase; parsed on read with `date.fromisoformat(row["week_starting"])` in the profile hydration path inside `backend/health/profile.py`.

**Mobile integration:**
- `mobile/app/(app)/profile.tsx` (and background sync logic) uses the `react-native-health` library to request HealthKit permissions for the required data types and batch-sends samples on app foreground or explicit user sync.

## Compliance & Safety

- Wearable biometric data is health information subject to the same PHI handling requirements as the rest of the health profile. It must not appear in application logs. Structured logging via `utils/logger.py` must redact `wearable_summary` fields.
- Supabase RLS policies restrict `health_profiles` rows (which embed `WearableSummary`) to the owning user; wearable data is never accessible cross-user.
- The `check_emergency` function evaluates only the user's text message and runs before every LLM call regardless of what wearable data shows. An elevated resting heart rate in the wearable summary does not trigger or suppress emergency triage — only the user's live symptom description does.
- Blood glucose values from consumer HealthKit sources must be clearly treated as self-reported context, not clinical measurements. Claude must not use them to diagnose diabetes or adjust medication recommendations.
- HealthKit data is collected only with explicit iOS permission grants. If the user revokes permissions, subsequent syncs will produce partial or empty payloads; the existing `WearableSummary` in the profile is retained until overwritten by a new sync, which may mean stale data persists. A staleness indicator (days since last sync) should be considered in a future iteration.
- Apple HealthKit terms of service prohibit using HealthKit data for advertising or selling to data brokers. Sana Health must ensure that `WearableSummary` data is used solely for the stated purpose of personalizing the user's own AI health interactions.
