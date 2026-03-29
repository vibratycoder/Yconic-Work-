"""HealthKit payload processing and wearable summary computation."""
from __future__ import annotations
from datetime import date, timedelta
from backend.models.health_profile import WearableSummary
from backend.health.profile import get_profile, upsert_profile
from backend.utils.logger import get_logger

log = get_logger(__name__)


def _safe_mean(values: list[float]) -> float | None:
    """
    Compute mean of a list, returning None for empty lists.

    Args:
        values: List of float values

    Returns:
        Mean as float, or None if list is empty.
    """
    if not values:
        return None
    return sum(values) / len(values)


async def process_healthkit_payload(user_id: str, payload: dict) -> WearableSummary:
    """
    Process a HealthKit payload from the mobile app and update the user's profile.

    Computes 7-day averages for heart rate, HRV, sleep, glucose, and steps.
    Persists the WearableSummary to the user's HealthProfile.

    Args:
        user_id: Supabase auth user ID
        payload: Raw HealthKit payload dict from mobile app

    Returns:
        Computed WearableSummary with 7-day averages.

    Raises:
        Exception: On Supabase write failure (logged, re-raised).
    """
    try:
        hr_values = [s["value"] for s in payload.get("heartRate", []) if isinstance(s.get("value"), (int, float))]
        hrv_values = [s["value"] for s in payload.get("hrv", []) if isinstance(s.get("value"), (int, float))]
        glucose_values = [s["value"] for s in payload.get("bloodGlucose", []) if isinstance(s.get("value"), (int, float))]

        # Steps: sum per day then average
        steps_raw = payload.get("steps", [])
        step_values = [s["value"] for s in steps_raw if isinstance(s.get("value"), (int, float))]
        avg_steps = int(_safe_mean(step_values) or 0) or None

        # Sleep: average hours
        sleep_raw = payload.get("sleep", [])
        sleep_hours = []
        for s in sleep_raw:
            start = s.get("startDate", "")
            end = s.get("endDate", "")
            if start and end:
                try:
                    from datetime import datetime
                    dt_start = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    dt_end = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    duration_hours = (dt_end - dt_start).total_seconds() / 3600
                    if 1.0 < duration_hours < 16.0:
                        sleep_hours.append(duration_hours)
                except ValueError:
                    pass

        avg_sleep = _safe_mean(sleep_hours)
        sleep_quality: str | None = None
        if avg_sleep is not None:
            if avg_sleep >= 7.5:
                sleep_quality = "good"
            elif avg_sleep >= 6.0:
                sleep_quality = "fair"
            else:
                sleep_quality = "poor"

        summary = WearableSummary(
            avg_resting_heart_rate=_safe_mean(hr_values),
            avg_hrv_ms=_safe_mean(hrv_values),
            avg_sleep_hours=avg_sleep,
            avg_sleep_quality=sleep_quality,
            avg_steps_per_day=avg_steps,
            avg_blood_glucose=_safe_mean(glucose_values),
            week_starting=date.today() - timedelta(days=7),
        )

        profile = await get_profile(user_id)
        if profile:
            profile.wearable_summary = summary
            await upsert_profile(profile)
            log.info("healthkit_synced", user_id=user_id,
                     avg_hr=summary.avg_resting_heart_rate,
                     avg_sleep=summary.avg_sleep_hours)
        return summary

    except Exception as exc:
        log.error("healthkit_sync_failed", user_id=user_id, error=str(exc))
        raise
