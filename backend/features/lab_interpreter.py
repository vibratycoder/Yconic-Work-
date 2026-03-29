"""Lab result interpretation utilities."""
from __future__ import annotations
from backend.models.health_profile import LabResult, LabStatus
from backend.utils.logger import get_logger

log = get_logger(__name__)

# Reference: clinical urgency thresholds beyond normal flags
CRITICAL_THRESHOLDS: dict[str, dict[str, float]] = {
    "Hemoglobin": {"critical_low": 7.0, "critical_high": 20.0},
    "Potassium": {"critical_low": 2.5, "critical_high": 6.5},
    "Sodium": {"critical_low": 120.0, "critical_high": 160.0},
    "Glucose": {"critical_low": 40.0, "critical_high": 500.0},
    "Creatinine": {"critical_high": 10.0},
    "INR": {"critical_high": 5.0},
    "Troponin": {"critical_high": 0.04},
}


def interpret_lab_result(lab: LabResult) -> str:
    """
    Generate a plain-language interpretation of a lab result.

    Provides clinical context including what the test measures, what the
    value means for the patient, and suggested next steps.

    Args:
        lab: LabResult to interpret

    Returns:
        Plain-language interpretation string (1-3 sentences).
    """
    if lab.value is None:
        return f"{lab.test_name}: {lab.value_text or 'No value recorded'}"

    status_text = {
        LabStatus.NORMAL: "within normal range",
        LabStatus.LOW: "below the normal range",
        LabStatus.HIGH: "above the normal range",
        LabStatus.CRITICAL: "at a CRITICAL level requiring immediate attention",
        LabStatus.UNKNOWN: "with unknown reference range",
    }.get(lab.status, "recorded")

    interpretation = f"{lab.test_name} is {lab.display_value}, {status_text}."
    if lab.is_abnormal and lab.reference_range_low is not None and lab.reference_range_high is not None:
        interpretation += (
            f" Normal range: {lab.reference_range_low}–{lab.reference_range_high} {lab.unit or ''}."
        )
    return interpretation
