# ADR-003: Lab OCR and Personalized Analysis Pipeline

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Sana Health engineering team

## Context

Users need to upload lab result documents (images or PDFs) and receive meaningful, personalized interpretation of their bloodwork. Raw lab printouts contain machine-reference ranges that do not account for individual factors such as age, sex, or BMI — meaning a result flagged as "normal" by the lab may still warrant attention for a specific patient profile. A pipeline was needed that could (1) reliably extract structured data from visually varied lab documents, (2) re-rate results against personalized reference ranges, and (3) detect clinically significant patterns across multiple markers simultaneously.

## Decision

Use Claude Vision (claude-sonnet-4-6) to extract structured lab results from uploaded images and PDFs via the `POST /api/labs/scan` endpoint. Claude is prompted to return a JSON array of result objects with fields `test_name`, `value`, `unit`, `reference_range_low`, `reference_range_high`, and `status` (`high` / `low` / `normal` / `critical`). Extracted results are then passed through `features/lab_rater.py`, which applies personalized reference range adjustments from `features/lab_reference_ranges.py` based on user age, sex, and BMI. A second layer in `features/patterns.py` runs cross-marker pattern detection to identify clinically meaningful clusters (e.g. metabolic syndrome, cardiovascular risk). Final results, including personalized ratings and deviation percentages, are persisted to the Supabase `lab_results` table.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Dedicated OCR library (Tesseract, AWS Textract) | Lab documents vary enormously in layout; general-purpose OCR produces raw text that still requires a separate parsing and structuring step, adding latency and fragility. Claude Vision handles layout understanding and semantic extraction in one pass. |
| Rule-based regex extraction after OCR | Lab formats from different providers have no standard layout. Regex rules require per-provider maintenance and break on novel formats, making the approach unscalable. |
| Outsource to a specialist lab-data API (e.g. Human API, Particle Health) | Adds an external dependency, introduces patient data sharing with a third party, increases cost per scan, and does not cover documents users already have in hand. |
| Static (non-personalized) reference ranges only | Standard reference ranges are population-level averages. Ignoring age, sex, and BMI produces ratings that are less clinically meaningful and reduces the value proposition of the product. |
| Store raw extracted text instead of structured JSON | Downstream features (pattern detection, trend tracking, export) all require structured data. Persisting raw text would push parsing complexity into every consumer. |

## Consequences

### Positive
- Single-model extraction handles diverse lab layouts without per-provider rules or maintenance.
- Personalized ratings surface clinically relevant anomalies that lab-printed ranges would miss (e.g. hemoglobin thresholds differ by sex; eGFR interpretation differs by age).
- Cross-marker pattern detection (metabolic syndrome cluster, kidney concern, cardiovascular risk, thyroid dysfunction) adds insight beyond individual result flags.
- PDF support via page-by-page image conversion means users are not limited to photographed results.
- Deviation percentage (`deviation_pct`) provides a continuous signal for trending over time rather than just a categorical flag.
- Results are fully structured on ingest, making all downstream features straightforward to implement.

### Negative / Trade-offs
- Claude Vision calls have per-token cost; high-volume usage will accumulate meaningful API spend.
- Extraction accuracy depends on image quality; blurry, low-contrast, or skewed photos may yield incomplete or incorrect values, which the pipeline cannot currently detect automatically.
- Personalized range adjustments are only as accurate as the reference data encoded in `lab_reference_ranges.py`; ranges must be kept current with clinical guidelines.
- PDF-to-image conversion adds latency proportional to page count; multi-page lab reports will be slower to process.
- The structured JSON schema expected from Claude is enforced by prompt instruction rather than a grammar constraint, so occasional schema violations must be handled defensively in the parser.
- No human-in-the-loop review step means extraction errors go directly to the user; confidence scoring is not yet implemented.

## Implementation Notes

- **Endpoint**: `POST /api/labs/scan` — multipart form with fields `image` (file) and `user_id` (string).
- **Accepted formats**: JPEG, PNG, WebP, GIF, PDF.
- **PDF handling**: `backend/intake/lab_ocr.py` converts each PDF page to an image and submits pages sequentially to Claude Vision, merging extracted arrays.
- **Extraction prompt**: instructs Claude to return a JSON array; each element must include `test_name`, `value`, `unit`, `reference_range_low`, `reference_range_high`, `status`.
- **Personalization logic**: `backend/features/lab_rater.py` — loads user profile (age, sex, BMI) from Supabase, selects the appropriate row from `lab_reference_ranges.py`, computes `personalized_range_low`, `personalized_range_high`, re-rates to `High` / `Normal` / `Low`, and computes `deviation_pct` as the percentage by which the value exceeds the nearest personalized boundary.
- **Reference ranges**: `backend/features/lab_reference_ranges.py` — covers CBC (RBC, WBC, hemoglobin, hematocrit, platelets), CMP (glucose, BUN, creatinine, eGFR, electrolytes, liver enzymes), lipid panel (total cholesterol, LDL, HDL, triglycerides), thyroid (TSH, Free T4), and HbA1c.
- **Pattern detection**: `backend/features/patterns.py` — receives the full list of `RatedLabResult` objects for a scan and checks for named clusters:
  - *Metabolic syndrome*: elevated fasting glucose + triglycerides + low HDL
  - *Kidney concern*: low eGFR + elevated creatinine
  - *Cardiovascular risk*: elevated LDL + total cholesterol with low HDL
  - *Thyroid dysfunction*: abnormal TSH with abnormal Free T4
- **Persistence**: rated results and detected patterns written to Supabase `lab_results` table with `user_id`, `scan_id`, `created_at`, and per-result fields.
- **Emergency triage**: `check_emergency` is called before any LLM invocation per project non-negotiables; critical values (e.g. severely abnormal potassium, glucose) that trigger emergency conditions short-circuit the pipeline and return an emergency response.

## Compliance & Safety

- **Emergency triage gate**: `check_emergency` runs before every Claude Vision call. A result set containing a critical marker (e.g. potassium < 2.5 mEq/L, glucose > 500 mg/dL) that matches an emergency pattern must surface an emergency referral string before any further processing.
- **PHI handling**: Lab images and extracted values constitute Protected Health Information. Images are not stored persistently; only the structured result records are written to Supabase. Supabase Row Level Security (RLS) policies restrict result access to the owning `user_id`.
- **No diagnostic claims**: Personalized ratings and pattern detections are informational context, not diagnoses. All user-facing copy must include a disclaimer that results should be reviewed with a qualified clinician.
- **Accuracy transparency**: The UI should communicate that OCR extraction may be imperfect, particularly for low-quality images, and encourage users to verify critical values against their original documents.
- **Audit trail**: Each scan is assigned a `scan_id` and timestamped; the raw Claude response is logged (without PHI in log bodies) via `utils/logger.py` to support debugging without exposing patient data in log aggregators.
