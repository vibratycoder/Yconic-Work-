"""Document type classification using Claude Vision."""
from __future__ import annotations

import base64
import json
from enum import Enum

import anthropic
from pydantic import BaseModel

from backend.utils.constants import CLAUDE_SONNET
from backend.utils.logger import get_logger

log = get_logger(__name__)

BLOODWORK_KEYWORDS = {
    "hemoglobin", "hematocrit", "wbc", "rbc", "platelets", "glucose", "creatinine",
    "bun", "sodium", "potassium", "cholesterol", "ldl", "hdl", "triglycerides",
    "tsh", "hba1c", "alt", "ast", "alkaline phosphatase", "albumin", "bilirubin",
    "cbc", "cmp", "complete blood count", "metabolic panel", "lipid panel",
    "blood test", "lab results", "laboratory", "serum", "plasma", "specimen",
    "reference range", "normal range", "units", "mg/dl", "mmol/l", "g/dl",
    "k/ul", "mcg/dl", "iu/l", "miu/l", "ferritin", "iron", "b12", "vitamin d",
    "uric acid", "troponin", "crp", "c-reactive protein", "inr", "psa", "egfr",
}

CLASSIFY_SYSTEM = """You are a medical document classifier. Analyse the document and determine what type it is.

Return ONLY a JSON object with this exact structure:
{
  "document_type": "bloodwork|imaging|prescription|clinical_notes|other",
  "is_bloodwork": true|false,
  "confidence": 0.0-1.0,
  "detected_panels": ["panel name 1", "panel name 2"]
}

Classification rules:
- "bloodwork": Any lab report containing blood test results (CBC, CMP, lipid panel, HbA1c, etc.)
- "imaging": Radiology, X-ray, MRI, CT, ultrasound reports
- "prescription": Medication prescriptions or pharmacy documents
- "clinical_notes": Doctor visit notes, discharge summaries, referral letters
- "other": Anything else

Return ONLY valid JSON — no markdown, no explanation."""


class DocumentType(str, Enum):
    """Supported document categories."""

    BLOODWORK = "bloodwork"
    IMAGING = "imaging"
    PRESCRIPTION = "prescription"
    CLINICAL_NOTES = "clinical_notes"
    OTHER = "other"


class DocumentClassification(BaseModel):
    """
    Result of classifying an uploaded document.

    Attributes:
        document_type: Broad category of the document.
        is_bloodwork: True if the document contains blood lab results.
        confidence: Model confidence score between 0 and 1.
        detected_panels: Named lab panels identified (e.g. 'CBC', 'Lipid Panel').
    """

    document_type: DocumentType
    is_bloodwork: bool
    confidence: float
    detected_panels: list[str]


def _keyword_precheck(text_hint: str) -> bool:
    """
    Fast keyword scan on filename / MIME hint before calling the LLM.

    Args:
        text_hint: Filename or other text metadata about the file.

    Returns:
        True if bloodwork keywords are found in the hint.
    """
    lowered = text_hint.lower()
    return any(kw in lowered for kw in BLOODWORK_KEYWORDS)


async def classify_document(
    file_bytes: bytes,
    media_type: str,
    filename: str = "",
) -> DocumentClassification:
    """
    Classify an uploaded document to determine if it is bloodwork.

    Uses Claude Vision for image/PDF documents.  For MIME types not
    supported by the vision API, falls back to a keyword check on the
    filename.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        media_type: MIME type (e.g. 'image/jpeg', 'application/pdf').
        filename: Original filename — used as a cheap keyword pre-check.

    Returns:
        DocumentClassification with document_type, is_bloodwork, confidence,
        and a list of detected panel names.

    Raises:
        anthropic.APIError: On Anthropic API failure.
    """
    # Keyword pre-check on filename for a fast path
    if _keyword_precheck(filename):
        log.info("document_classifier_keyword_hit", filename=filename)

    supported_vision = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
    if media_type not in supported_vision:
        # Cannot vision-classify — use filename heuristic only
        is_bw = _keyword_precheck(filename)
        log.info("document_classifier_fallback", filename=filename, is_bloodwork=is_bw)
        return DocumentClassification(
            document_type=DocumentType.BLOODWORK if is_bw else DocumentType.OTHER,
            is_bloodwork=is_bw,
            confidence=0.5,
            detected_panels=[],
        )

    file_b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    client = anthropic.AsyncAnthropic()

    content: list[dict] = []
    if media_type == "application/pdf":
        content.append({
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": file_b64},
        })
    else:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": file_b64},
        })
    content.append({"type": "text", "text": "Classify this document."})

    response = await client.messages.create(
        model=CLAUDE_SONNET,
        max_tokens=256,
        system=CLASSIFY_SYSTEM,
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text.strip()

    try:
        from backend.utils.parsing import extract_json
        parsed = extract_json(raw)
    except json.JSONDecodeError as exc:
        log.warning("document_classifier_json_failed", error=str(exc), raw=raw[:200])
        # Degrade gracefully — assume not bloodwork
        return DocumentClassification(
            document_type=DocumentType.OTHER,
            is_bloodwork=False,
            confidence=0.0,
            detected_panels=[],
        )

    raw_type = parsed.get("document_type", "other").lower()
    try:
        doc_type = DocumentType(raw_type)
    except ValueError:
        doc_type = DocumentType.OTHER

    result = DocumentClassification(
        document_type=doc_type,
        is_bloodwork=bool(parsed.get("is_bloodwork", False)),
        confidence=float(parsed.get("confidence", 0.5)),
        detected_panels=parsed.get("detected_panels", []),
    )
    log.info(
        "document_classified",
        filename=filename,
        document_type=result.document_type,
        is_bloodwork=result.is_bloodwork,
        confidence=result.confidence,
        panels=result.detected_panels,
    )
    return result
