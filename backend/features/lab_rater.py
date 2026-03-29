"""Personalized lab result rating against demographic-adjusted reference ranges."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel

from backend.features.lab_reference_ranges import ReferenceRange, get_personalized_range
from backend.models.health_profile import LabResult, LabStatus
from backend.utils.logger import get_logger

log = get_logger(__name__)


class LabRating(str, Enum):
    """Three-tier rating shown to the user."""

    HIGH = "High"
    NORMAL = "Normal"
    LOW = "Low"
    UNKNOWN = "Unknown"


class RatedLabResult(BaseModel):
    """
    A lab result enriched with a personalized High / Normal / Low rating.

    Attributes:
        test_name: Human-readable test name.
        value: Numeric result value (None for qualitative tests).
        value_text: Text result for qualitative tests.
        unit: Measurement unit.
        rating: Personalized three-tier rating (High / Normal / Low / Unknown).
        personalized_range_low: Lower bound of the personalized normal range.
        personalized_range_high: Upper bound of the personalized normal range.
        original_status: Status flag from the source lab document (OCR / HealthKit).
        deviation_pct: How far the value sits outside the range as a percentage.
            Positive = above high bound; negative = below low bound; zero = inside.
        range_note: Clinical note about the reference range, if any.
        date_collected: Specimen collection date (ISO format).
        lab_source: Origin of the result (photo_ocr, manual, etc.).
    """

    test_name: str
    value: float | None = None
    value_text: str | None = None
    unit: str | None = None
    rating: LabRating
    personalized_range_low: float | None = None
    personalized_range_high: float | None = None
    original_status: LabStatus
    deviation_pct: float | None = None
    range_note: str = ""
    date_collected: str | None = None
    lab_source: str = "manual"


def _compute_deviation(
    value: float,
    ref: ReferenceRange,
) -> tuple[LabRating, float | None]:
    """
    Determine rating and deviation percentage for a numeric lab value.

    Deviation is expressed as the percentage above the upper bound
    (positive) or below the lower bound (negative).  Values within the
    range have 0.0 deviation.

    Args:
        value: The numeric lab value.
        ref: Personalized reference range.

    Returns:
        Tuple of (LabRating, deviation_pct).
    """
    above_high = ref.high is not None and value > ref.high
    below_low = ref.low is not None and value < ref.low

    if above_high:
        deviation = ((value - ref.high) / ref.high * 100) if ref.high else None  # type: ignore[operator]
        return LabRating.HIGH, round(deviation, 1) if deviation is not None else None

    if below_low:
        deviation = ((ref.low - value) / ref.low * 100) if ref.low else None  # type: ignore[operator]
        return LabRating.LOW, -round(deviation, 1) if deviation is not None else None

    return LabRating.NORMAL, 0.0


def rate_lab_result(
    lab: LabResult,
    age: int | None = None,
    sex: str | None = None,
    weight_kg: float | None = None,
    height_cm: float | None = None,
) -> RatedLabResult:
    """
    Rate a lab result as High, Normal, or Low against personalized reference ranges.

    Personalized ranges are derived from the user's age, sex, and BMI.
    When personalized ranges are unavailable the function falls back to the
    reference range embedded in the lab result itself (from the source
    document).  If no range is available at all, the original OCR status
    is translated directly into a LabRating.

    Args:
        lab: Raw LabResult to rate.
        age: Patient age in years.
        sex: Biological sex string ('male', 'female', etc.).
        weight_kg: Weight in kilograms.
        height_cm: Height in centimetres.

    Returns:
        RatedLabResult with the personalized rating and deviation.
    """
    date_str: str | None = None
    if lab.date_collected is not None:
        date_str = lab.date_collected.isoformat()

    # --- Qualitative results (no numeric value) ---
    if lab.value is None:
        # Map existing status to LabRating as best we can
        rating_map = {
            LabStatus.NORMAL: LabRating.NORMAL,
            LabStatus.LOW: LabRating.LOW,
            LabStatus.HIGH: LabRating.HIGH,
            LabStatus.CRITICAL: LabRating.HIGH,
            LabStatus.UNKNOWN: LabRating.UNKNOWN,
        }
        return RatedLabResult(
            test_name=lab.test_name,
            value=None,
            value_text=lab.value_text,
            unit=lab.unit,
            rating=rating_map.get(lab.status, LabRating.UNKNOWN),
            personalized_range_low=None,
            personalized_range_high=None,
            original_status=lab.status,
            deviation_pct=None,
            range_note="qualitative result",
            date_collected=date_str,
            lab_source=lab.lab_source.value,
        )

    # --- Determine reference range ---
    personalized_ref: ReferenceRange | None = get_personalized_range(
        lab.test_name, age=age, sex=sex, weight_kg=weight_kg, height_cm=height_cm,
    )

    if personalized_ref is not None:
        ref = personalized_ref
        range_note = ref.note
    elif lab.reference_range_low is not None or lab.reference_range_high is not None:
        # Fall back to embedded lab document range
        ref = ReferenceRange(
            low=lab.reference_range_low,
            high=lab.reference_range_high,
            unit=lab.unit or "",
            note="from lab report",
        )
        range_note = "from lab report"
    else:
        # No range available — honour the OCR status flag directly
        rating_map = {
            LabStatus.NORMAL: LabRating.NORMAL,
            LabStatus.LOW: LabRating.LOW,
            LabStatus.HIGH: LabRating.HIGH,
            LabStatus.CRITICAL: LabRating.HIGH,
            LabStatus.UNKNOWN: LabRating.UNKNOWN,
        }
        log.debug("lab_rater_no_range", test_name=lab.test_name)
        return RatedLabResult(
            test_name=lab.test_name,
            value=lab.value,
            value_text=lab.value_text,
            unit=lab.unit,
            rating=rating_map.get(lab.status, LabRating.UNKNOWN),
            personalized_range_low=None,
            personalized_range_high=None,
            original_status=lab.status,
            deviation_pct=None,
            range_note="no reference range available",
            date_collected=date_str,
            lab_source=lab.lab_source.value,
        )

    # --- Compute rating against the chosen range ---
    rating, deviation_pct = _compute_deviation(lab.value, ref)

    log.debug(
        "lab_rated",
        test=lab.test_name,
        value=lab.value,
        rating=rating.value,
        range_low=ref.low,
        range_high=ref.high,
        deviation_pct=deviation_pct,
    )

    return RatedLabResult(
        test_name=lab.test_name,
        value=lab.value,
        value_text=lab.value_text,
        unit=lab.unit,
        rating=rating,
        personalized_range_low=ref.low,
        personalized_range_high=ref.high,
        original_status=lab.status,
        deviation_pct=deviation_pct,
        range_note=range_note,
        date_collected=date_str,
        lab_source=lab.lab_source.value,
    )


def rate_lab_results(
    labs: list[LabResult],
    age: int | None = None,
    sex: str | None = None,
    weight_kg: float | None = None,
    height_cm: float | None = None,
) -> list[RatedLabResult]:
    """
    Rate a list of lab results using personalized reference ranges.

    Convenience wrapper around :func:`rate_lab_result` that processes an
    entire panel at once.

    Args:
        labs: List of raw LabResult objects to rate.
        age: Patient age in years.
        sex: Biological sex string.
        weight_kg: Weight in kilograms.
        height_cm: Height in centimetres.

    Returns:
        List of RatedLabResult objects in the same order as the input.
    """
    return [
        rate_lab_result(lab, age=age, sex=sex, weight_kg=weight_kg, height_cm=height_cm)
        for lab in labs
    ]
