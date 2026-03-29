"""Structured evidence block assembly for RAG prompt injection.

Converts a ranked list of ``RankedPaper`` objects into a formatted text block
that is injected into the Claude system prompt as a ``[EVIDENCE]`` section.

Format overview
---------------
Each paper entry includes:
- Sequential reference number  [1], [2], …
- OCEBM evidence badge         ★★★★★ → ★☆☆☆☆  (filled = quality stars)
- Source database label        (Semantic Scholar / OpenAlex)
- Authors, year, journal
- TLDR one-liner (Semantic Scholar only, when available)
- Abstract snippet             up to ``MAX_ABSTRACT_CHARS`` characters
- Citation count
- DOI / PMID links

A compact citation instruction is appended at the end so the model knows how
to reference papers inline (e.g. "[1]") and is reminded to prioritise
higher-level evidence.
"""
from __future__ import annotations

from backend.rag.reranker import RankedPaper
from backend.utils.logger import get_logger

log = get_logger(__name__)

# Maximum characters to include from each abstract to avoid blowing context
MAX_ABSTRACT_CHARS = 600

# Stars displayed next to each evidence level (5 = best, 1 = lowest)
_STAR_FULL = "★"
_STAR_EMPTY = "☆"

_CITATION_INSTRUCTION = """\
─────────────────────────────────────────────
CITATION INSTRUCTIONS
• Cite evidence inline as [1], [2], etc.
• Prefer Level 1–2 studies when they exist.
• If evidence conflicts, note the disagreement and explain which study design \
is more reliable.
• Do NOT fabricate citations or extend claims beyond what the abstracts state.
─────────────────────────────────────────────"""


def _evidence_stars(level: int) -> str:
    """
    Convert an OCEBM level (1–5) to a 5-star quality indicator.

    Level 1 → ★★★★★ (highest quality)
    Level 5 → ★☆☆☆☆ (lowest quality)

    Args:
        level: OCEBM evidence level 1–5.

    Returns:
        Five-character star string.
    """
    filled = max(0, 6 - level)  # level 1 → 5 stars, level 5 → 1 star
    return _STAR_FULL * filled + _STAR_EMPTY * (5 - filled)


def _format_paper_block(idx: int, paper: RankedPaper) -> str:
    """
    Format a single ranked paper into a numbered evidence block.

    Args:
        idx: 1-based reference number.
        paper: RankedPaper with all scoring and metadata populated.

    Returns:
        Formatted string block for this paper.
    """
    stars = _evidence_stars(paper.evidence_level)
    lines: list[str] = []

    # Header line
    lines.append(
        f"[{idx}] {stars} Level {paper.evidence_level}: {paper.evidence_label}"
        f"  |  {paper.source_label}"
    )

    # Title
    lines.append(f"    Title: {paper.title}")

    # Authors + year + journal
    author_str = paper.authors or "Unknown authors"
    year_str = str(paper.year) if paper.year else "n.d."
    if paper.journal:
        lines.append(f"    {author_str} ({year_str}) — {paper.journal}")
    else:
        lines.append(f"    {author_str} ({year_str})")

    # TLDR (Semantic Scholar only)
    if paper.tldr:
        lines.append(f"    TL;DR: {paper.tldr}")

    # Abstract snippet
    abstract = paper.abstract or ""
    if len(abstract) > MAX_ABSTRACT_CHARS:
        abstract = abstract[:MAX_ABSTRACT_CHARS].rsplit(" ", 1)[0] + " …"
    if abstract:
        lines.append(f"    Abstract: {abstract}")

    # Metrics + identifiers
    meta_parts: list[str] = [f"{paper.citation_count:,} citations"]
    if paper.doi:
        meta_parts.append(f"DOI: {paper.doi}")
    elif paper.pmid:
        meta_parts.append(f"PMID: {paper.pmid}")
    meta_parts.append(f"Score: {paper.composite_score:.3f}")
    lines.append(f"    [{', '.join(meta_parts)}]")

    return "\n".join(lines)


def build_evidence_block(papers: list[RankedPaper]) -> str:
    """
    Assemble all ranked papers into a single structured evidence block.

    The block is designed to be prepended to the Claude system prompt so that
    the model has grounded, citable context for every health question.

    Args:
        papers: Ordered list of RankedPaper objects (highest score first).

    Returns:
        Complete evidence block string ready for injection into a system
        prompt.  Returns an empty string if ``papers`` is empty.
    """
    if not papers:
        log.warning("context_builder_empty_papers")
        return ""

    header_lines = [
        "═" * 60,
        f"EVIDENCE BASE  ({len(papers)} papers, ranked by quality × impact × recency)",
        "═" * 60,
    ]

    paper_blocks: list[str] = []
    for i, paper in enumerate(papers, start=1):
        paper_blocks.append(_format_paper_block(i, paper))

    body = ("\n\n").join(paper_blocks)
    footer = _CITATION_INSTRUCTION

    block = "\n".join(header_lines) + "\n\n" + body + "\n\n" + footer

    log.info(
        "context_block_built",
        paper_count=len(papers),
        block_chars=len(block),
    )
    return block
