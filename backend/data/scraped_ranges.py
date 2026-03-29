"""
Peer-reviewed blood work reference ranges sourced and maintained by the scrape agent.

This file is the authoritative data source for the Pulse bloodwork charts.
DO NOT edit by hand — run `python -m backend.agents.scrape_agent` to refresh.

All ranges are sourced from scrape.md. Each entry records the primary citation
so the provenance is traceable.

Last updated: 2026-03-29
Sources: 28 peer-reviewed studies / clinical guidelines
Biomarkers: 52
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ScrapedRange:
    """
    Evidence-backed reference range for a single blood test.

    Attributes:
        low: Lower bound of the normal range (inclusive). None = no lower limit.
        high: Upper bound of the normal range (inclusive). None = no upper limit.
        unit: Measurement unit string.
        note: Clinical note or category description.
        source: Short citation — Author(s), Journal, Year, PMID.
    """

    low: float | None
    high: float | None
    unit: str = ""
    note: str = ""
    source: str = ""


# ---------------------------------------------------------------------------
# Sex-neutral adult defaults
# ---------------------------------------------------------------------------

BASE: dict[str, ScrapedRange] = {

    # ── CBC ─────────────────────────────────────────────────────────────────
    # Source: Kratz A et al. N Engl J Med. 2004;351(15):1548. PMID:15470219

    "WBC": ScrapedRange(
        4.5, 11.0, "K/µL",
        "leukocytosis >11.0",
        "Kratz A et al. NEJM 2004. PMID:15470219",
    ),
    "White Blood Cell Count": ScrapedRange(
        4.5, 11.0, "K/µL", "", "Kratz A et al. NEJM 2004. PMID:15470219",
    ),
    "White Blood Cells": ScrapedRange(
        4.5, 11.0, "K/µL", "", "Kratz A et al. NEJM 2004. PMID:15470219",
    ),

    # RBC — sex-neutral fallback; sex-specific overrides in SEX_RANGES
    "RBC": ScrapedRange(
        4.2, 5.4, "M/µL", "sex-neutral default",
        "Beutler E, Waalen J. Blood 2006. PMID:16189263",
    ),
    "Red Blood Cell Count": ScrapedRange(
        4.2, 5.4, "M/µL", "", "Beutler E, Waalen J. Blood 2006. PMID:16189263",
    ),
    "Red Blood Cells": ScrapedRange(
        4.2, 5.4, "M/µL", "", "Beutler E, Waalen J. Blood 2006. PMID:16189263",
    ),

    # Hemoglobin — sex-neutral fallback
    "Hemoglobin": ScrapedRange(
        12.0, 17.5, "g/dL", "WHO 2011; sex-neutral default",
        "WHO NMH/NHD/MNM/11.1 2011; Beutler PMID:16189263",
    ),
    "Hgb": ScrapedRange(
        12.0, 17.5, "g/dL", "", "WHO 2011; Beutler PMID:16189263",
    ),

    # Hematocrit — sex-neutral fallback
    "Hematocrit": ScrapedRange(
        36.0, 53.0, "%", "sex-neutral default",
        "Kratz A et al. NEJM 2004. PMID:15470219",
    ),
    "Hct": ScrapedRange(36.0, 53.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    "MCV": ScrapedRange(
        80.0, 100.0, "fL", "microcytosis <80, macrocytosis >100",
        "Buttarello M, Plebani M. Am J Clin Pathol 2008. PMID:18550479",
    ),
    "MCH": ScrapedRange(27.0, 33.0, "pg", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "MCHC": ScrapedRange(32.0, 36.0, "g/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    "Platelets": ScrapedRange(
        150.0, 400.0, "K/µL", "thrombocytopenia <150",
        "Biino G et al. Ann Hum Genet 2011. PMID:21992101",
    ),
    "Platelet Count": ScrapedRange(
        150.0, 400.0, "K/µL", "", "Biino G et al. Ann Hum Genet 2011. PMID:21992101",
    ),

    "Neutrophils": ScrapedRange(
        40.0, 70.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219",
    ),
    "Lymphocytes": ScrapedRange(
        20.0, 40.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219",
    ),
    "Monocytes": ScrapedRange(2.0, 10.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Eosinophils": ScrapedRange(1.0, 4.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Basophils": ScrapedRange(0.0, 1.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Absolute Neutrophils": ScrapedRange(1.8, 7.7, "K/µL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Absolute Lymphocytes": ScrapedRange(1.0, 4.8, "K/µL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── CMP ─────────────────────────────────────────────────────────────────

    "Glucose": ScrapedRange(
        70.0, 99.0, "mg/dL", "fasting; prediabetes 100–125, diabetes ≥126",
        "ADA Standards of Care 2024. DOI:10.2337/dc24-S002",
    ),
    "Fasting Glucose": ScrapedRange(
        70.0, 99.0, "mg/dL", "prediabetes 100–125 mg/dL",
        "ADA Standards of Care 2024. DOI:10.2337/dc24-S002",
    ),

    "BUN": ScrapedRange(
        7.0, 20.0, "mg/dL", "age-adjusted for ≥60 y: 8–23",
        "Hosten AO. Clinical Methods 1990. PMID:21250145",
    ),
    "Blood Urea Nitrogen": ScrapedRange(
        7.0, 20.0, "mg/dL", "", "Hosten AO. Clinical Methods 1990. PMID:21250145",
    ),

    # Creatinine — sex-neutral fallback
    "Creatinine": ScrapedRange(
        0.6, 1.3, "mg/dL", "IDMS-calibrated; sex-specific preferred",
        "Levey AS et al. Ann Intern Med 2009. PMID:19414839",
    ),
    "Serum Creatinine": ScrapedRange(
        0.6, 1.3, "mg/dL", "", "Levey AS et al. Ann Intern Med 2009. PMID:19414839",
    ),

    "eGFR": ScrapedRange(
        60.0, None, "mL/min/1.73 m²", "lower limit only; age-adjusted",
        "Levey AS et al. Ann Intern Med 2009. PMID:19414839",
    ),
    "GFR": ScrapedRange(
        60.0, None, "mL/min/1.73 m²", "", "Levey AS et al. Ann Intern Med 2009. PMID:19414839",
    ),

    "Sodium": ScrapedRange(
        136.0, 145.0, "mEq/L", "",
        "Verbalis JG et al. Am J Med 2013. PMID:24074529",
    ),
    "Potassium": ScrapedRange(
        3.5, 5.0, "mEq/L", "arrhythmia risk <2.5 or >6.0",
        "Kratz A et al. NEJM 2004. PMID:15470219",
    ),
    "Chloride": ScrapedRange(98.0, 107.0, "mEq/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "CO2": ScrapedRange(22.0, 29.0, "mEq/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Bicarbonate": ScrapedRange(22.0, 29.0, "mEq/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    "Calcium": ScrapedRange(
        8.5, 10.5, "mg/dL", "",
        "Thakker RV. Cell Calcium 2004. PMID:14744598",
    ),
    "Serum Calcium": ScrapedRange(8.5, 10.5, "mg/dL", "", "Thakker RV. Cell Calcium 2004. PMID:14744598"),

    "Total Protein": ScrapedRange(6.3, 8.2, "g/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Albumin": ScrapedRange(
        3.5, 5.0, "g/dL", "",
        "Mendez CM et al. Nutr Clin Pract 2005. PMID:16207671",
    ),

    "Total Bilirubin": ScrapedRange(0.2, 1.2, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Direct Bilirubin": ScrapedRange(0.0, 0.3, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Indirect Bilirubin": ScrapedRange(0.2, 0.9, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ALT — sex-neutral fallback
    "ALT": ScrapedRange(
        7.0, 56.0, "U/L", "sex-specific preferred; female upper 45 U/L",
        "Prati D et al. Ann Intern Med 2002. PMID:12097536",
    ),
    "Alanine Aminotransferase": ScrapedRange(
        7.0, 56.0, "U/L", "", "Prati D et al. Ann Intern Med 2002. PMID:12097536",
    ),

    "AST": ScrapedRange(
        10.0, 40.0, "U/L", "",
        "Giannini EG et al. CMAJ 2005. PMID:15684109",
    ),
    "Aspartate Aminotransferase": ScrapedRange(
        10.0, 40.0, "U/L", "", "Giannini EG et al. CMAJ 2005. PMID:15684109",
    ),

    "ALP": ScrapedRange(
        44.0, 147.0, "U/L", "",
        "Lum G, Gambino SR. Clin Chem 1972. PMID:4337832",
    ),
    "Alkaline Phosphatase": ScrapedRange(44.0, 147.0, "U/L", "", "Lum G, Gambino SR. Clin Chem 1972. PMID:4337832"),

    "GGT": ScrapedRange(8.0, 61.0, "U/L", "sex-specific preferred", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Gamma-Glutamyl Transferase": ScrapedRange(8.0, 61.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    "Anion Gap": ScrapedRange(8.0, 16.0, "mEq/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Lipid Panel ─────────────────────────────────────────────────────────
    # Source: Grundy SM et al. JACC 2019. PMID:30423393; Stone NJ et al. JACC 2014. PMID:24239923

    "Total Cholesterol": ScrapedRange(
        None, 200.0, "mg/dL", "desirable <200; borderline 200–239; high ≥240",
        "Grundy SM et al. JACC 2019. PMID:30423393",
    ),
    "Cholesterol": ScrapedRange(None, 200.0, "mg/dL", "", "Grundy SM et al. JACC 2019. PMID:30423393"),

    "LDL": ScrapedRange(
        None, 100.0, "mg/dL", "optimal <100; very high risk target <70",
        "Stone NJ et al. JACC 2014. PMID:24239923",
    ),
    "LDL Cholesterol": ScrapedRange(None, 100.0, "mg/dL", "", "Stone NJ et al. JACC 2014. PMID:24239923"),
    "LDL-C": ScrapedRange(None, 100.0, "mg/dL", "", "Stone NJ et al. JACC 2014. PMID:24239923"),

    "HDL": ScrapedRange(
        40.0, None, "mg/dL", "low risk M >40, F >50; protective >60",
        "NCEP ATP III JAMA 2001. PMID:11368702",
    ),
    "HDL Cholesterol": ScrapedRange(40.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
    "HDL-C": ScrapedRange(40.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),

    "Triglycerides": ScrapedRange(
        None, 150.0, "mg/dL", "borderline 150–199; high 200–499; very high ≥500",
        "Miller M et al. Circulation 2011. PMID:21502576",
    ),
    "Non-HDL Cholesterol": ScrapedRange(None, 130.0, "mg/dL", "", "Grundy SM et al. JACC 2019. PMID:30423393"),

    # ── Thyroid ─────────────────────────────────────────────────────────────
    # Source: Hollowell JG et al. JCEM 2002. PMID:11836274

    "TSH": ScrapedRange(
        0.4, 4.0, "mIU/L",
        "NHANES III 2.5th–97.5th percentile 0.45–4.12; overt hypothyroid >10",
        "Hollowell JG et al. JCEM 2002. PMID:11836274",
    ),
    "Thyroid Stimulating Hormone": ScrapedRange(
        0.4, 4.0, "mIU/L", "", "Hollowell JG et al. JCEM 2002. PMID:11836274",
    ),

    "Free T4": ScrapedRange(
        0.8, 1.8, "ng/dL", "",
        "Ross DS et al. Thyroid 2016. PMID:27521067",
    ),
    "Free Thyroxine": ScrapedRange(0.8, 1.8, "ng/dL", "", "Ross DS et al. Thyroid 2016. PMID:27521067"),

    "Free T3": ScrapedRange(
        2.3, 4.1, "pg/mL", "",
        "Jonklaas J et al. Thyroid 2014. PMID:25266247",
    ),
    "Free Triiodothyronine": ScrapedRange(2.3, 4.1, "pg/mL", "", "Jonklaas J et al. Thyroid 2014. PMID:25266247"),

    "Total T4": ScrapedRange(5.1, 14.1, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Total T3": ScrapedRange(71.0, 180.0, "ng/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Diabetes ────────────────────────────────────────────────────────────
    # Source: International Expert Committee Diabetes Care 2009. PMID:19502545; ADA 2024

    "HbA1c": ScrapedRange(
        None, 5.7, "%",
        "normal <5.7%; prediabetes 5.7–6.4%; diabetes ≥6.5%",
        "Int Expert Committee. Diabetes Care 2009. PMID:19502545",
    ),
    "Hemoglobin A1c": ScrapedRange(
        None, 5.7, "%", "", "Int Expert Committee. Diabetes Care 2009. PMID:19502545",
    ),
    "A1C": ScrapedRange(
        None, 5.7, "%", "", "Int Expert Committee. Diabetes Care 2009. PMID:19502545",
    ),
    "Insulin": ScrapedRange(2.0, 25.0, "µIU/mL", "fasting", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "C-Peptide": ScrapedRange(0.8, 3.5, "ng/mL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Iron Studies ────────────────────────────────────────────────────────
    # Source: Killip S et al. Am Fam Physician 2007. PMID:17375513

    "Iron": ScrapedRange(50.0, 170.0, "µg/dL", "sex-specific preferred", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Serum Iron": ScrapedRange(50.0, 170.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "TIBC": ScrapedRange(
        250.0, 370.0, "µg/dL", "",
        "Killip S et al. Am Fam Physician 2007. PMID:17375513",
    ),
    "Total Iron Binding Capacity": ScrapedRange(
        250.0, 370.0, "µg/dL", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513",
    ),
    "Transferrin Saturation": ScrapedRange(20.0, 50.0, "%", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513"),

    # Ferritin — sex-neutral fallback; sex-specific in SEX_RANGES
    "Ferritin": ScrapedRange(
        12.0, 300.0, "ng/mL", "iron depletion <12; sex-specific preferred",
        "Killip S et al. Am Fam Physician 2007. PMID:17375513",
    ),
    "Serum Ferritin": ScrapedRange(
        12.0, 300.0, "ng/mL", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513",
    ),

    # ── Vitamins & Minerals ─────────────────────────────────────────────────
    # Source: Holick MF et al. JCEM 2011. PMID:21646368; Stabler SP. NEJM 2013. PMID:23301732

    "Vitamin D": ScrapedRange(
        20.0, 80.0, "ng/mL",
        "deficient <20; insufficient 20–29; sufficient 30–100; toxicity >100",
        "Holick MF et al. JCEM 2011. PMID:21646368",
    ),
    "25-OH Vitamin D": ScrapedRange(
        20.0, 80.0, "ng/mL", "", "Holick MF et al. JCEM 2011. PMID:21646368",
    ),
    "Vitamin B12": ScrapedRange(
        200.0, 900.0, "pg/mL", "borderline 200–300; deficient <200",
        "Stabler SP. NEJM 2013. PMID:23301732",
    ),
    "B12": ScrapedRange(200.0, 900.0, "pg/mL", "", "Stabler SP. NEJM 2013. PMID:23301732"),
    "Folate": ScrapedRange(
        3.0, 17.0, "ng/mL", "",
        "Shane B. Am J Clin Nutr 2011. PMID:21593491",
    ),
    "Folic Acid": ScrapedRange(3.0, 17.0, "ng/mL", "", "Shane B. Am J Clin Nutr 2011. PMID:21593491"),
    "Magnesium": ScrapedRange(1.6, 2.3, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Phosphorus": ScrapedRange(2.5, 4.5, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Zinc": ScrapedRange(60.0, 130.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Cardiac Biomarkers ──────────────────────────────────────────────────
    # Source: Thygesen K et al. JACC 2018. PMID:30153967 (4th Universal Definition of MI)

    "Troponin I": ScrapedRange(
        None, 0.04, "ng/mL", "99th percentile URL — acute MI threshold",
        "Thygesen K et al. JACC 2018. PMID:30153967",
    ),
    "Troponin T": ScrapedRange(
        None, 0.01, "ng/mL", "99th percentile URL",
        "Thygesen K et al. JACC 2018. PMID:30153967",
    ),
    "Troponin": ScrapedRange(
        None, 0.04, "ng/mL", "99th percentile URL",
        "Thygesen K et al. JACC 2018. PMID:30153967",
    ),
    "BNP": ScrapedRange(
        None, 100.0, "pg/mL", "HF unlikely <100",
        "Maisel AS et al. NEJM 2002. PMID:12124404",
    ),
    "NT-proBNP": ScrapedRange(None, 125.0, "pg/mL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "CK": ScrapedRange(22.0, 198.0, "U/L", "sex-specific preferred", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Creatine Kinase": ScrapedRange(22.0, 198.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "CK-MB": ScrapedRange(None, 6.3, "ng/mL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Inflammation ────────────────────────────────────────────────────────
    # Source: Pearson TA et al. Circulation 2003. PMID:12551878

    "CRP": ScrapedRange(None, 10.0, "mg/L", "", "Pearson TA et al. Circulation 2003. PMID:12551878"),
    "C-Reactive Protein": ScrapedRange(None, 10.0, "mg/L", "", "Pearson TA et al. Circulation 2003. PMID:12551878"),
    "hs-CRP": ScrapedRange(
        None, 3.0, "mg/L",
        "low CV risk <1; average 1–3; high >3; acute phase >10",
        "Pearson TA et al. Circulation 2003. PMID:12551878",
    ),
    "High Sensitivity CRP": ScrapedRange(
        None, 3.0, "mg/L", "", "Pearson TA et al. Circulation 2003. PMID:12551878",
    ),
    "ESR": ScrapedRange(
        None, 20.0, "mm/hr", "age/sex-adjusted: M = age÷2; F = (age+10)÷2",
        "Miller A et al. BMJ 1983. PMID:6402065",
    ),
    "Erythrocyte Sedimentation Rate": ScrapedRange(
        None, 20.0, "mm/hr", "", "Miller A et al. BMJ 1983. PMID:6402065",
    ),

    # ── Coagulation ─────────────────────────────────────────────────────────
    # Source: Hirsh J et al. Circulation 2003. PMID:12668507

    "INR": ScrapedRange(
        0.9, 1.1, "", "therapeutic AF/DVT: 2.0–3.0; mechanical valves: 2.5–3.5",
        "Hirsh J et al. Circulation 2003. PMID:12668507",
    ),
    "PT": ScrapedRange(11.0, 13.5, "seconds", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Prothrombin Time": ScrapedRange(11.0, 13.5, "seconds", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "aPTT": ScrapedRange(25.0, 35.0, "seconds", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Fibrinogen": ScrapedRange(200.0, 400.0, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Kidney ──────────────────────────────────────────────────────────────

    "Uric Acid": ScrapedRange(
        3.4, 7.0, "mg/dL", "hyperuricaemia >7.0 M / >6.0 F; gout threshold 6.8",
        "Zhu Y et al. Arthritis Rheum 2011. PMID:21800283",
    ),
    "Urea": ScrapedRange(7.0, 20.0, "mg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Cystatin C": ScrapedRange(0.53, 0.95, "mg/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Hormones ────────────────────────────────────────────────────────────

    "Cortisol": ScrapedRange(
        6.2, 19.4, "µg/dL", "morning draw (8:00 AM)",
        "Bornstein SR et al. JCEM 2016. PMID:26760044",
    ),
    "DHEA-S": ScrapedRange(35.0, 430.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # Testosterone — sex-neutral fallback; sex-specific in SEX_RANGES
    "Testosterone": ScrapedRange(
        270.0, 1070.0, "ng/dL", "male default; female range 15–70 ng/dL",
        "Bhasin S et al. JCEM 2018. PMID:29562364",
    ),
    "Total Testosterone": ScrapedRange(
        270.0, 1070.0, "ng/dL", "", "Bhasin S et al. JCEM 2018. PMID:29562364",
    ),
    "Free Testosterone": ScrapedRange(9.0, 30.0, "pg/mL", "", "Bhasin S et al. JCEM 2018. PMID:29562364"),
    "Estradiol": ScrapedRange(15.0, 350.0, "pg/mL", "follicular phase; cycle-dependent", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Progesterone": ScrapedRange(0.1, 0.9, "ng/mL", "follicular phase", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "LH": ScrapedRange(1.5, 9.3, "IU/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "FSH": ScrapedRange(1.5, 12.4, "IU/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Prolactin": ScrapedRange(2.0, 29.0, "ng/mL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "IGF-1": ScrapedRange(88.0, 246.0, "ng/mL", "adult 20–65 y", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Urinalysis ──────────────────────────────────────────────────────────

    "Protein (urine)": ScrapedRange(None, 150.0, "mg/day", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Microalbumin": ScrapedRange(None, 30.0, "mg/g", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "Urine Creatinine": ScrapedRange(500.0, 2000.0, "mg/day", "", "Kratz A et al. NEJM 2004. PMID:15470219"),

    # ── Cancer Markers ──────────────────────────────────────────────────────

    "PSA": ScrapedRange(
        None, 4.0, "ng/mL", "age-adjusted: <50=2.5, 50–59=3.5, 60–69=4.5, ≥70=6.5",
        "Oesterling JE et al. JAMA 1993. PMID:8340982",
    ),
    "CEA": ScrapedRange(
        None, 3.0, "ng/mL", "smoker upper limit 5.0 ng/mL",
        "Goldenberg DM et al. J Cancer Res Clin Oncol 1981. PMID:6270396",
    ),
    "CA-125": ScrapedRange(
        None, 35.0, "U/mL", "",
        "Bast RC Jr et al. Int J Biol Markers 1998. PMID:10091293",
    ),
    "CA 19-9": ScrapedRange(None, 37.0, "U/mL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    "AFP": ScrapedRange(None, 8.3, "ng/mL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
}

# ---------------------------------------------------------------------------
# Sex-specific overrides
# ---------------------------------------------------------------------------

SEX_RANGES: dict[str, dict[str, ScrapedRange]] = {
    "RBC": {
        "male":   ScrapedRange(4.5, 5.9, "M/µL", "", "Beutler E. Blood 2006. PMID:16189263"),
        "female": ScrapedRange(4.0, 5.2, "M/µL", "", "Beutler E. Blood 2006. PMID:16189263"),
    },
    "Red Blood Cell Count": {
        "male":   ScrapedRange(4.5, 5.9, "M/µL", "", "Beutler E. Blood 2006. PMID:16189263"),
        "female": ScrapedRange(4.0, 5.2, "M/µL", "", "Beutler E. Blood 2006. PMID:16189263"),
    },
    "Hemoglobin": {
        "male":   ScrapedRange(13.5, 17.5, "g/dL", "", "WHO NMH/NHD/MNM/11.1 2011"),
        "female": ScrapedRange(12.0, 15.5, "g/dL", "", "WHO NMH/NHD/MNM/11.1 2011"),
    },
    "Hgb": {
        "male":   ScrapedRange(13.5, 17.5, "g/dL", "", "WHO NMH/NHD/MNM/11.1 2011"),
        "female": ScrapedRange(12.0, 15.5, "g/dL", "", "WHO NMH/NHD/MNM/11.1 2011"),
    },
    "Hematocrit": {
        "male":   ScrapedRange(41.0, 53.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(36.0, 46.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Hct": {
        "male":   ScrapedRange(41.0, 53.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(36.0, 46.0, "%", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Creatinine": {
        "male":   ScrapedRange(0.74, 1.35, "mg/dL", "IDMS-calibrated", "Levey AS et al. Ann Intern Med 2009. PMID:19414839"),
        "female": ScrapedRange(0.59, 1.04, "mg/dL", "IDMS-calibrated", "Levey AS et al. Ann Intern Med 2009. PMID:19414839"),
    },
    "Serum Creatinine": {
        "male":   ScrapedRange(0.74, 1.35, "mg/dL", "", "Levey AS et al. Ann Intern Med 2009. PMID:19414839"),
        "female": ScrapedRange(0.59, 1.04, "mg/dL", "", "Levey AS et al. Ann Intern Med 2009. PMID:19414839"),
    },
    "ALT": {
        "male":   ScrapedRange(7.0, 56.0, "U/L", "", "Prati D et al. Ann Intern Med 2002. PMID:12097536"),
        "female": ScrapedRange(7.0, 45.0, "U/L", "lower ULN in women", "Prati D et al. Ann Intern Med 2002. PMID:12097536"),
    },
    "Alanine Aminotransferase": {
        "male":   ScrapedRange(7.0, 56.0, "U/L", "", "Prati D et al. Ann Intern Med 2002. PMID:12097536"),
        "female": ScrapedRange(7.0, 45.0, "U/L", "", "Prati D et al. Ann Intern Med 2002. PMID:12097536"),
    },
    "Ferritin": {
        "male":   ScrapedRange(20.0, 500.0, "ng/mL", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513"),
        "female": ScrapedRange(12.0, 150.0, "ng/mL", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513"),
    },
    "Serum Ferritin": {
        "male":   ScrapedRange(20.0, 500.0, "ng/mL", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513"),
        "female": ScrapedRange(12.0, 150.0, "ng/mL", "", "Killip S et al. Am Fam Physician 2007. PMID:17375513"),
    },
    "Iron": {
        "male":   ScrapedRange(60.0, 170.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(50.0, 170.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Serum Iron": {
        "male":   ScrapedRange(60.0, 170.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(50.0, 170.0, "µg/dL", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Uric Acid": {
        "male":   ScrapedRange(3.4, 7.0, "mg/dL", "", "Zhu Y et al. Arthritis Rheum 2011. PMID:21800283"),
        "female": ScrapedRange(2.4, 6.0, "mg/dL", "", "Zhu Y et al. Arthritis Rheum 2011. PMID:21800283"),
    },
    "HDL": {
        "male":   ScrapedRange(40.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
        "female": ScrapedRange(50.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
    },
    "HDL Cholesterol": {
        "male":   ScrapedRange(40.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
        "female": ScrapedRange(50.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
    },
    "HDL-C": {
        "male":   ScrapedRange(40.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
        "female": ScrapedRange(50.0, None, "mg/dL", "", "NCEP ATP III JAMA 2001. PMID:11368702"),
    },
    "GGT": {
        "male":   ScrapedRange(8.0, 61.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(5.0, 36.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Gamma-Glutamyl Transferase": {
        "male":   ScrapedRange(8.0, 61.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(5.0, 36.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Testosterone": {
        "male":   ScrapedRange(270.0, 1070.0, "ng/dL", "hypogonadism <300 ng/dL", "Bhasin S et al. JCEM 2018. PMID:29562364"),
        "female": ScrapedRange(15.0, 70.0, "ng/dL", "", "Bhasin S et al. JCEM 2018. PMID:29562364"),
    },
    "Total Testosterone": {
        "male":   ScrapedRange(270.0, 1070.0, "ng/dL", "", "Bhasin S et al. JCEM 2018. PMID:29562364"),
        "female": ScrapedRange(15.0, 70.0, "ng/dL", "", "Bhasin S et al. JCEM 2018. PMID:29562364"),
    },
    "PSA": {
        "male":   ScrapedRange(None, 4.0, "ng/mL", "age-adjusted preferred", "Oesterling JE et al. JAMA 1993. PMID:8340982"),
        "female": ScrapedRange(None, None, "ng/mL", "not applicable", ""),
    },
    "CK": {
        "male":   ScrapedRange(39.0, 308.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(26.0, 192.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "Creatine Kinase": {
        "male":   ScrapedRange(39.0, 308.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
        "female": ScrapedRange(26.0, 192.0, "U/L", "", "Kratz A et al. NEJM 2004. PMID:15470219"),
    },
    "ESR": {
        "male":   ScrapedRange(None, 15.0, "mm/hr", "fixed fallback; age-adjusted preferred", "Miller A et al. BMJ 1983. PMID:6402065"),
        "female": ScrapedRange(None, 20.0, "mm/hr", "", "Miller A et al. BMJ 1983. PMID:6402065"),
    },
    "Erythrocyte Sedimentation Rate": {
        "male":   ScrapedRange(None, 15.0, "mm/hr", "", "Miller A et al. BMJ 1983. PMID:6402065"),
        "female": ScrapedRange(None, 20.0, "mm/hr", "", "Miller A et al. BMJ 1983. PMID:6402065"),
    },
}
