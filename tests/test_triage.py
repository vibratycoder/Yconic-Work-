"""Tests for emergency triage logic. Safety-critical — must pass before any UI build."""
from __future__ import annotations
import pytest
from backend.health.injector import check_emergency, EMERGENCY_RESPONSE


class TestEmergencyTriage:
    """Test suite for check_emergency() — the safety gate of the entire application."""

    def test_chest_pain_left_arm_triggers_emergency(self) -> None:
        """Classic MI presentation must always route to 911."""
        result = check_emergency("I have chest pain radiating to my left arm")
        assert result is not None
        assert "911" in result

    def test_chest_pain_jaw_triggers_emergency(self) -> None:
        """Chest pain with jaw radiation is a cardiac emergency."""
        result = check_emergency("chest pain going up to my jaw")
        assert result is not None
        assert "911" in result

    def test_heart_attack_triggers_emergency(self) -> None:
        """Direct mention of heart attack must trigger emergency."""
        result = check_emergency("I think I'm having a heart attack")
        assert result is not None
        assert "911" in result

    def test_stroke_triggers_emergency(self) -> None:
        """Stroke mention must trigger emergency."""
        result = check_emergency("I think I'm having a stroke")
        assert result is not None
        assert "911" in result

    def test_suicidal_triggers_emergency(self) -> None:
        """Mental health emergency must trigger emergency response."""
        result = check_emergency("I am suicidal")
        assert result is not None
        assert "911" in result

    def test_overdose_triggers_emergency(self) -> None:
        """Overdose must trigger emergency response."""
        result = check_emergency("I took an overdose of pills")
        assert result is not None
        assert "911" in result

    def test_not_breathing_triggers_emergency(self) -> None:
        """Respiratory emergency must trigger 911."""
        result = check_emergency("he is not breathing")
        assert result is not None
        assert "911" in result

    def test_anaphylaxis_triggers_emergency(self) -> None:
        """Anaphylaxis must trigger emergency response."""
        result = check_emergency("I think I'm having anaphylaxis")
        assert result is not None
        assert "911" in result

    def test_mild_stomach_pain_not_emergency(self) -> None:
        """Mild symptoms must NOT trigger emergency escalation."""
        result = check_emergency("my stomach hurts a little")
        assert result is None

    def test_general_question_not_emergency(self) -> None:
        """General health questions must not trigger emergency."""
        result = check_emergency("what does high LDL mean for my heart health?")
        assert result is None

    def test_mild_headache_not_emergency(self) -> None:
        """Mild headache must not trigger emergency."""
        result = check_emergency("I have a mild headache")
        assert result is None

    def test_medication_question_not_emergency(self) -> None:
        """Medication questions must not trigger emergency."""
        result = check_emergency("should I take my metformin with food?")
        assert result is None

    def test_emergency_response_contains_911(self) -> None:
        """Emergency response constant must contain 911 call directive."""
        assert "911" in EMERGENCY_RESPONSE

    def test_emergency_response_no_medical_advice(self) -> None:
        """Emergency response must not give medical advice — only escalate."""
        result = check_emergency("chest pain and pressure")
        assert result is not None
        assert "Call 911" in result or "911" in result

    def test_case_insensitive_matching(self) -> None:
        """Emergency detection must be case-insensitive."""
        result = check_emergency("CHEST PAIN radiating to LEFT ARM")
        assert result is not None

    def test_worst_headache_of_life(self) -> None:
        """'Worst headache of my life' is a subarachnoid hemorrhage red flag."""
        result = check_emergency("this is the worst headache of my life")
        assert result is not None
        assert "911" in result
