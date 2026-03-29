"""Shared helpers for RAG source clients.

Both ``semantic_scholar.py`` and ``openalex.py`` need identical preprint
detection and author formatting logic.  Centralising here prevents drift.
"""
from __future__ import annotations

# Preprint / non-peer-reviewed venue markers.
# A paper is rejected if its journal name or open-access URL contains any of
# these lowercase substrings.
PREPRINT_MARKERS: frozenset[str] = frozenset({
    "biorxiv", "medrxiv", "arxiv", "ssrn", "researchsquare",
    "preprints.org", "chemrxiv", "psyarxiv", "osf.io", "zenodo",
})


def format_authors(authors: list[str]) -> str:
    """
    Format an author list as a readable string (up to 3 + 'et al.').

    Args:
        authors: List of author display-name strings.

    Returns:
        Formatted string, e.g. ``"Smith J, Jones A, Lee B et al."``
        Returns ``"Unknown authors"`` for an empty list.
    """
    if not authors:
        return "Unknown authors"
    if len(authors) <= 3:
        return ", ".join(authors)
    return f"{authors[0]}, {authors[1]}, {authors[2]} et al."


def is_preprint(journal: str | None, oa_url: str | None) -> bool:
    """
    Return ``True`` if the paper appears to be a preprint.

    Checks both the journal name and the open-access URL against the
    shared ``PREPRINT_MARKERS`` set.

    Args:
        journal: Journal or venue display name (may be ``None``).
        oa_url: Open-access full-text URL (may be ``None``).

    Returns:
        ``True`` if any preprint marker is found; ``False`` otherwise.
    """
    identifiers = " ".join(filter(None, [journal or "", oa_url or ""])).lower()
    return any(marker in identifiers for marker in PREPRINT_MARKERS)
