"""Shared parsing utilities used across the Pulse backend.

Centralising these prevents copy-paste divergence and makes error
handling consistent everywhere dates or JSON strings appear.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime

from backend.utils.logger import get_logger

log = get_logger(__name__)


def parse_iso_date(value: str | None) -> date | None:
    """
    Parse an ISO 8601 date or datetime string into a ``date`` object.

    Handles the common variants returned by Supabase and academic APIs:
    ``"2024-03-15"``, ``"2024-03-15T00:00:00Z"``, ``"2024-03-15T00:00:00+00:00"``.

    Args:
        value: ISO 8601 string to parse, or ``None``.

    Returns:
        Parsed ``date`` on success, ``None`` if ``value`` is falsy or unparsable.
    """
    if not value:
        return None
    try:
        # Strip timezone suffix so fromisoformat works on Python < 3.11
        clean = re.sub(r"[TZ ].*$", "", value.strip())
        return date.fromisoformat(clean)
    except (ValueError, AttributeError):
        log.debug("parse_iso_date_failed", value=value)
        return None


def extract_json(text: str) -> dict | list:
    """
    Extract the first valid JSON object or array from a string.

    Useful for parsing Claude responses that may include surrounding
    prose before or after the JSON payload.

    Args:
        text: Raw string that contains embedded JSON.

    Returns:
        Parsed ``dict`` or ``list``.

    Raises:
        ValueError: If no valid JSON is found in ``text``.
    """
    # Try the whole string first (fast path)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Locate the first ``{`` or ``[`` and attempt extraction
    for start_char, end_char in (("{", "}"), ("[", "]")):
        start = text.find(start_char)
        if start == -1:
            continue
        end = text.rfind(end_char)
        if end == -1 or end <= start:
            continue
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            continue

    raise ValueError(f"No valid JSON found in text: {text[:120]!r}")
