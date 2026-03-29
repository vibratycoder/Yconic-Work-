"""Personalized lab reference ranges adjusted for age, sex, and BMI."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ReferenceRange:
    """
    Normal reference range for a single lab test.

    Attributes:
        low: Lower bound of the normal range (inclusive).
        high: Upper bound of the normal range (inclusive).
        unit: Expected measurement unit (informational only).
        note: Optional clinical note about the range.
    """

    low: float | None
    high: float | None
    unit: str = ""
    note: str = ""


# ---------------------------------------------------------------------------
# Base reference ranges — sex-neutral adult defaults
# These are overridden by sex- and age-specific adjustments below.
# Sources: LabCorp / Quest reference intervals, ARUP Laboratories.
# ---------------------------------------------------------------------------

_BASE: dict[str, ReferenceRange] = {
    # ── CBC ──────────────────────────────────────────────────────────────
    "WBC": ReferenceRange(4.5, 11.0, "K/uL"),
    "White Blood Cell Count": ReferenceRange(4.5, 11.0, "K/uL"),
    "White Blood Cells": ReferenceRange(4.5, 11.0, "K/uL"),
    "RBC": ReferenceRange(4.2, 5.4, "M/uL"),
    "Red Blood Cell Count": ReferenceRange(4.2, 5.4, "M/uL"),
    "Red Blood Cells": ReferenceRange(4.2, 5.4, "M/uL"),
    "Hemoglobin": ReferenceRange(12.0, 17.5, "g/dL"),
    "Hgb": ReferenceRange(12.0, 17.5, "g/dL"),
    "Hematocrit": ReferenceRange(36.0, 53.0, "%"),
    "Hct": ReferenceRange(36.0, 53.0, "%"),
    "MCV": ReferenceRange(80.0, 100.0, "fL"),
    "MCH": ReferenceRange(27.0, 33.0, "pg"),
    "MCHC": ReferenceRange(32.0, 36.0, "g/dL"),
    "Platelets": ReferenceRange(150.0, 400.0, "K/uL"),
    "Platelet Count": ReferenceRange(150.0, 400.0, "K/uL"),
    "Neutrophils": ReferenceRange(40.0, 70.0, "%"),
    "Lymphocytes": ReferenceRange(20.0, 40.0, "%"),
    "Monocytes": ReferenceRange(2.0, 10.0, "%"),
    "Eosinophils": ReferenceRange(1.0, 4.0, "%"),
    "Basophils": ReferenceRange(0.0, 1.0, "%"),
    "Absolute Neutrophils": ReferenceRange(1.8, 7.7, "K/uL"),
    "Absolute Lymphocytes": ReferenceRange(1.0, 4.8, "K/uL"),
    # ── CMP ──────────────────────────────────────────────────────────────
    "Glucose": ReferenceRange(70.0, 99.0, "mg/dL", "fasting"),
    "Fasting Glucose": ReferenceRange(70.0, 99.0, "mg/dL"),
    "BUN": ReferenceRange(7.0, 20.0, "mg/dL"),
    "Blood Urea Nitrogen": ReferenceRange(7.0, 20.0, "mg/dL"),
    "Creatinine": ReferenceRange(0.6, 1.3, "mg/dL"),
    "Serum Creatinine": ReferenceRange(0.6, 1.3, "mg/dL"),
    "eGFR": ReferenceRange(60.0, None, "mL/min/1.73m²", "lower limit only"),
    "GFR": ReferenceRange(60.0, None, "mL/min/1.73m²"),
    "Calcium": ReferenceRange(8.5, 10.5, "mg/dL"),
    "Serum Calcium": ReferenceRange(8.5, 10.5, "mg/dL"),
    "Sodium": ReferenceRange(136.0, 145.0, "mEq/L"),
    "Potassium": ReferenceRange(3.5, 5.0, "mEq/L"),
    "Chloride": ReferenceRange(98.0, 107.0, "mEq/L"),
    "CO2": ReferenceRange(22.0, 29.0, "mEq/L"),
    "Bicarbonate": ReferenceRange(22.0, 29.0, "mEq/L"),
    "Total Protein": ReferenceRange(6.3, 8.2, "g/dL"),
    "Albumin": ReferenceRange(3.5, 5.0, "g/dL"),
    "Total Bilirubin": ReferenceRange(0.2, 1.2, "mg/dL"),
    "Direct Bilirubin": ReferenceRange(0.0, 0.3, "mg/dL"),
    "Indirect Bilirubin": ReferenceRange(0.2, 0.9, "mg/dL"),
    "ALT": ReferenceRange(7.0, 56.0, "U/L"),
    "Alanine Aminotransferase": ReferenceRange(7.0, 56.0, "U/L"),
    "AST": ReferenceRange(10.0, 40.0, "U/L"),
    "Aspartate Aminotransferase": ReferenceRange(10.0, 40.0, "U/L"),
    "ALP": ReferenceRange(44.0, 147.0, "U/L"),
    "Alkaline Phosphatase": ReferenceRange(44.0, 147.0, "U/L"),
    "GGT": ReferenceRange(8.0, 61.0, "U/L"),
    "Gamma-Glutamyl Transferase": ReferenceRange(8.0, 61.0, "U/L"),
    "Anion Gap": ReferenceRange(8.0, 16.0, "mEq/L"),
    # ── Lipid Panel ──────────────────────────────────────────────────────
    "Total Cholesterol": ReferenceRange(None, 200.0, "mg/dL", "desirable <200"),
    "Cholesterol": ReferenceRange(None, 200.0, "mg/dL"),
    "LDL": ReferenceRange(None, 100.0, "mg/dL", "optimal <100"),
    "LDL Cholesterol": ReferenceRange(None, 100.0, "mg/dL"),
    "LDL-C": ReferenceRange(None, 100.0, "mg/dL"),
    "HDL": ReferenceRange(40.0, None, "mg/dL", "low risk >60"),
    "HDL Cholesterol": ReferenceRange(40.0, None, "mg/dL"),
    "HDL-C": ReferenceRange(40.0, None, "mg/dL"),
    "Triglycerides": ReferenceRange(None, 150.0, "mg/dL", "normal <150"),
    "Non-HDL Cholesterol": ReferenceRange(None, 130.0, "mg/dL"),
    # ── Thyroid ──────────────────────────────────────────────────────────
    "TSH": ReferenceRange(0.4, 4.0, "mIU/L"),
    "Thyroid Stimulating Hormone": ReferenceRange(0.4, 4.0, "mIU/L"),
    "Free T4": ReferenceRange(0.8, 1.8, "ng/dL"),
    "Free Thyroxine": ReferenceRange(0.8, 1.8, "ng/dL"),
    "Free T3": ReferenceRange(2.3, 4.1, "pg/mL"),
    "Free Triiodothyronine": ReferenceRange(2.3, 4.1, "pg/mL"),
    "Total T4": ReferenceRange(5.1, 14.1, "ug/dL"),
    "Total T3": ReferenceRange(71.0, 180.0, "ng/dL"),
    # ── Diabetes ─────────────────────────────────────────────────────────
    "HbA1c": ReferenceRange(None, 5.7, "%", "prediabetes 5.7-6.4%, diabetes ≥6.5%"),
    "Hemoglobin A1c": ReferenceRange(None, 5.7, "%"),
    "A1C": ReferenceRange(None, 5.7, "%"),
    "Insulin": ReferenceRange(2.0, 25.0, "uIU/mL", "fasting"),
    "C-Peptide": ReferenceRange(0.8, 3.5, "ng/mL"),
    # ── Iron Studies ─────────────────────────────────────────────────────
    "Iron": ReferenceRange(50.0, 170.0, "mcg/dL"),
    "Serum Iron": ReferenceRange(50.0, 170.0, "mcg/dL"),
    "TIBC": ReferenceRange(250.0, 370.0, "mcg/dL"),
    "Total Iron Binding Capacity": ReferenceRange(250.0, 370.0, "mcg/dL"),
    "Transferrin Saturation": ReferenceRange(20.0, 50.0, "%"),
    "Ferritin": ReferenceRange(12.0, 300.0, "ng/mL"),
    "Serum Ferritin": ReferenceRange(12.0, 300.0, "ng/mL"),
    # ── Vitamins & Minerals ──────────────────────────────────────────────
    "Vitamin D": ReferenceRange(20.0, 80.0, "ng/mL", "insufficiency <20"),
    "25-OH Vitamin D": ReferenceRange(20.0, 80.0, "ng/mL"),
    "Vitamin B12": ReferenceRange(200.0, 900.0, "pg/mL"),
    "B12": ReferenceRange(200.0, 900.0, "pg/mL"),
    "Folate": ReferenceRange(3.0, 17.0, "ng/mL"),
    "Folic Acid": ReferenceRange(3.0, 17.0, "ng/mL"),
    "Magnesium": ReferenceRange(1.6, 2.3, "mg/dL"),
    "Phosphorus": ReferenceRange(2.5, 4.5, "mg/dL"),
    "Zinc": ReferenceRange(60.0, 130.0, "mcg/dL"),
    # ── Cardiac ──────────────────────────────────────────────────────────
    "Troponin I": ReferenceRange(None, 0.04, "ng/mL"),
    "Troponin T": ReferenceRange(None, 0.01, "ng/mL"),
    "Troponin": ReferenceRange(None, 0.04, "ng/mL"),
    "BNP": ReferenceRange(None, 100.0, "pg/mL"),
    "NT-proBNP": ReferenceRange(None, 125.0, "pg/mL"),
    "CK": ReferenceRange(22.0, 198.0, "U/L"),
    "Creatine Kinase": ReferenceRange(22.0, 198.0, "U/L"),
    "CK-MB": ReferenceRange(None, 6.3, "ng/mL"),
    # ── Inflammation ─────────────────────────────────────────────────────
    "CRP": ReferenceRange(None, 10.0, "mg/L"),
    "C-Reactive Protein": ReferenceRange(None, 10.0, "mg/L"),
    "hs-CRP": ReferenceRange(None, 3.0, "mg/L", "low cardiac risk <1"),
    "High Sensitivity CRP": ReferenceRange(None, 3.0, "mg/L"),
    "ESR": ReferenceRange(None, 20.0, "mm/hr", "age-adjusted"),
    "Erythrocyte Sedimentation Rate": ReferenceRange(None, 20.0, "mm/hr"),
    # ── Coagulation ──────────────────────────────────────────────────────
    "INR": ReferenceRange(0.9, 1.1, "", "therapeutic 2.0-3.0 for anticoagulation"),
    "PT": ReferenceRange(11.0, 13.5, "seconds"),
    "Prothrombin Time": ReferenceRange(11.0, 13.5, "seconds"),
    "aPTT": ReferenceRange(25.0, 35.0, "seconds"),
    "Fibrinogen": ReferenceRange(200.0, 400.0, "mg/dL"),
    # ── Kidney ───────────────────────────────────────────────────────────
    "Uric Acid": ReferenceRange(3.4, 7.0, "mg/dL"),
    "Urea": ReferenceRange(7.0, 20.0, "mg/dL"),
    "Cystatin C": ReferenceRange(0.53, 0.95, "mg/L"),
    # ── Hormones ─────────────────────────────────────────────────────────
    "Cortisol": ReferenceRange(6.2, 19.4, "mcg/dL", "morning draw"),
    "DHEA-S": ReferenceRange(35.0, 430.0, "mcg/dL"),
    "Testosterone": ReferenceRange(270.0, 1070.0, "ng/dL", "total; male default"),
    "Total Testosterone": ReferenceRange(270.0, 1070.0, "ng/dL"),
    "Free Testosterone": ReferenceRange(9.0, 30.0, "pg/mL"),
    "Estradiol": ReferenceRange(15.0, 350.0, "pg/mL"),
    "Progesterone": ReferenceRange(0.1, 0.9, "ng/mL", "follicular phase"),
    "LH": ReferenceRange(1.5, 9.3, "IU/L"),
    "FSH": ReferenceRange(1.5, 12.4, "IU/L"),
    "Prolactin": ReferenceRange(2.0, 29.0, "ng/mL"),
    "IGF-1": ReferenceRange(88.0, 246.0, "ng/mL"),
    # ── Urinalysis ───────────────────────────────────────────────────────
    "Protein (urine)": ReferenceRange(None, 150.0, "mg/day"),
    "Microalbumin": ReferenceRange(None, 30.0, "mg/g"),
    "Urine Creatinine": ReferenceRange(500.0, 2000.0, "mg/day"),
    # ── Cancer Markers ───────────────────────────────────────────────────
    "PSA": ReferenceRange(None, 4.0, "ng/mL", "age-adjusted"),
    "CEA": ReferenceRange(None, 3.0, "ng/mL"),
    "CA-125": ReferenceRange(None, 35.0, "U/mL"),
    "CA 19-9": ReferenceRange(None, 37.0, "U/mL"),
    "AFP": ReferenceRange(None, 8.3, "ng/mL"),
}

# ---------------------------------------------------------------------------
# Sex-specific overrides (key = test name, value = {male: range, female: range})
# ---------------------------------------------------------------------------

_SEX_RANGES: dict[str, dict[str, ReferenceRange]] = {
    "RBC": {
        "male":   ReferenceRange(4.5, 5.9, "M/uL"),
        "female": ReferenceRange(4.0, 5.2, "M/uL"),
    },
    "Red Blood Cell Count": {
        "male":   ReferenceRange(4.5, 5.9, "M/uL"),
        "female": ReferenceRange(4.0, 5.2, "M/uL"),
    },
    "Hemoglobin": {
        "male":   ReferenceRange(13.5, 17.5, "g/dL"),
        "female": ReferenceRange(12.0, 15.5, "g/dL"),
    },
    "Hgb": {
        "male":   ReferenceRange(13.5, 17.5, "g/dL"),
        "female": ReferenceRange(12.0, 15.5, "g/dL"),
    },
    "Hematocrit": {
        "male":   ReferenceRange(41.0, 53.0, "%"),
        "female": ReferenceRange(36.0, 46.0, "%"),
    },
    "Hct": {
        "male":   ReferenceRange(41.0, 53.0, "%"),
        "female": ReferenceRange(36.0, 46.0, "%"),
    },
    "Creatinine": {
        "male":   ReferenceRange(0.7, 1.3, "mg/dL"),
        "female": ReferenceRange(0.6, 1.1, "mg/dL"),
    },
    "Serum Creatinine": {
        "male":   ReferenceRange(0.7, 1.3, "mg/dL"),
        "female": ReferenceRange(0.6, 1.1, "mg/dL"),
    },
    "ALT": {
        "male":   ReferenceRange(7.0, 56.0, "U/L"),
        "female": ReferenceRange(7.0, 45.0, "U/L"),
    },
    "Alanine Aminotransferase": {
        "male":   ReferenceRange(7.0, 56.0, "U/L"),
        "female": ReferenceRange(7.0, 45.0, "U/L"),
    },
    "Ferritin": {
        "male":   ReferenceRange(20.0, 500.0, "ng/mL"),
        "female": ReferenceRange(12.0, 150.0, "ng/mL"),
    },
    "Serum Ferritin": {
        "male":   ReferenceRange(20.0, 500.0, "ng/mL"),
        "female": ReferenceRange(12.0, 150.0, "ng/mL"),
    },
    "Iron": {
        "male":   ReferenceRange(60.0, 170.0, "mcg/dL"),
        "female": ReferenceRange(50.0, 170.0, "mcg/dL"),
    },
    "Serum Iron": {
        "male":   ReferenceRange(60.0, 170.0, "mcg/dL"),
        "female": ReferenceRange(50.0, 170.0, "mcg/dL"),
    },
    "Uric Acid": {
        "male":   ReferenceRange(3.4, 7.0, "mg/dL"),
        "female": ReferenceRange(2.4, 6.0, "mg/dL"),
    },
    "HDL": {
        "male":   ReferenceRange(40.0, None, "mg/dL"),
        "female": ReferenceRange(50.0, None, "mg/dL"),
    },
    "HDL Cholesterol": {
        "male":   ReferenceRange(40.0, None, "mg/dL"),
        "female": ReferenceRange(50.0, None, "mg/dL"),
    },
    "HDL-C": {
        "male":   ReferenceRange(40.0, None, "mg/dL"),
        "female": ReferenceRange(50.0, None, "mg/dL"),
    },
    "GGT": {
        "male":   ReferenceRange(8.0, 61.0, "U/L"),
        "female": ReferenceRange(5.0, 36.0, "U/L"),
    },
    "Testosterone": {
        "male":   ReferenceRange(270.0, 1070.0, "ng/dL"),
        "female": ReferenceRange(15.0, 70.0, "ng/dL"),
    },
    "Total Testosterone": {
        "male":   ReferenceRange(270.0, 1070.0, "ng/dL"),
        "female": ReferenceRange(15.0, 70.0, "ng/dL"),
    },
    "PSA": {
        "male":   ReferenceRange(None, 4.0, "ng/mL"),
        "female": ReferenceRange(None, None, "ng/mL", "not applicable"),
    },
    "CK": {
        "male":   ReferenceRange(39.0, 308.0, "U/L"),
        "female": ReferenceRange(26.0, 192.0, "U/L"),
    },
    "Creatine Kinase": {
        "male":   ReferenceRange(39.0, 308.0, "U/L"),
        "female": ReferenceRange(26.0, 192.0, "U/L"),
    },
    "ESR": {
        "male":   ReferenceRange(None, 15.0, "mm/hr"),
        "female": ReferenceRange(None, 20.0, "mm/hr"),
    },
    "Erythrocyte Sedimentation Rate": {
        "male":   ReferenceRange(None, 15.0, "mm/hr"),
        "female": ReferenceRange(None, 20.0, "mm/hr"),
    },
}

# ---------------------------------------------------------------------------
# Age-specific adjustments applied on top of the sex-specific range.
# Keys are test names, values map age-bracket labels to (delta_low, delta_high).
# A None delta means "don't change that bound".
# ---------------------------------------------------------------------------

def _egfr_range(age: int) -> ReferenceRange:
    """Return age-adjusted eGFR lower normal limit.

    Kidney function declines slightly with age; the lower normal threshold
    decreases for older adults.

    Args:
        age: Patient age in years.

    Returns:
        ReferenceRange with age-appropriate lower bound.
    """
    if age >= 70:
        return ReferenceRange(45.0, None, "mL/min/1.73m²", "age-adjusted for 70+")
    if age >= 60:
        return ReferenceRange(55.0, None, "mL/min/1.73m²", "age-adjusted for 60+")
    return ReferenceRange(60.0, None, "mL/min/1.73m²")


def _psa_range(age: int) -> ReferenceRange:
    """Return age-adjusted PSA upper normal limit.

    PSA naturally increases with age; thresholds are raised for older men.

    Args:
        age: Patient age in years.

    Returns:
        ReferenceRange with age-appropriate upper bound.
    """
    if age >= 70:
        return ReferenceRange(None, 6.5, "ng/mL", "age-adjusted for 70+")
    if age >= 60:
        return ReferenceRange(None, 4.5, "ng/mL", "age-adjusted for 60+")
    if age >= 50:
        return ReferenceRange(None, 3.5, "ng/mL", "age-adjusted for 50+")
    return ReferenceRange(None, 2.5, "ng/mL", "age-adjusted for <50")


def _bun_range(age: int) -> ReferenceRange:
    """Return age-adjusted BUN reference range.

    BUN tends to rise slightly with age due to decreased kidney reserve.

    Args:
        age: Patient age in years.

    Returns:
        ReferenceRange adjusted for age.
    """
    if age >= 60:
        return ReferenceRange(8.0, 23.0, "mg/dL", "age-adjusted for 60+")
    return ReferenceRange(7.0, 20.0, "mg/dL")


def _esr_range(age: int, sex: str | None) -> ReferenceRange:
    """Return age- and sex-adjusted ESR upper limit.

    ESR rises with age; the formula (age / 2 for males, (age + 10) / 2
    for females) is widely used in clinical practice.

    Args:
        age: Patient age in years.
        sex: Biological sex ('male' or 'female').

    Returns:
        ReferenceRange with age/sex-adjusted upper bound.
    """
    if sex and sex.lower().startswith("f"):
        upper = round((age + 10) / 2)
    else:
        upper = round(age / 2)
    return ReferenceRange(None, float(upper), "mm/hr", f"age/sex-adjusted upper limit")


# ---------------------------------------------------------------------------
# BMI helpers
# ---------------------------------------------------------------------------

def _compute_bmi(weight_kg: float | None, height_cm: float | None) -> float | None:
    """Compute BMI from weight and height.

    Args:
        weight_kg: Weight in kilograms.
        height_cm: Height in centimetres.

    Returns:
        BMI float or None if either measurement is unavailable.
    """
    if weight_kg and height_cm and height_cm > 0:
        height_m = height_cm / 100.0
        return weight_kg / (height_m ** 2)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_personalized_range(
    test_name: str,
    age: int | None = None,
    sex: str | None = None,
    weight_kg: float | None = None,
    height_cm: float | None = None,
) -> ReferenceRange | None:
    """
    Return a personalized reference range for a lab test.

    Applies adjustments in priority order:
    1. Age-specific special cases (eGFR, PSA, BUN, ESR)
    2. Sex-specific overrides from ``_SEX_RANGES``
    3. Base neutral range from ``_BASE``

    A BMI above 30 expands the Triglycerides upper bound to 200 mg/dL and
    the fasting Glucose upper bound to 105 mg/dL to reflect adjusted clinical
    expectations in obese patients per ATP III / ADA guidance.

    Args:
        test_name: Exact test name as returned by the OCR extractor.
        age: Patient age in years (used for age-specific adjustments).
        sex: Biological sex string — 'male', 'female', or other.
        weight_kg: Weight in kilograms (used for BMI calculation).
        height_cm: Height in centimetres (used for BMI calculation).

    Returns:
        ReferenceRange if the test is in the lookup table, else None.
    """
    # Normalise sex string
    sex_key: str | None = None
    if sex:
        if sex.lower().startswith("m"):
            sex_key = "male"
        elif sex.lower().startswith("f"):
            sex_key = "female"

    bmi = _compute_bmi(weight_kg, height_cm)

    # --- Special age-driven dynamic ranges ---
    if test_name in ("eGFR", "GFR") and age is not None:
        return _egfr_range(age)

    if test_name in ("PSA",) and age is not None and sex_key == "male":
        return _psa_range(age)

    if test_name in ("BUN", "Blood Urea Nitrogen") and age is not None:
        return _bun_range(age)

    if test_name in ("ESR", "Erythrocyte Sedimentation Rate") and age is not None:
        return _esr_range(age, sex)

    # --- Sex-specific ranges ---
    if sex_key and test_name in _SEX_RANGES:
        base = _SEX_RANGES[test_name].get(sex_key)
    else:
        base = _BASE.get(test_name)

    if base is None:
        # Try case-insensitive fallback
        lower = test_name.lower()
        for key, val in _BASE.items():
            if key.lower() == lower:
                base = val
                break

    if base is None:
        return None

    # --- BMI adjustments (high BMI relaxes metabolic thresholds slightly) ---
    if bmi is not None and bmi > 30.0:
        if test_name in ("Triglycerides",) and base.high is not None:
            base = ReferenceRange(base.low, 200.0, base.unit, "BMI-adjusted (obese)")
        elif test_name in ("Glucose", "Fasting Glucose") and base.high is not None:
            base = ReferenceRange(base.low, 105.0, base.unit, "BMI-adjusted (obese)")

    return base
