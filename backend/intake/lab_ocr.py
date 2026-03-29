"""Lab result extraction from images using Claude Vision."""
from __future__ import annotations
import base64
import json
import re
from datetime import date
import anthropic
from backend.models.health_profile import LabResult, LabStatus, LabSource
from backend.utils.logger import get_logger

log = get_logger(__name__)

LAB_OCR_SYSTEM = """You are a medical data extraction specialist. Extract lab results from this lab report image.

Return ONLY a JSON object with this exact structure:
{
  "lab_date": "YYYY-MM-DD or null",
  "lab_name": "name of lab/facility or null",
  "results": [
    {
      "test_name": "exact test name",
      "value": numeric_value_or_null,
      "value_text": "text_value_or_null",
      "unit": "unit_string_or_null",
      "reference_range_low": numeric_or_null,
      "reference_range_high": numeric_or_null,
      "status": "normal|high|low|critical|unknown",
      "date_collected": "YYYY-MM-DD or null"
    }
  ]
}

Rules:
- Extract ALL lab values visible in the image
- Use "high"/"low"/"critical" based on the H/L/CRITICAL flags shown
- If no flag shown and value is within range, use "normal"
- If range unknown, use "unknown"
- Return ONLY valid JSON — no markdown, no explanation"""


async def extract_lab_results_from_image(
    image_bytes: bytes,
    media_type: str,
) -> list[LabResult]:
    """
    Extract structured lab results from a lab report image using Claude Vision.

    Sends the image to Claude with a structured extraction prompt and parses
    the JSON response into LabResult objects.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.)
        media_type: MIME type string (e.g. 'image/jpeg', 'image/png')

    Returns:
        List of LabResult objects extracted from the image.
        Returns empty list on parse failure or if no results found.

    Raises:
        anthropic.APIError: On Anthropic API failure.
    """
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    client = anthropic.AsyncAnthropic()

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=LAB_OCR_SYSTEM,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_b64,
                    },
                },
                {
                    "type": "text",
                    "text": "Extract all lab results from this image.",
                },
            ],
        }],
    )

    raw = response.content[0].text.strip()
    clean = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as exc:
        log.warning("lab_ocr_json_failed", error=str(exc), raw=raw[:200])
        return []

    results: list[LabResult] = []
    for item in parsed.get("results", []):
        test_name = item.get("test_name")
        if not test_name:
            continue
        try:
            date_str = item.get("date_collected")
            collected: date | None = None
            if date_str:
                try:
                    collected = date.fromisoformat(date_str)
                except ValueError:
                    pass

            status_raw = item.get("status", "unknown").lower()
            try:
                status = LabStatus(status_raw)
            except ValueError:
                status = LabStatus.UNKNOWN

            results.append(LabResult(
                test_name=test_name,
                value=item.get("value"),
                value_text=item.get("value_text"),
                unit=item.get("unit"),
                reference_range_low=item.get("reference_range_low"),
                reference_range_high=item.get("reference_range_high"),
                status=status,
                date_collected=collected,
                lab_source=LabSource.PHOTO_OCR,
            ))
        except (KeyError, ValueError, TypeError) as exc:
            log.warning("lab_ocr_result_parse_failed", test_name=test_name, error=str(exc))
            continue

    log.info("lab_ocr_complete", results_count=len(results))
    return results
