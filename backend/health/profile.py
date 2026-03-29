"""Supabase CRUD operations for HealthProfile."""
from __future__ import annotations
import os
from supabase import create_client, Client
from backend.models.health_profile import (
    HealthProfile, LabResult, LabStatus, LabSource,
    Medication, WearableSummary,
)
from backend.utils.logger import get_logger
from datetime import date, datetime, timezone

log = get_logger(__name__)
_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """
    Return singleton Supabase client, initializing on first call.

    Returns:
        Configured Supabase Client instance.

    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars are missing.
    """
    global _supabase_client
    if _supabase_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase_client = create_client(url, key)
    return _supabase_client


async def get_profile(user_id: str) -> HealthProfile | None:
    """
    Fetch health profile and recent labs for a user from Supabase.

    Args:
        user_id: Supabase auth user ID

    Returns:
        HealthProfile with recent_labs populated, or None if not found.

    Raises:
        Exception: On Supabase connection or query failure (logged, re-raised).
    """
    try:
        supabase = get_supabase_client()
        resp = supabase.table("health_profiles").select("*").eq("user_id", user_id).limit(1).execute()
        if not resp.data:
            return None
        row = resp.data[0]

        # Parse medications
        meds: list[Medication] = []
        for m in row.get("current_medications") or []:
            meds.append(Medication(
                name=m.get("name", ""),
                dose=m.get("dose", ""),
                frequency=m.get("frequency", ""),
                prescribing_condition=m.get("prescribing_condition"),
            ))

        # Parse wearable summary
        ws_data = row.get("wearable_summary")
        wearable: WearableSummary | None = None
        if ws_data:
            week_str = ws_data.get("week_starting")
            week_date: date | None = None
            if week_str:
                try:
                    week_date = date.fromisoformat(week_str)
                except ValueError:
                    pass
            wearable = WearableSummary(
                avg_resting_heart_rate=ws_data.get("avg_resting_heart_rate"),
                avg_hrv_ms=ws_data.get("avg_hrv_ms"),
                avg_sleep_hours=ws_data.get("avg_sleep_hours"),
                avg_sleep_quality=ws_data.get("avg_sleep_quality"),
                avg_steps_per_day=ws_data.get("avg_steps_per_day"),
                avg_blood_glucose=ws_data.get("avg_blood_glucose"),
                week_starting=week_date,
            )

        # Parse member_since
        member_since_str = row.get("member_since")
        member_since = datetime.now(timezone.utc)
        if member_since_str:
            try:
                member_since = datetime.fromisoformat(member_since_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        profile = HealthProfile(
            user_id=user_id,
            display_name=row.get("display_name", ""),
            age=row.get("age"),
            sex=row.get("sex"),
            height_cm=row.get("height_cm"),
            weight_kg=row.get("weight_kg"),
            primary_conditions=row.get("primary_conditions") or [],
            current_medications=meds,
            allergies=row.get("allergies") or [],
            health_facts=row.get("health_facts") or [],
            wearable_summary=wearable,
            conversation_count=row.get("conversation_count", 0),
            member_since=member_since,
        )

        # Fetch recent labs
        labs_resp = (
            supabase.table("lab_results")
            .select("*")
            .eq("user_id", user_id)
            .order("date_collected", desc=True)
            .limit(20)
            .execute()
        )
        recent_labs: list[LabResult] = []
        for lr in labs_resp.data or []:
            try:
                date_str = lr.get("date_collected")
                collected: date | None = None
                if date_str:
                    try:
                        collected = date.fromisoformat(date_str)
                    except ValueError:
                        pass
                recent_labs.append(LabResult(
                    test_name=lr["test_name"],
                    loinc_code=lr.get("loinc_code"),
                    value=lr.get("value"),
                    value_text=lr.get("value_text"),
                    unit=lr.get("unit"),
                    reference_range_low=lr.get("reference_range_low"),
                    reference_range_high=lr.get("reference_range_high"),
                    status=LabStatus(lr.get("status", "unknown")),
                    date_collected=collected,
                    lab_source=LabSource(lr.get("lab_source", "manual")),
                ))
            except (KeyError, ValueError) as exc:
                log.warning("lab_result_parse_failed", error=str(exc), row=lr)
                continue
        profile.recent_labs = recent_labs
        return profile
    except Exception as exc:
        log.error("get_profile_failed", user_id=user_id, error=str(exc))
        raise


async def upsert_profile(profile: HealthProfile) -> HealthProfile:
    """
    Create or update a health profile in Supabase.

    Args:
        profile: HealthProfile to persist

    Returns:
        The saved HealthProfile.

    Raises:
        Exception: On Supabase write failure (logged, re-raised).
    """
    try:
        supabase = get_supabase_client()
        meds_data = [m.model_dump() for m in profile.current_medications]
        wearable_data = profile.wearable_summary.model_dump() if profile.wearable_summary else None
        if wearable_data and wearable_data.get("week_starting"):
            wearable_data["week_starting"] = wearable_data["week_starting"].isoformat()

        row: dict = {
            "user_id": profile.user_id,
            "display_name": profile.display_name,
            "age": profile.age,
            "sex": profile.sex,
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "primary_conditions": profile.primary_conditions,
            "current_medications": meds_data,
            "allergies": profile.allergies,
            "health_facts": profile.health_facts,
            "wearable_summary": wearable_data,
            "conversation_count": profile.conversation_count,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("health_profiles").upsert(row, on_conflict="user_id").execute()
        log.info("profile_upserted", user_id=profile.user_id)
        return profile
    except Exception as exc:
        log.error("upsert_profile_failed", user_id=profile.user_id, error=str(exc))
        raise
