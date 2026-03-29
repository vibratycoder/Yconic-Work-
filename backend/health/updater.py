"""Background health profile updater — extracts facts from conversations."""
from __future__ import annotations
import json
import anthropic
from backend.health.profile import get_profile, upsert_profile
from backend.utils.logger import get_logger

log = get_logger(__name__)

FACT_EXTRACTION_PROMPT = """Review this health conversation and extract any new medical facts about the user.

Return ONLY a JSON array of short factual strings. Example:
["Reported worsening knee pain for 3 weeks", "Started walking 30 min daily"]

Only include facts NOT already in their profile. Return [] if nothing new.
Return ONLY valid JSON — no markdown."""


async def update_profile_from_conversation(
    user_id: str,
    conversation: list[dict[str, str]],
) -> None:
    """
    Extract health facts from a conversation and append to the user's profile.

    Called as a background task after each chat response. Uses Claude to
    identify new medical facts not already in the profile. Silently
    degrades on failure — never blocks the main response path.

    Args:
        user_id: Supabase auth user ID
        conversation: List of message dicts with 'role' and 'content' keys

    Returns:
        None. Updates profile in-place via Supabase.
    """
    try:
        profile = await get_profile(user_id)
        if not profile:
            log.warning("updater_profile_not_found", user_id=user_id)
            return

        existing_facts = "\n".join(f"- {f}" for f in profile.health_facts)
        conv_text = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in conversation)

        client = anthropic.AsyncAnthropic()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=FACT_EXTRACTION_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    f"EXISTING FACTS:\n{existing_facts or 'None'}\n\n"
                    f"CONVERSATION:\n{conv_text}"
                ),
            }],
        )

        raw = response.content[0].text.strip()
        import re
        clean = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
        new_facts: list[str] = json.loads(clean)

        if not isinstance(new_facts, list):
            return

        valid_facts = [f for f in new_facts if isinstance(f, str) and f.strip()]
        if not valid_facts:
            return

        profile.health_facts = (profile.health_facts + valid_facts)[-50:]
        profile.conversation_count += 1
        await upsert_profile(profile)
        log.info("profile_updated", user_id=user_id, new_facts=len(valid_facts))

    except json.JSONDecodeError as exc:
        log.warning("fact_extraction_json_failed", user_id=user_id, error=str(exc))
    except Exception as exc:
        log.error("profile_update_failed", user_id=user_id, error=str(exc))
