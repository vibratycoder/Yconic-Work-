"""Extended triage logic for symptom urgency classification."""
from __future__ import annotations
from enum import Enum
from backend.utils.logger import get_logger

log = get_logger(__name__)


class TriageLevel(str, Enum):
    """Clinical urgency triage levels."""
    EMERGENCY = "emergency"
    URGENT = "urgent"
    ROUTINE = "routine"
    INFORMATIONAL = "informational"


URGENT_PATTERNS: list[list[str]] = [
    ["fever", "stiff neck"],
    ["fever", "confusion"],
    ["high fever"],
    ["severe pain"],
    ["sudden vision"],
    ["sudden hearing"],
    ["blood urine"],
    ["black stool"],
    ["dark urine", "yellow"],
    ["difficulty swallowing"],
    ["swollen", "painful", "leg"],
    ["shortness of breath"],
    ["rapid heart"],
    ["heart racing"],
    ["chest tightness"],
]


def classify_triage_level(text: str) -> TriageLevel:
    """
    Classify the urgency of a symptom report.

    Emergency patterns are checked first in check_emergency() (injector.py).
    This function handles the urgent and routine classification for
    non-emergency queries. Used for UI urgency indicators.

    Args:
        text: User's symptom description or health question

    Returns:
        TriageLevel enum value.
    """
    text_lower = text.lower()
    for pattern_group in URGENT_PATTERNS:
        if all(p in text_lower for p in pattern_group):
            log.info("triage_urgent", pattern=pattern_group)
            return TriageLevel.URGENT
        if len(pattern_group) == 1 and pattern_group[0] in text_lower:
            log.info("triage_urgent_single", pattern=pattern_group[0])
            return TriageLevel.URGENT
    symptom_words = ["pain", "ache", "hurt", "symptom", "feeling", "nausea", "dizzy"]
    if any(w in text_lower for w in symptom_words):
        return TriageLevel.ROUTINE
    return TriageLevel.INFORMATIONAL
