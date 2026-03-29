# Lab Analysis

Two intake paths for bloodwork — camera scan and document upload — converging on the same extraction and rating pipeline.

## Entry points

| Endpoint | Source | Input |
|----------|--------|-------|
| `POST /api/labs/scan` | Web upload | `user_id` (form) + `file` (image) |
| `POST /api/documents/analyze` | Web upload | `user_id` (form) + `file` (image or PDF) |

## Path 1 — Camera scan (`/api/labs/scan`)

**Files:** `backend/intake/lab_ocr.py`, `backend/main.py`

```
User photographs lab report
         │
         ▼
Claude Vision (claude-sonnet-4-6)
  System: "Extract lab results as JSON array"
  Content: base64 image
         │
         ▼
Parse JSON → list[LabResult]
         │
         ▼
Rate each result (demographic-adjusted ranges)
         │
         ▼
Save to lab_results table
         │
         ▼
Return rated results + import summary
```

Claude extracts each row from the lab report as:
```json
{
  "test_name": "LDL Cholesterol",
  "value": 118.0,
  "unit": "mg/dL",
  "reference_range_low": 0,
  "reference_range_high": 100,
  "status": "high"
}
```

## Path 2 — Document upload (`/api/documents/analyze`)

**Files:** `backend/intake/document_classifier.py`, `backend/intake/lab_ocr.py`, `backend/main.py`

```
User uploads file (image or PDF)
         │
         ▼
classify_document()    ← Claude Vision classifies type
         │
         ├── is_bloodwork: false → return classification only (no extraction)
         │
         └── is_bloodwork: true
                  │
                  ▼
         extract_lab_results_from_image() or _from_pdf()
                  │
                  ▼
         Rate each result
                  │
                  ▼
         Save to lab_results table
                  │
                  ▼
         Return DocumentAnalysisResult with rated_results
```

See [document-intake.md](document-intake.md) for classification details.

## Lab rating

**File:** `backend/features/lab_rater.py`

Each extracted `LabResult` is re-rated using **personalized reference ranges** — adjusted for the user's age, sex, weight, and height. This replaces the generic population ranges printed on the lab report.

```python
rate_lab_results(
    results: list[LabResult],
    profile: HealthProfile,
) -> list[RatedLabResult]
```

Each `RatedLabResult` carries:
- `rating`: `"High"` / `"Normal"` / `"Low"` / `"Unknown"`
- `personalized_range_low` / `personalized_range_high`
- `deviation_pct`: % outside normal range (positive = high, negative = low)
- `range_note`: explanation of the adjustment (e.g. "adjusted for age 65+")

Reference ranges are defined per-test in `backend/features/lab_reference_ranges.py`.

## Supabase storage

**Table:** `lab_results`

| Column | Type |
|--------|------|
| `user_id` | uuid |
| `test_name` | text |
| `value`, `value_text` | float / text |
| `unit` | text |
| `reference_range_low/high` | float |
| `status` | enum: normal/low/high/critical/unknown |
| `date_collected` | date |
| `lab_source` | enum: photo_ocr/pdf/manual/healthkit |

## UI

- **Web:** `web/app/bloodwork/page.tsx` — drag-and-drop upload, results grid with High/Normal/Low badges, Table/Chart toggle

## Files

| File | Role |
|------|------|
| `backend/intake/lab_ocr.py` | Claude Vision extraction for images and PDFs |
| `backend/intake/document_classifier.py` | Document type detection |
| `backend/features/lab_rater.py` | Personalized range rating |
| `backend/features/lab_reference_ranges.py` | Reference range definitions |
| `backend/main.py` | Route handlers |
| `web/app/bloodwork/page.tsx` | Web upload UI |
