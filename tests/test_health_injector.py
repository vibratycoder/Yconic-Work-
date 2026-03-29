"""Tests for health profile injection into system prompts."""
from __future__ import annotations
import pytest
from datetime import date
from backend.health.injector import build_health_system_prompt, check_emergency
from backend.evidence.pubmed import Citation
from backend.models.health_profile import (
    HealthProfile, Medication, LabResult, LabStatus, LabSource, WearableSummary
)


def _make_profile(**kwargs) -> HealthProfile:
    """Create a test HealthProfile with sensible defaults."""
    defaults: dict = {
        "user_id": "test-user-123",
        "display_name": "Test User",
        "age": 45,
        "sex": "female",
        "primary_conditions": ["hypertension"],
        "current_medications": [
            Medication(name="Lisinopril", dose="10mg", frequency="daily")
        ],
        "allergies": ["penicillin"],
    }
    defaults.update(kwargs)
    return HealthProfile(**defaults)


def _make_citation() -> Citation:
    """Create a test Citation."""
    return Citation(
        pmid="12345678",
        title="Hypertension management in primary care",
        journal="JAMA",
        year="2023",
        abstract="Blood pressure control reduces cardiovascular events.",
        authors="Smith et al.",
    )


class TestHealthProfileInjection:
    """Test suite for build_health_system_prompt."""

    def test_system_prompt_contains_conditions(self) -> None:
        """Profile conditions must appear in system prompt."""
        profile = _make_profile(primary_conditions=["hypertension", "prediabetes"])
        prompt = build_health_system_prompt(profile, [])
        assert "hypertension" in prompt
        assert "prediabetes" in prompt

    def test_system_prompt_contains_medications(self) -> None:
        """Medications must appear in system prompt."""
        profile = _make_profile()
        prompt = build_health_system_prompt(profile, [])
        assert "Lisinopril" in prompt

    def test_system_prompt_contains_allergies(self) -> None:
        """Allergies must appear in system prompt."""
        profile = _make_profile(allergies=["penicillin", "sulfa"])
        prompt = build_health_system_prompt(profile, [])
        assert "penicillin" in prompt

    def test_system_prompt_contains_citations(self) -> None:
        """PubMed citations must be injected into system prompt."""
        profile = _make_profile()
        citation = _make_citation()
        prompt = build_health_system_prompt(profile, [citation])
        assert "12345678" in prompt
        assert "Hypertension" in prompt

    def test_system_prompt_no_citations_fallback(self) -> None:
        """Prompt must include fallback text when no citations available."""
        profile = _make_profile()
        prompt = build_health_system_prompt(profile, [])
        assert "No studies retrieved" in prompt

    def test_system_prompt_contains_emergency_rule(self) -> None:
        """Emergency escalation rule must be in every system prompt."""
        profile = _make_profile()
        prompt = build_health_system_prompt(profile, [])
        assert "911" in prompt or "emergency" in prompt.lower()

    def test_system_prompt_contains_user_demographics(self) -> None:
        """Age and sex must appear in system prompt."""
        profile = _make_profile(age=42, sex="male")
        prompt = build_health_system_prompt(profile, [])
        assert "42" in prompt
        assert "male" in prompt

    def test_abnormal_labs_in_prompt(self) -> None:
        """Abnormal lab results must be highlighted in prompt."""
        lab = LabResult(
            test_name="LDL Cholesterol",
            value=158.0,
            unit="mg/dL",
            status=LabStatus.HIGH,
            lab_source=LabSource.MANUAL,
        )
        profile = _make_profile(recent_labs=[lab])
        prompt = build_health_system_prompt(profile, [])
        assert "LDL" in prompt

    def test_empty_profile_has_fallback_text(self) -> None:
        """Profile with no data must produce fallback text."""
        profile = HealthProfile(user_id="x", display_name="Anonymous")
        prompt = build_health_system_prompt(profile, [])
        assert "No health profile data" in prompt

    def test_wearable_summary_in_prompt(self) -> None:
        """Wearable data must be included in system prompt."""
        ws = WearableSummary(
            avg_resting_heart_rate=72.0,
            avg_sleep_hours=6.5,
            avg_hrv_ms=45.0,
            week_starting=date.today(),
        )
        profile = _make_profile(wearable_summary=ws)
        prompt = build_health_system_prompt(profile, [])
        assert "72" in prompt

    def test_health_facts_in_prompt(self) -> None:
        """Extracted health facts must appear in system prompt."""
        profile = _make_profile(health_facts=["Father had MI at 58", "Non-smoker"])
        prompt = build_health_system_prompt(profile, [])
        assert "Father had MI" in prompt

    def test_multiple_citations_all_injected(self) -> None:
        """All citations must be injected when multiple provided."""
        profile = _make_profile()
        citations = [
            Citation(pmid=f"1000000{i}", title=f"Study {i}", journal="NEJM",
                     year="2023", abstract=f"Abstract {i}", authors="Author et al.")
            for i in range(3)
        ]
        prompt = build_health_system_prompt(profile, citations)
        for i in range(3):
            assert f"1000000{i}" in prompt
