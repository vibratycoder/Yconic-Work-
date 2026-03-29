"""Doctor visit preparation summary generator."""
from __future__ import annotations
from pydantic import BaseModel, Field
import anthropic
from backend.models.health_profile import HealthProfile
from backend.utils.constants import CLAUDE_SONNET, MAX_TOKENS_VISIT_PREP
from backend.utils.logger import get_logger

log = get_logger(__name__)

VISIT_PREP_SYSTEM = """You are a health advocate helping a patient prepare for a doctor's visit.

Create a concise one-page summary they can hand to their doctor. Include:
1. Current chief complaints / questions to ask
2. Medication list with doses
3. Recent abnormal lab values
4. Key health history points
5. Three specific questions to ask the doctor

Be specific to their values. Reference actual lab numbers. Keep it under 400 words.
Write in plain language the patient and doctor can both easily scan."""


class VisitSummary(BaseModel):
    """
    Structured doctor visit preparation summary.

    Attributes:
        chief_complaints: Patient's primary concerns for the visit
        medication_list: Formatted medication summary
        abnormal_labs: Flagged abnormal results to discuss
        health_history: Key background the doctor should know
        questions_to_ask: Specific questions prepared for the doctor
        full_text: Complete formatted visit summary
    """
    chief_complaints: list[str] = Field(default_factory=list)
    medication_list: list[str] = Field(default_factory=list)
    abnormal_labs: list[str] = Field(default_factory=list)
    health_history: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    full_text: str = ""


async def generate_visit_summary(profile: HealthProfile) -> VisitSummary:
    """
    Generate a one-page doctor visit summary from the user's health profile.

    Uses Claude to synthesize the profile into an actionable visit prep
    document with specific questions for their doctor.

    Args:
        profile: Complete HealthProfile with labs and facts

    Returns:
        VisitSummary with structured sections and full_text.

    Raises:
        anthropic.APIError: On Anthropic API failure.
    """
    context = profile.to_context_string()
    client = anthropic.AsyncAnthropic()

    response = await client.messages.create(
        model=CLAUDE_SONNET,
        max_tokens=MAX_TOKENS_VISIT_PREP,
        system=VISIT_PREP_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Generate a visit prep summary for this patient:\n\n{context}",
        }],
    )

    full_text = response.content[0].text
    log.info("visit_summary_generated", user_id=profile.user_id)

    # Build structured summary from profile data
    abnormal_labs = [
        f"{l.test_name}: {l.display_value}"
        for l in profile.recent_labs
        if l.is_abnormal
    ]
    med_list = [
        f"{m.name} {m.dose} {m.frequency}"
        for m in profile.current_medications
    ]

    return VisitSummary(
        chief_complaints=[],
        medication_list=med_list,
        abnormal_labs=abnormal_labs,
        health_history=profile.health_facts[:5],
        questions_to_ask=[],
        full_text=full_text,
    )
