"""Emergency triage gate and health system prompt assembly."""
from __future__ import annotations
from backend.models.health_profile import HealthProfile
from backend.evidence.pubmed import Citation
from backend.utils.logger import get_logger

log = get_logger(__name__)

EMERGENCY_RESPONSE = (
    "Call 911 immediately. This sounds like a medical emergency. "
    "Do not wait — call emergency services or go to your nearest emergency room right now. "
    "I am an AI and cannot provide emergency medical care."
)

# Each inner list is an AND group — all terms must be present to match
EMERGENCY_PATTERNS: list[list[str]] = [
    ["chest pain", "left arm"],
    ["chest pain", "jaw"],
    ["chest pain", "pressure"],
    ["chest pain", "sweating"],
    ["heart attack"],
    ["stroke"],
    ["not breathing"],
    ["stopped breathing"],
    ["can't breathe"],
    ["cannot breathe"],
    ["suicidal"],
    ["suicide"],
    ["overdose"],
    ["anaphylaxis"],
    ["severe allergic"],
    ["unconscious"],
    ["unresponsive"],
    ["worst headache"],
    ["sudden severe headache"],
    ["coughing blood"],
    ["vomiting blood"],
]


def check_emergency(text: str) -> str | None:
    """
    Deterministic safety gate — checks for emergency keywords before any LLM call.

    This function MUST be called before every LLM invocation. It uses
    pure string matching with no AI involvement to ensure zero false
    negatives on life-threatening presentations.

    Args:
        text: User's input message to check for emergency signals

    Returns:
        Emergency response string if emergency detected, None otherwise.
    """
    text_lower = text.lower()
    for pattern_group in EMERGENCY_PATTERNS:
        if all(term in text_lower for term in pattern_group):
            log.info("emergency_detected", pattern=pattern_group, text_preview=text[:80])
            return EMERGENCY_RESPONSE
    return None


def build_health_system_prompt(
    profile: HealthProfile,
    citations: list[Citation],
    attachment_count: int = 0,
) -> str:
    """
    Build the Claude system prompt with health profile context and PubMed citations.

    Injects the user's full health profile and relevant peer-reviewed citations
    into the system prompt so Claude can give personalized, evidence-based responses.
    When attachments are present, adds explicit instructions for extracting and
    connecting document findings to the user's question and health profile.

    Args:
        profile: User's HealthProfile with demographics, conditions, labs, etc.
        citations: PubMed citations fetched for the current question
        attachment_count: Number of files attached to this message (0 = no attachments)

    Returns:
        Complete system prompt string ready for Claude messages.create().
    """
    profile_context = profile.to_context_string()

    # Build citation block
    if citations:
        citation_blocks = "\n\n".join(c.to_prompt_block() for c in citations)
        evidence_section = f"PEER-REVIEWED EVIDENCE (cite PMIDs in your response):\n\n{citation_blocks}"
    else:
        evidence_section = "PEER-REVIEWED EVIDENCE:\nNo studies retrieved for this query. Rely on established clinical guidelines."

    # Build attachment guidance when files are present
    if attachment_count > 0:
        noun = "file" if attachment_count == 1 else "files"
        attachment_section = f"""
ATTACHED DOCUMENTS ({attachment_count} {noun}):
The user has attached {attachment_count} {noun}. You MUST do all of the following:
- Read the attached {noun} in full before responding
- Extract every health-relevant value, date, finding, or flag visible in the {noun}
- Directly answer the user's specific question using data from the attachment(s)
- Quote exact numbers, units, and reference ranges from the document when relevant
- Cross-reference document values against the PATIENT HEALTH PROFILE above — flag any discrepancies or changes from previously recorded values
- Highlight any out-of-range results using the reference ranges shown in the document itself
- Connect findings to the patient's existing conditions, medications, and history
- Do not give a generic analysis — every insight must be anchored to what is actually in the attached file(s)"""
    else:
        attachment_section = ""

    system_prompt = f"""You are Sona Health — a sharp, warm health co-pilot who happens to know the user's full medical picture. Think of yourself as a knowledgeable friend who reads lab reports over coffee: direct, calm, never condescending.

SAFETY: If anything sounds life-threatening (chest pain, can't breathe, stroke, overdose, suicidal thoughts), tell them to call 911 immediately and stop there.

PATIENT PROFILE:
{profile_context}
{attachment_section}
{evidence_section}

VOICE & FORMAT:
- Talk like a person, not a medical brochure. Short sentences. No filler.
- Use the user's name when it feels natural — not every message.
- Lead with what actually matters. Put the most important insight first.
- Reference their specific numbers and history — generic advice is useless here.
- When citing a study, weave it in naturally: "One study (PMID 12345678) found..." not a bullet-point footnote dump.
- Bold a number or term only when it genuinely needs to stand out.
- Skip preamble ("Great question!", "As an AI..."), throat-clearing, and sign-off summaries.
- If something needs a doctor's attention, say so plainly — once, not three times.
- End with one clear next step, stated in a single sentence."""

    return system_prompt
