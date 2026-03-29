# Document Intake & Classification

Determines what type of medical document a user has uploaded before deciding whether to route it to lab extraction.

## Entry point

Called internally by `POST /api/documents/analyze` before any extraction is attempted.

**File:** `backend/intake/document_classifier.py`

## Classification flow

```
Uploaded file (bytes + MIME type + filename)
         │
         ├── Fast path: keyword scan on filename
         │   (hemoglobin, hba1c, cbc, ldl, etc.)
         │
         ▼
Supported MIME? (jpeg, png, webp, gif, pdf)
         │
         ├── No → filename heuristic only, confidence 0.5
         │
         └── Yes
                  │
                  ▼
         Claude Vision (claude-sonnet-4-6)
           System: document classifier prompt
           Content: base64 image or PDF document block
                  │
                  ▼
         Parse JSON response:
         {
           "document_type": "bloodwork|imaging|prescription|clinical_notes|other",
           "is_bloodwork": true|false,
           "confidence": 0.0–1.0,
           "detected_panels": ["CBC", "Lipid Panel", ...]
         }
```

## Document types

| Type | Description |
|------|-------------|
| `bloodwork` | Lab report with blood test results |
| `imaging` | Radiology, X-ray, MRI, CT, ultrasound reports |
| `prescription` | Medication prescriptions or pharmacy documents |
| `clinical_notes` | Doctor visit notes, discharge summaries, referrals |
| `other` | Anything else |

## Bloodwork keyword list

Used for the fast filename pre-check. Includes: `hemoglobin`, `hematocrit`, `wbc`, `rbc`, `platelets`, `glucose`, `creatinine`, `ldl`, `hdl`, `cholesterol`, `hba1c`, `tsh`, `cbc`, `cmp`, `lipid panel`, `reference range`, `mg/dl`, `mmol/l`, and ~30 more.

## Failure handling

If Claude returns invalid JSON, the classifier logs a warning and falls back to:
```python
DocumentClassification(
    document_type=DocumentType.OTHER,
    is_bloodwork=False,
    confidence=0.0,
    detected_panels=[],
)
```
This prevents crashes — the user sees a "not recognised as bloodwork" message rather than a 500.

## Output

```python
class DocumentClassification(BaseModel):
    document_type: DocumentType
    is_bloodwork: bool
    confidence: float          # 0.0–1.0
    detected_panels: list[str] # e.g. ["CBC", "Lipid Panel"]
```

If `is_bloodwork` is `True`, the caller (`/api/documents/analyze`) proceeds to OCR extraction. If `False`, it returns the classification to the frontend with no extraction.

## Files

| File | Role |
|------|------|
| `backend/intake/document_classifier.py` | `classify_document()` |
| `backend/main.py` | `POST /api/documents/analyze` route |
| `web/app/bloodwork/page.tsx` | Displays classification result to user |
