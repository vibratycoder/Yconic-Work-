"""Citation formatting utilities for Pulse evidence pipeline."""
from __future__ import annotations
from backend.evidence.pubmed import Citation


def format_inline_citation(citation: Citation, index: int) -> str:
    """
    Format a citation for inline reference in Claude's response.

    Args:
        citation: Citation object with PMID and metadata
        index: 1-based citation index for numbering

    Returns:
        Formatted inline citation string.
    """
    return f"[{index}] {citation.title[:60]}{'...' if len(citation.title) > 60 else ''} (PMID: {citation.pmid})"


def format_citation_list(citations: list[Citation]) -> str:
    """
    Format a list of citations as a numbered reference section.

    Args:
        citations: List of Citation objects

    Returns:
        Multi-line formatted reference section string.
    """
    if not citations:
        return ""
    lines = ["References:"]
    for i, c in enumerate(citations, 1):
        lines.append(f"{i}. {c.authors} {c.title}. {c.journal}. {c.year}. PMID: {c.pmid}")
    return "\n".join(lines)
