"""Demo seed script — creates Marcus Chen's complete health profile in Supabase."""
from __future__ import annotations
import os
import sys
from datetime import date, datetime
from dotenv import load_dotenv

load_dotenv()

# Verify environment before importing supabase-dependent modules
_required_env = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]
_missing = [k for k in _required_env if not os.environ.get(k)]
if _missing:
    print(f"ERROR: Missing environment variables: {', '.join(_missing)}")
    print("Copy .env.example to .env and fill in your credentials.")
    sys.exit(1)

import urllib.request
import json as _json
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Demo user — Marcus Chen, 47, with metabolic syndrome pattern
# ---------------------------------------------------------------------------

# Fixed UUID so the demo user ID is stable across reseeds
DEMO_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
DEMO_EMAIL = "marcus.chen.demo@pulse.health"


def ensure_auth_user() -> str:
    """
    Create the demo auth user if they don't already exist.

    Uses the Supabase Admin API (requires service role key).
    Returns the user UUID to use as user_id in all tables.

    Returns:
        UUID string of the demo user.

    Raises:
        Exception: On auth API failure.
    """
    project_ref = SUPABASE_URL.replace("https://", "").split(".")[0]
    admin_url = f"https://{project_ref}.supabase.co/auth/v1/admin/users"

    # Check if user already exists by listing users
    list_req = urllib.request.Request(
        admin_url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(list_req) as resp:
            data = _json.loads(resp.read())
            users = data.get("users", [])
            for u in users:
                if u.get("email") == DEMO_EMAIL:
                    uid = u["id"]
                    print(f"  Auth user already exists: {uid}")
                    return uid
    except urllib.error.HTTPError:
        pass

    # Create new auth user with the fixed UUID
    payload = _json.dumps({
        "email": DEMO_EMAIL,
        "password": "PulseDemo2026!",
        "email_confirm": True,
        "user_metadata": {"display_name": "Marcus Chen"},
    }).encode()

    create_req = urllib.request.Request(
        admin_url,
        data=payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(create_req) as resp:
            user_data = _json.loads(resp.read())
            uid = user_data["id"]
            print(f"  Created auth user: {uid}")
            return uid
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        # If email already registered, parse the ID from error or re-list
        if "already been registered" in body or "already exists" in body.lower():
            print("  Auth user email already registered, fetching existing ID...")
            # Re-list and find
            with urllib.request.urlopen(list_req) as resp2:
                data2 = _json.loads(resp2.read())
                for u in data2.get("users", []):
                    if u.get("email") == DEMO_EMAIL:
                        return u["id"]
        raise RuntimeError(f"Auth user creation failed: {exc.code} {body}") from exc

MARCUS_PROFILE = {
    "user_id": DEMO_USER_ID,
    "display_name": "Marcus Chen",
    "age": 47,
    "sex": "male",
    "height_cm": 175.0,
    "weight_kg": 92.0,
    "primary_conditions": [
        "Type 2 Diabetes (diagnosed 2019)",
        "Hypertension",
        "Hyperlipidemia",
        "Prediabetic neuropathy (mild)",
    ],
    "current_medications": [
        {"name": "Metformin", "dose": "1000mg", "frequency": "twice daily",
         "prescribing_condition": "Type 2 Diabetes"},
        {"name": "Lisinopril", "dose": "10mg", "frequency": "once daily",
         "prescribing_condition": "Hypertension"},
        {"name": "Atorvastatin", "dose": "40mg", "frequency": "once daily at bedtime",
         "prescribing_condition": "Hyperlipidemia"},
        {"name": "Aspirin", "dose": "81mg", "frequency": "once daily",
         "prescribing_condition": "Cardiovascular risk reduction"},
    ],
    "allergies": ["Penicillin (rash)", "Sulfa drugs (hives)"],
    "health_facts": [
        "Father died of MI at age 62 — strong family cardiac history",
        "Smoked 1 PPD for 15 years, quit 2018",
        "Works desk job, sedentary lifestyle — trying to increase activity",
        "Reports stress eating pattern — weight has increased 8kg over 2 years",
        "HbA1c trending down from 8.2 in 2022 to current 7.4",
        "Diagnosed with mild peripheral neuropathy in feet in 2023",
        "Gets annual eye exams — mild diabetic retinopathy changes noted 2023",
        "Sleep quality poor — wife reports snoring, possible sleep apnea",
        "Drinks 2-3 glasses wine weekly, no other alcohol",
        "Walks 20-30 min most days — goal to increase to 60 min",
    ],
    "wearable_summary": {
        "avg_resting_heart_rate": 78.0,
        "avg_hrv_ms": 28.0,
        "avg_sleep_hours": 6.2,
        "avg_sleep_quality": "poor",
        "avg_steps_per_day": 6200,
        "avg_blood_glucose": 148.0,
        "week_starting": (date.today().isoformat()),
    },
    "conversation_count": 0,
    "member_since": datetime.utcnow().isoformat(),
    "updated_at": datetime.utcnow().isoformat(),
}

MARCUS_LABS = [
    {
        "user_id": DEMO_USER_ID,
        "test_name": "HbA1c",
        "loinc_code": "4548-4",
        "value": 7.4,
        "unit": "%",
        "reference_range_low": None,
        "reference_range_high": 5.7,
        "status": "high",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "Fasting Glucose",
        "loinc_code": "1558-6",
        "value": 142.0,
        "unit": "mg/dL",
        "reference_range_low": 70.0,
        "reference_range_high": 99.0,
        "status": "high",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "LDL Cholesterol",
        "loinc_code": "2089-1",
        "value": 118.0,
        "unit": "mg/dL",
        "reference_range_low": None,
        "reference_range_high": 100.0,
        "status": "high",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "HDL Cholesterol",
        "loinc_code": "2085-9",
        "value": 38.0,
        "unit": "mg/dL",
        "reference_range_low": 40.0,
        "reference_range_high": None,
        "status": "low",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "Triglycerides",
        "loinc_code": "2571-8",
        "value": 215.0,
        "unit": "mg/dL",
        "reference_range_low": None,
        "reference_range_high": 150.0,
        "status": "high",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "eGFR",
        "loinc_code": "62238-1",
        "value": 72.0,
        "unit": "mL/min/1.73m2",
        "reference_range_low": 60.0,
        "reference_range_high": None,
        "status": "normal",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "Creatinine",
        "loinc_code": "2160-0",
        "value": 1.1,
        "unit": "mg/dL",
        "reference_range_low": 0.7,
        "reference_range_high": 1.2,
        "status": "normal",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "Blood Pressure Systolic",
        "loinc_code": "8480-6",
        "value": 138.0,
        "unit": "mmHg",
        "reference_range_low": None,
        "reference_range_high": 130.0,
        "status": "high",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "TSH",
        "loinc_code": "3016-3",
        "value": 2.1,
        "unit": "mIU/L",
        "reference_range_low": 0.4,
        "reference_range_high": 4.0,
        "status": "normal",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
    {
        "user_id": DEMO_USER_ID,
        "test_name": "Urine Albumin-to-Creatinine Ratio",
        "loinc_code": "9318-7",
        "value": 42.0,
        "unit": "mg/g",
        "reference_range_low": None,
        "reference_range_high": 30.0,
        "status": "high",
        "date_collected": "2024-11-15",
        "lab_source": "manual",
    },
]


def seed_profile() -> None:
    """
    Insert or update Marcus Chen's health profile in Supabase.

    Returns:
        None

    Raises:
        Exception: On Supabase write failure.
    """
    print("Seeding health profile for Marcus Chen...")
    result = supabase.table("health_profiles").upsert(MARCUS_PROFILE).execute()
    print(f"  Profile upserted: {DEMO_USER_ID}")


def seed_labs() -> None:
    """
    Insert Marcus Chen's lab results into Supabase.

    Deletes existing labs for the demo user before inserting to ensure
    a clean reproducible state.

    Returns:
        None

    Raises:
        Exception: On Supabase write failure.
    """
    print("Seeding lab results...")
    # Delete existing labs for clean reseed
    supabase.table("lab_results").delete().eq("user_id", DEMO_USER_ID).execute()
    result = supabase.table("lab_results").insert(MARCUS_LABS).execute()
    print(f"  Inserted {len(MARCUS_LABS)} lab results")


def verify_seed() -> None:
    """
    Verify the seed data was written correctly by reading it back.

    Returns:
        None

    Raises:
        SystemExit: If verification fails.
    """
    print("Verifying seed data...")
    profile_resp = (
        supabase.table("health_profiles")
        .select("display_name, age, primary_conditions")
        .eq("user_id", DEMO_USER_ID)
        .single()
        .execute()
    )
    if not profile_resp.data:
        print("ERROR: Profile not found after seeding!")
        sys.exit(1)

    labs_resp = (
        supabase.table("lab_results")
        .select("test_name, value, status")
        .eq("user_id", DEMO_USER_ID)
        .execute()
    )
    lab_count = len(labs_resp.data or [])

    print(f"  Name: {profile_resp.data['display_name']}, Age: {profile_resp.data['age']}")
    print(f"  Conditions: {', '.join(profile_resp.data['primary_conditions'][:2])}...")
    print(f"  Labs: {lab_count} results")
    print("Seed verification passed.")


if __name__ == "__main__":
    print("=== Pulse Demo Seed Script ===")
    uid = ensure_auth_user()
    DEMO_USER_ID = uid
    # Patch all rows with the resolved UUID
    MARCUS_PROFILE["user_id"] = uid
    for lab in MARCUS_LABS:
        lab["user_id"] = uid
    seed_profile()
    seed_labs()
    verify_seed()
    print(f"\nDemo user ID: {DEMO_USER_ID}")
    print("Use this user_id in your API requests and mobile app demo.")
    print("=== Done ===")
