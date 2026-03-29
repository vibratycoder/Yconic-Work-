# Wearable Data Sync

> **Note:** Apple HealthKit sync (iOS mobile) has been removed from the current scope.
> The `WearableSummary` model and `wearable_summary` column on `health_profiles` remain
> in the schema for future integration. The `backend/intake/healthkit_sync.py` processing
> module is retained as a library but the `/api/healthkit/sync` route has been removed.

Wearable biometric data can be added to a user's profile manually via the Edit Profile modal
or injected via a future integration (FHIR Observation resources, third-party wearable APIs).

## WearableSummary model

```python
class WearableSummary(BaseModel):
    avg_resting_heart_rate: float | None   # bpm
    avg_hrv_ms: float | None               # ms
    avg_sleep_hours: float | None
    avg_sleep_quality: str | None          # "good" / "fair" / "poor"
    avg_steps_per_day: int | None
    avg_blood_glucose: float | None        # mg/dL
    week_starting: str | None
```

When present, the wearable summary is rendered into the Claude system prompt:

```
WEARABLES (7-day avg): HR 62bpm, HRV 45ms, Sleep 7.2h (good), Steps 8,432/day
```

## Display

Wearable data is shown as read-only badges in `web/components/HealthProfileSidebar.tsx`
when a `wearable_summary` exists on the profile.
