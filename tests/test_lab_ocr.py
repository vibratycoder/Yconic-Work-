"""Tests for lab OCR result parsing."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.intake.lab_ocr import extract_lab_results_from_image
from backend.models.health_profile import LabStatus, LabSource


class TestLabOCRParsing:
    """Test lab OCR result extraction."""

    @pytest.mark.asyncio
    async def test_valid_json_response_parsed(self) -> None:
        """Valid Claude Vision JSON must be parsed into LabResult objects."""
        mock_json = '''{
            "lab_date": "2024-01-15",
            "lab_name": "Quest Diagnostics",
            "results": [
                {
                    "test_name": "LDL Cholesterol",
                    "value": 158.0,
                    "value_text": null,
                    "unit": "mg/dL",
                    "reference_range_low": null,
                    "reference_range_high": 100.0,
                    "status": "high",
                    "date_collected": null
                }
            ]
        }'''
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=mock_json)]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch("backend.intake.lab_ocr.anthropic.AsyncAnthropic", return_value=mock_client):
            results = await extract_lab_results_from_image(b"fake_image", "image/jpeg")

        assert len(results) == 1
        assert results[0].test_name == "LDL Cholesterol"
        assert results[0].value == 158.0
        assert results[0].status == LabStatus.HIGH
        assert results[0].lab_source == LabSource.PHOTO_OCR

    @pytest.mark.asyncio
    async def test_invalid_json_returns_empty_list(self) -> None:
        """Invalid JSON from Claude must return empty list gracefully."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="not valid json at all")]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch("backend.intake.lab_ocr.anthropic.AsyncAnthropic", return_value=mock_client):
            results = await extract_lab_results_from_image(b"fake_image", "image/jpeg")

        assert results == []

    @pytest.mark.asyncio
    async def test_missing_test_name_skipped(self) -> None:
        """Results missing required test_name must be skipped."""
        mock_json = '''{"lab_date": null, "lab_name": null, "results": [{"value": 5.0}]}'''
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=mock_json)]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch("backend.intake.lab_ocr.anthropic.AsyncAnthropic", return_value=mock_client):
            results = await extract_lab_results_from_image(b"fake_image", "image/jpeg")

        assert results == []
