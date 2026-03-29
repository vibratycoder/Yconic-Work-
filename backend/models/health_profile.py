"""Health profile data models for Pulse."""
from __future__ import annotations
from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, Field, computed_field


class LabStatus(str, Enum):
    """Clinical status of a lab result relative to reference range."""
    NORMAL = "normal"
    LOW = "low"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class LabSource(str, Enum):
    """Source of a lab result."""
    MANUAL = "manual"
    PHOTO_OCR = "photo_ocr"
    HEALTHKIT = "healthkit"
    EHR_IMPORT = "ehr_import"
    PDF = "pdf"


class Medication(BaseModel):
    """
    A medication currently taken by the user.

    Attributes:
        name: Drug name (generic or brand)
        dose: Dosage amount and unit (e.g. '10mg')
        frequency: How often taken (e.g. 'twice daily')
        prescribing_condition: Condition the medication treats, if known
    """
    name: str
    dose: str
    frequency: str
    prescribing_condition: str | None = None


class LabResult(BaseModel):
    """
    A single lab test result with value, unit, and reference range.

    Attributes:
        test_name: Human-readable test name (e.g. 'LDL Cholesterol')
        loinc_code: LOINC code for the test, if available
        value: Numeric result value
        value_text: Text result for qualitative tests
        unit: Measurement unit (e.g. 'mg/dL')
        reference_range_low: Lower bound of normal range
        reference_range_high: Upper bound of normal range
        status: Clinical status relative to reference range
        date_collected: Date specimen was collected
        lab_source: How this result was entered
    """
    test_name: str
    loinc_code: str | None = None
    value: float | None = None
    value_text: str | None = None
    unit: str | None = None
    reference_range_low: float | None = None
    reference_range_high: float | None = None
    status: LabStatus = LabStatus.UNKNOWN
    date_collected: date | None = None
    lab_source: LabSource = LabSource.MANUAL

    @computed_field
    @property
    def is_abnormal(self) -> bool:
        """
        Return True if the lab result is outside the normal range.

        Returns:
            True if status is LOW, HIGH, or CRITICAL.
        """
        return self.status in (LabStatus.LOW, LabStatus.HIGH, LabStatus.CRITICAL)

    @computed_field
    @property
    def display_value(self) -> str:
        """
        Return a human-readable value string with unit.

        Returns:
            Formatted string like '158.0 mg/dL' or the text value.
        """
        if self.value is not None:
            unit_str = f" {self.unit}" if self.unit else ""
            return f"{self.value}{unit_str}"
        return self.value_text or "N/A"


class WearableSummary(BaseModel):
    """
    Weekly summary of wearable/HealthKit data.

    Attributes:
        avg_resting_heart_rate: Average resting HR in bpm
        avg_hrv_ms: Average heart rate variability in milliseconds
        avg_sleep_hours: Average nightly sleep duration
        avg_sleep_quality: Qualitative sleep quality (good/fair/poor)
        avg_steps_per_day: Average daily step count
        avg_blood_glucose: Average blood glucose in mg/dL
        week_starting: Start date of the summary week
    """
    avg_resting_heart_rate: float | None = None
    avg_hrv_ms: float | None = None
    avg_sleep_hours: float | None = None
    avg_sleep_quality: str | None = None
    avg_steps_per_day: int | None = None
    avg_blood_glucose: float | None = None
    week_starting: date | None = None


class HealthProfile(BaseModel):
    """
    Complete health profile for a Pulse user.

    This model is injected as context into every Claude system prompt
    so the AI has full knowledge of the user's health history.

    Attributes:
        user_id: Supabase auth user ID
        display_name: User's preferred name
        age: Current age in years
        sex: Biological sex for clinical reference
        height_cm: Height in centimeters
        weight_kg: Weight in kilograms
        primary_conditions: Diagnosed medical conditions
        current_medications: Active medication list
        allergies: Known drug and food allergies
        recent_labs: Recent lab results (fetched separately)
        health_facts: Free-text facts extracted from conversations
        wearable_summary: Latest HealthKit weekly summary
        conversation_count: Total conversations with Pulse
        member_since: Account creation timestamp
    """
    user_id: str
    display_name: str = ""
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    primary_conditions: list[str] = Field(default_factory=list)
    current_medications: list[Medication] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    recent_labs: list[LabResult] = Field(default_factory=list)
    health_facts: list[str] = Field(default_factory=list)
    wearable_summary: WearableSummary | None = None
    conversation_count: int = 0
    member_since: datetime = Field(default_factory=datetime.utcnow)

    def to_context_string(self) -> str:
        """
        Render the health profile as a structured text block for LLM injection.

        Returns:
            Multi-line string summarizing all available health data.
        """
        parts: list[str] = []

        # Demographics
        demo_parts: list[str] = []
        if self.age:
            demo_parts.append(f"Age: {self.age}")
        if self.sex:
            demo_parts.append(f"Sex: {self.sex}")
        if self.height_cm:
            demo_parts.append(f"Height: {self.height_cm}cm")
        if self.weight_kg:
            demo_parts.append(f"Weight: {self.weight_kg}kg")
        if demo_parts:
            parts.append("DEMOGRAPHICS: " + ", ".join(demo_parts))

        # Conditions
        if self.primary_conditions:
            parts.append("CONDITIONS: " + ", ".join(self.primary_conditions))

        # Medications
        if self.current_medications:
            med_strs = [f"{m.name} {m.dose} {m.frequency}" for m in self.current_medications]
            parts.append("MEDICATIONS: " + "; ".join(med_strs))

        # Allergies
        if self.allergies:
            parts.append("ALLERGIES: " + ", ".join(self.allergies))

        # Abnormal labs
        abnormal = [l for l in self.recent_labs if l.is_abnormal]
        if abnormal:
            lab_strs = [f"{l.test_name} {l.display_value} ({l.status.value})" for l in abnormal]
            parts.append("ABNORMAL LABS: " + "; ".join(lab_strs))
        elif self.recent_labs:
            lab_strs = [f"{l.test_name} {l.display_value}" for l in self.recent_labs[:5]]
            parts.append("RECENT LABS: " + "; ".join(lab_strs))

        # Wearable summary
        if self.wearable_summary:
            ws = self.wearable_summary
            ws_parts: list[str] = []
            if ws.avg_resting_heart_rate:
                ws_parts.append(f"HR {ws.avg_resting_heart_rate:.0f}bpm")
            if ws.avg_hrv_ms:
                ws_parts.append(f"HRV {ws.avg_hrv_ms:.0f}ms")
            if ws.avg_sleep_hours:
                ws_parts.append(f"Sleep {ws.avg_sleep_hours:.1f}h ({ws.avg_sleep_quality or 'unknown'})")
            if ws.avg_steps_per_day:
                ws_parts.append(f"Steps {ws.avg_steps_per_day:,}/day")
            if ws.avg_blood_glucose:
                ws_parts.append(f"Glucose {ws.avg_blood_glucose:.0f}mg/dL")
            if ws_parts:
                parts.append("WEARABLES (7-day avg): " + ", ".join(ws_parts))

        # Health facts
        if self.health_facts:
            parts.append("HEALTH HISTORY:")
            for fact in self.health_facts[-10:]:
                parts.append(f"  - {fact}")

        if not parts:
            return "No health profile data available."
        return "\n".join(parts)
