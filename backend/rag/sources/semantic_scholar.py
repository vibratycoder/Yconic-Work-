"""Semantic Scholar API client — Google Scholar-equivalent with official REST API.

Semantic Scholar (semanticscholar.org) provides:
- 200M+ academic papers across all disciplines
- AI-generated TLDRs (one-sentence summaries)
- Citation counts updated daily
- Study type classification (Meta-Analysis, RCT, Review, etc.)
- Open-access PDF links where available
- 100 req/5 min unauthenticated; 1 req/sec with API key

Set SEMANTIC_SCHOLAR_API_KEY in .env for higher rate limits.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.rag.sources._shared import format_authors, is_preprint
from backend.utils.constants import TIMEOUT_SECONDS, MAX_RETRIES, PAPERS_PER_SOURCE
from backend.utils.logger import get_logger

log = get_logger(__name__)

_BASE = "https://api.semanticscholar.org/graph/v1"
_FIELDS = ",".join([
    "title",
    "abstract",
    "year",
    "citationCount",
    "authors",
    "externalIds",
    "publicationTypes",
    "openAccessPdf",
    "tldr",
    "journal",
    "publicationDate",
])
_TIMEOUT = TIMEOUT_SECONDS
_MAX_RESULTS = PAPERS_PER_SOURCE


@dataclass
class ScholarPaper:
    """
    A single paper record from Semantic Scholar.

    Attributes:
        paper_id: Semantic Scholar internal ID.
        title: Full paper title.
        abstract: Full abstract text (may be empty for some papers).
        year: Publication year.
        citation_count: Total inbound citations.
        authors: List of author name strings.
        doi: Digital Object Identifier (None if unavailable).
        pmid: PubMed ID string (None if not indexed in PubMed).
        publication_types: Study design tags (e.g. 'Meta-Analysis', 'RCT').
        journal: Journal or venue name.
        tldr: AI-generated one-sentence summary (None if unavailable).
        open_access_url: URL to free full text (None if paywalled).
    """

    paper_id: str
    title: str
    abstract: str
    year: int | None
    citation_count: int
    authors: list[str]
    doi: str | None
    pmid: str | None
    publication_types: list[str]
    journal: str | None
    tldr: str | None
    open_access_url: str | None

    @property
    def display_authors(self) -> str:
        """
        Return a formatted author string (up to 3 + 'et al.').

        Returns:
            Formatted author string.
        """
        return format_authors(self.authors)

    @property
    def source_label(self) -> str:
        """Return a short human-readable source identifier."""
        return "Semantic Scholar"


def _parse_paper(raw: dict) -> ScholarPaper | None:
    """
    Parse a raw Semantic Scholar API response dict into a ScholarPaper.

    Args:
        raw: Single paper dict from the API 'data' array.

    Returns:
        ScholarPaper on success, None if title is missing.
    """
    title = raw.get("title", "").strip()
    if not title:
        return None

    external_ids = raw.get("externalIds") or {}
    doi = external_ids.get("DOI")
    pmid = external_ids.get("PubMed")

    authors = [a.get("name", "") for a in (raw.get("authors") or []) if a.get("name")]

    pub_types: list[str] = raw.get("publicationTypes") or []

    journal_info = raw.get("journal") or {}
    journal = journal_info.get("name") if isinstance(journal_info, dict) else None

    tldr_block = raw.get("tldr")
    tldr = tldr_block.get("text") if isinstance(tldr_block, dict) else None

    oa = raw.get("openAccessPdf")
    oa_url = oa.get("url") if isinstance(oa, dict) else None

    return ScholarPaper(
        paper_id=raw.get("paperId", ""),
        title=title,
        abstract=(raw.get("abstract") or "").strip(),
        year=raw.get("year"),
        citation_count=int(raw.get("citationCount") or 0),
        authors=authors,
        doi=doi,
        pmid=pmid,
        publication_types=pub_types,
        journal=journal,
        tldr=tldr,
        open_access_url=oa_url,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def search_semantic_scholar(
    query: str,
    max_results: int = _MAX_RESULTS,
) -> list[ScholarPaper]:
    """
    Search Semantic Scholar for academic papers matching a query.

    Uses the Graph API paper/search endpoint.  Automatically adds the
    API key header if SEMANTIC_SCHOLAR_API_KEY is set in the environment.

    Args:
        query: Search query string (free text or Boolean).
        max_results: Maximum number of papers to return (capped at 100 by API).

    Returns:
        List of ScholarPaper objects sorted by relevance (API default).
        Returns empty list on failure after retries.

    Raises:
        aiohttp.ClientError: Propagated on network failure after all retries.
    """
    headers: dict[str, str] = {"Accept": "application/json"}
    api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key

    params = {
        "query": query,
        "fields": _FIELDS,
        "limit": min(max_results, 100),
    }

    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(
            f"{_BASE}/paper/search",
            params=params,
            headers=headers,
        ) as resp:
            if resp.status == 429:
                log.warning("semantic_scholar_rate_limited", query=query[:60])
                return []
            resp.raise_for_status()
            data = await resp.json()

    papers: list[ScholarPaper] = []
    for raw in data.get("data") or []:
        paper = _parse_paper(raw)
        if not paper:
            continue
        if is_preprint(paper.journal, paper.open_access_url):
            log.debug("semantic_scholar_preprint_rejected", title=paper.title[:60])
            continue
        papers.append(paper)

    log.info(
        "semantic_scholar_search_complete",
        query=query[:60],
        results=len(papers),
    )
    return papers
