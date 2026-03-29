"""Health RAG orchestrator — multi-source evidence retrieval pipeline.

Full pipeline
-------------
1. ``expand_query``      — Claude Haiku generates 3 diverse academic queries
2. Parallel retrieval    — Semantic Scholar + OpenAlex (per expanded query)
3. ``rank_papers``       — OCEBM grade, deduplicate, composite-score, top-N
4. ``build_evidence_block`` — format into structured prompt block
5. Return ``HealthRAGResult`` — evidence block + metadata for callers

The caller (API endpoint or skill) injects the evidence block into the Claude
system prompt *before* the model sees the user's question, grounding every
response with peer-reviewed literature.

Concurrency model
-----------------
All source queries run concurrently with ``asyncio.gather``.  A single
expanded query list of length 3 drives:
  - 3 × Semantic Scholar calls
  - 3 × OpenAlex calls
= up to 6 concurrent HTTP requests.

Rate-limit / error handling
----------------------------
Each source client handles its own retries (tenacity).  Failures return empty
lists — partial results are still ranked and used.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from backend.rag.context_builder import build_evidence_block
from backend.rag.query_expander import expand_query
from backend.rag.reranker import RankedPaper, rank_papers
from backend.rag.sources.openalex import search_openalex
from backend.rag.sources.semantic_scholar import search_semantic_scholar
from backend.utils.logger import get_logger

log = get_logger(__name__)

# How many candidate papers per source per query  (3 queries × 2 sources × N)
_PAPERS_PER_SOURCE = 10

# Final top-N passed to context builder
_MAX_RANKED = 10


@dataclass
class HealthRAGResult:
    """
    Output of the health RAG pipeline.

    Attributes:
        evidence_block: Formatted text block ready for system-prompt injection.
        ranked_papers: Top-ranked papers with all scoring metadata.
        expanded_queries: The 3 academic queries generated from the question.
        total_candidates: Total papers retrieved before deduplication/ranking.
        sources_used: Set of source database names that returned results.
    """

    evidence_block: str
    ranked_papers: list[RankedPaper]
    expanded_queries: list[str]
    total_candidates: int
    sources_used: set[str] = field(default_factory=set)


async def retrieve_health_evidence(
    question: str,
    patient_context: str = "",
    max_results: int = _MAX_RANKED,
) -> HealthRAGResult:
    """
    Run the full health RAG pipeline for a single question.

    Expands the question into 3 academic queries, retrieves papers from
    Semantic Scholar and OpenAlex in parallel, grades and deduplicates them
    with OCEBM criteria, and returns an evidence block ready to inject into
    the Claude system prompt.

    Args:
        question: The user's health question in natural language.
        patient_context: Optional brief patient profile (conditions, meds) for
            query expansion — must NOT include identifying information.
        max_results: Maximum number of papers to include in the evidence block.

    Returns:
        ``HealthRAGResult`` with the formatted evidence block and metadata.
    """
    # ── Step 1: query expansion ────────────────────────────────────────────
    expanded_queries = await expand_query(question, patient_context)
    log.info("rag_queries_expanded", queries=expanded_queries)

    # ── Step 2: parallel multi-source retrieval ────────────────────────────
    # Build one coroutine per (source, query) pair
    ss_tasks = [
        search_semantic_scholar(q, max_results=_PAPERS_PER_SOURCE)
        for q in expanded_queries
    ]
    oa_tasks = [
        search_openalex(q, max_results=_PAPERS_PER_SOURCE)
        for q in expanded_queries
    ]

    all_results = await asyncio.gather(*ss_tasks, *oa_tasks, return_exceptions=True)

    # Flatten and track which sources delivered papers
    all_papers: list = []
    sources_used: set[str] = set()

    for result in all_results:
        if isinstance(result, Exception):
            log.warning("rag_source_error", error=str(result))
            continue
        if result:
            all_papers.extend(result)
            if result:
                sources_used.add(result[0].source_label)

    total_candidates = len(all_papers)
    log.info(
        "rag_retrieval_complete",
        total_candidates=total_candidates,
        sources=list(sources_used),
    )

    # ── Step 3: grade, deduplicate, rank ──────────────────────────────────
    ranked = rank_papers(all_papers, max_results=max_results)

    # ── Step 4: build evidence block ──────────────────────────────────────
    block = build_evidence_block(ranked)

    return HealthRAGResult(
        evidence_block=block,
        ranked_papers=ranked,
        expanded_queries=expanded_queries,
        total_candidates=total_candidates,
        sources_used=sources_used,
    )


def inject_evidence_into_system_prompt(
    base_system_prompt: str,
    rag_result: HealthRAGResult,
) -> str:
    """
    Prepend the evidence block to a Claude system prompt.

    Places evidence *before* the base instructions so the model reads the
    literature context before encountering persona/formatting rules.

    Args:
        base_system_prompt: Original system prompt for the health assistant.
        rag_result: Result from ``retrieve_health_evidence``.

    Returns:
        Augmented system prompt string.
    """
    if not rag_result.evidence_block:
        return base_system_prompt

    return (
        rag_result.evidence_block
        + "\n\n"
        + "─" * 60
        + "\n\n"
        + base_system_prompt
    )
