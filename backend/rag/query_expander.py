"""Medical query expansion using Claude Haiku.

Generates semantically diverse search queries from a single health question,
using precise medical terminology (MeSH terms preferred) to maximise the
breadth and relevance of the multi-source retrieval pass.

A single natural-language question like "Is metformin safe for kidneys?" is
expanded into distinct queries covering:
  - Clinical evidence (RCT / systematic review angle)
  - Mechanism / pharmacology angle
  - Epidemiology / risk-factor angle

This 3× expansion dramatically improves recall across Semantic Scholar,
OpenAlex, and PubMed compared to sending the raw question verbatim.
"""
from __future__ import annotations

import anthropic

from backend.utils.logger import get_logger

log = get_logger(__name__)

_EXPANSION_SYSTEM = """\
You are a medical librarian with expertise in academic database searching.

Given a patient health question and optional patient context, generate exactly
3 optimised academic search queries.  Rules:
- Use precise medical terminology and MeSH terms where possible
- Each query must explore a DIFFERENT angle:
    Query 1: clinical outcomes / efficacy / safety evidence
    Query 2: mechanisms, pathophysiology, or pharmacology
    Query 3: epidemiology, risk factors, or guidelines / recommendations
- Use Boolean operators (AND, OR) when helpful
- Keep each query under 12 words
- Do NOT include patient-specific values (age, lab numbers)
- Output ONLY the 3 queries, one per line, no numbering, no labels"""


async def expand_query(
    question: str,
    patient_context: str = "",
) -> list[str]:
    """
    Generate 3 academically-optimised search queries from a health question.

    Uses Claude Haiku for cost-effective, fast query generation.  Returns the
    original question as a fallback if the LLM call fails.

    Args:
        question: The user's original health question in natural language.
        patient_context: Optional brief profile context (conditions, meds)
            to help orient the queries without including identifying details.

    Returns:
        List of 3 search query strings.  Falls back to ``[question]`` on error.
    """
    user_content = f"Question: {question}"
    if patient_context:
        user_content += f"\nPatient context (do not include in queries): {patient_context}"

    try:
        client = anthropic.AsyncAnthropic()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=_EXPANSION_SYSTEM,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = response.content[0].text.strip()
        queries = [q.strip() for q in raw.splitlines() if q.strip()]
        # Guarantee exactly 3, fall back to original if model under-delivers
        while len(queries) < 3:
            queries.append(question)
        queries = queries[:3]
        log.info(
            "query_expansion_complete",
            original=question[:60],
            expanded=queries,
        )
        return queries
    except anthropic.APIError as exc:
        log.warning("query_expansion_failed", error=str(exc))
        return [question]
