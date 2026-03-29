# HealthKit Sync

Ingests 7 days of Apple Health data from the iOS app and stores a weekly wearable summary on the user's profile.

## Entry point

```
POST /api/healthkit/sync
```

**Request:** `{ "user_id": "...", "data": { ...HealthKit payload... } }`

Triggered by the mobile app after collecting HealthKit samples. iOS only.

## Process

**File:** `backend/intake/healthkit_sync.py`

```
Raw HealthKit payload (7 days of samples)
         │
         ▼
Extract sample arrays:
  heartRate[]     → avg_resting_heart_rate (bpm)
  hrv[]           → avg_hrv_ms (ms)
  bloodGlucose[]  → avg_blood_glucose (mg/dL)
  steps[]         → avg_steps_per_day (int)
  sleep[]         → avg_sleep_hours + sleep_quality
         │
         ▼
Infer sleep quality:
  ≥ 7.5 hours → "good"
  ≥ 6.0 hours → "fair"
  < 6.0 hours → "poor"
         │
         ▼
Build WearableSummary(
    avg_resting_heart_rate,
    avg_hrv_ms,
    avg_sleep_hours,
    avg_sleep_quality,
    avg_steps_per_day,
    avg_blood_glucose,
    week_starting = today - 7 days,
)
         │
         ▼
get_profile(user_id) → profile.wearable_summary = summary
upsert_profile()  →  Supabase health_profiles.wearable_summary
         │
         ▼
Return WearableSummary
```

## Payload format (from mobile)

```json
{
  "heartRate": [{ "value": 62, "startDate": "2026-03-22T..." }],
  "hrv": [{ "value": 45.2, "startDate": "..." }],
  "bloodGlucose": [{ "value": 95, "startDate": "..." }],
  "steps": [{ "value": 8432, "startDate": "..." }],
  "sleep": [{ "startDate": "2026-03-22T22:00:00Z", "endDate": "2026-03-23T06:30:00Z" }]
}
```

Sleep duration is computed from `endDate - startDate`. Sessions shorter than 1 hour or longer than 16 hours are discarded as noise.

## Storage

`wearable_summary` is stored as a `jsonb` column on `health_profiles`. Each sync overwrites the previous week's summary — only the latest 7-day window is kept.

## System prompt injection

`WearableSummary` is rendered by `HealthProfile.to_context_string()`:

```
WEARABLES (7-day avg): HR 62bpm, HRV 45ms, Sleep 7.2h (good), Steps 8,432/day
```

This block appears in every Claude system prompt, allowing the model to reference wearable trends in its responses.

## Display

The wearable summary is shown as read-only cards in:
- **Web:** `HealthProfileSidebar.tsx` — heart rate, sleep, HRV, steps badges
- **Mobile:** `mobile/app/(app)/profile.tsx` — dedicated wearable section

## Files

| File | Role |
|------|------|
| `backend/intake/healthkit_sync.py` | `process_healthkit_payload()` |
| `backend/main.py` | `POST /api/healthkit/sync` route |
| `backend/models/health_profile.py` | `WearableSummary` model |
| `backend/health/profile.py` | `upsert_profile()` |
| `mobile/app/(app)/profile.tsx` | Wearable display on mobile |
| `web/components/HealthProfileSidebar.tsx` | Wearable display on web |
