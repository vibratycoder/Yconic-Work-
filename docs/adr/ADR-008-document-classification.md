# ADR-008: Two-Pass Document Classification Before Lab Extraction

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Pulse engineering team

## Context

Users upload a variety of medical documents to Pulse — lab bloodwork, imaging reports, prescriptions, and clinical notes. The full lab OCR pipeline (ADR-003) is expensive in both token cost and latency; running it against every uploaded document regardless of type would waste resources and produce nonsensical output for non-bloodwork files. Additionally, the UI needs to give meaningful feedback when a user uploads the wrong document type (e.g. an MRI report instead of a bloodwork panel) rather than silently failing or returning empty results. A lightweight classification step before committing to full extraction was needed.

## Decision

Implement a two-pass approach for all document uploads via `POST /api/documents/analyze`. In the first pass, Claude Vision performs a cheap classification call that returns a small JSON object: `{document_type: "bloodwork" | "imaging" | "prescription" | "clinical_notes" | "unknown", confidence: 0.0–1.0, is_bloodwork: bool}`. If `is_bloodwork` is `true`, the pipeline proceeds to the full lab OCR extraction flow described in ADR-003 and returns both the classification and the extracted, rated results along with an `import_summary` string (e.g. `"12 results imported, 3 abnormal (HbA1c, LDL, Vitamin D)"`). If `is_bloodwork` is `false`, the endpoint returns the classification result immediately without invoking the extraction pipeline, allowing the frontend to display a message such as "This looks like an imaging report, not bloodwork."

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Run full lab OCR on every upload and check for empty results | Incurs full extraction token cost even for non-bloodwork documents. Claude would attempt to extract lab values from prescriptions or imaging reports, producing garbage output rather than a clean "wrong document type" signal. |
| Client-side file-type detection (MIME type or filename heuristic) | MIME type and filename tell us the file format (PDF, JPEG), not the medical document category. A PDF could be a prescription, a lab report, or a clinical letter; filename is unreliable. |
| User-provided document type selection in the UI (dropdown before upload) | Adds friction to the upload flow. Users frequently do not know or do not care about the distinction; they just want to upload and get insight. Relying on user selection also introduces mislabeling. |
| Train a dedicated lightweight classification model | Requires labeled training data, model hosting infrastructure, and ongoing maintenance. Claude Vision handles this task well out of the box and is already a project dependency. |
| Use a separate low-cost text model on extracted PDF text for classification | PDFs that are image-based (scanned documents) have no extractable text layer. Claude Vision works uniformly across both text-based and image-based documents. |

## Consequences

### Positive
- Users receive immediate, accurate feedback when they upload a non-bloodwork document, improving UX and reducing confusion.
- Full extraction cost (Claude Vision with structured output parsing) is incurred only when the document is confirmed to be bloodwork, keeping per-upload token spend low for non-bloodwork uploads.
- The `confidence` field in the classification response enables the frontend to handle uncertain cases gracefully (e.g. prompting the user to confirm if confidence is below a threshold).
- The `import_summary` string provides a human-readable confirmation of what was imported, giving users immediate reassurance that their data was captured correctly.
- The two-pass structure is extensible: future document types (e.g. vaccine records, allergy lists) can be routed to dedicated downstream processors without modifying the classification layer.
- Both image and PDF uploads are supported uniformly through the same endpoint.

### Negative / Trade-offs
- Two sequential Claude Vision calls add latency compared to a single combined call; the classification pass must complete before the extraction pass can begin.
- For documents that are clearly bloodwork to a human reader, the classification pass is an unavoidable overhead with no functional benefit.
- The classification prompt relies on Claude's interpretation of "bloodwork" — edge cases such as point-of-care test strips, glucose meter screenshots, or nutrition panel labels may be misclassified and require prompt iteration over time.
- `confidence` is a Claude-provided estimate, not a calibrated probability; downstream logic that branches on confidence thresholds should treat it as a heuristic rather than a statistical guarantee.
- The web bloodwork upload panel has been removed from the UI; the classification result's `is_bloodwork: false` path currently has no dedicated UI treatment on web (only the API response is returned), which limits its utility until a UI owner re-implements the feedback surface.

## Implementation Notes

- **Endpoint**: `POST /api/documents/analyze` — multipart form; accepts both image files (JPEG, PNG, WebP, GIF) and PDFs.
- **Classification model**: Claude Vision (claude-sonnet-4-6), first-pass prompt instructs the model to classify only, using minimal tokens; no lab value extraction occurs in this call.
- **Classification response schema**:
  ```json
  {
    "document_type": "bloodwork" | "imaging" | "prescription" | "clinical_notes" | "unknown",
    "confidence": 0.0–1.0,
    "is_bloodwork": true | false
  }
  ```
- **Routing logic** in `backend/main.py`:
  - `is_bloodwork: true` → call lab OCR extraction pipeline (`backend/intake/lab_ocr.py`), then lab rater (`backend/features/lab_rater.py`), then pattern detection (`backend/features/patterns.py`); compose and return full result with `import_summary`.
  - `is_bloodwork: false` → return classification object immediately; no further LLM calls.
- **`import_summary` generation**: After successful extraction, the pipeline counts total results and enumerates abnormal markers (any result with rating `High` or `Low`), constructing a plain-English string: `"N results imported, M abnormal (marker1, marker2, ...)"`.
- **Classifier**: `backend/intake/document_classifier.py` encapsulates the first-pass Claude Vision call, prompt construction, response parsing, and schema validation.
- **PDF handling**: identical to ADR-003 — pages are converted to images and submitted to the classification call; a document is classified as bloodwork if any page yields `is_bloodwork: true`.
- **Emergency triage**: `check_emergency` is called before the classification Claude Vision call and again before the extraction Claude Vision call, per project non-negotiables.
- **Structured logging**: all classification results, confidence scores, and routing decisions are logged via `utils/logger.py`; no PHI in log message bodies.

## Compliance & Safety

- **Emergency triage gate**: `check_emergency` runs before every LLM call in both passes. If an uploaded document contains visible emergency indicators (e.g. critical lab values in a pre-annotated report), the triage gate must fire before any further processing.
- **PHI handling**: uploaded files are not persisted to disk or object storage beyond the request lifecycle. Only the structured extracted results (for bloodwork documents) are written to Supabase with RLS policies scoped to `user_id`. The classification result for non-bloodwork documents is returned to the caller and not stored.
- **No diagnostic claims**: classifying a document as "imaging" or "prescription" is informational routing logic, not a medical assessment. The `document_type` field must not be surfaced to users as a clinical determination.
- **Misclassification handling**: a misclassified bloodwork document (returned as `is_bloodwork: false`) means data is not imported. Users should be informed they can retry or contact support; the `confidence` field can be used to trigger a lower-confidence warning in the UI.
- **Audit trail**: each `POST /api/documents/analyze` request is assigned a request ID; both the classification pass result and the extraction pass result (when applicable) are logged with the request ID to enable end-to-end tracing without logging raw document contents.
