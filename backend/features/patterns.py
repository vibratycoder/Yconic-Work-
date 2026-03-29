"""Health pattern analysis from longitudinal data."""
from __future__ import annotations
from backend.models.health_profile import LabResult, LabStatus
from backend.utils.logger import get_logger

log = get_logger(__name__)


def identify_concerning_patterns(labs: list[LabResult]) -> list[str]:
    """
    Identify concerning patterns across multiple lab results.

    Looks for combinations of abnormal values that together may indicate
    a specific clinical syndrome or need for follow-up.

    Args:
        labs: List of LabResult objects, typically from a single panel

    Returns:
        List of pattern description strings. Empty if no concerns found.
    """
    patterns: list[str] = []
    abnormal_names = {l.test_name.lower() for l in labs if l.is_abnormal}

    # Metabolic syndrome indicators
    metabolic_indicators = {"ldl cholesterol", "triglycerides", "fasting glucose", "hemoglobin a1c"}
    if len(metabolic_indicators & abnormal_names) >= 2:
        patterns.append("Multiple metabolic syndrome indicators are abnormal — discuss cardiovascular risk with your doctor")

    # Kidney function concern
    kidney_markers = {"creatinine", "egfr", "bun", "uric acid"}
    if len(kidney_markers & abnormal_names) >= 2:
        patterns.append("Multiple kidney function markers are abnormal — nephrology referral may be warranted")

    # Anemia pattern
    anemia_markers = {"hemoglobin", "hematocrit", "mcv", "ferritin", "iron"}
    if len(anemia_markers & abnormal_names) >= 2:
        patterns.append("Pattern consistent with anemia — discuss iron studies and CBC with your doctor")

    if patterns:
        log.info("concerning_patterns_found", count=len(patterns))
    return patterns
