"""OpenAlex API client — 250M+ open scholarly works, completely free.

OpenAlex (openalex.org) is the largest open-access academic index:
- 250M+ works (papers, books, datasets, preprints)
- Full metadata including abstract reconstruction
- Citation counts and citation networks
- Institutional affiliations
- Open Access status
- No authentication required

Abstracts are stored as inverted indexes (word → [positions]) which
this module reconstructs into readable text automatically.
"""
from __future__ import annotations

from dataclasses import dataclass

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.rag.sources._shared import format_authors, is_preprint
from backend.utils.constants import TIMEOUT_SECONDS, PAPERS_PER_SOURCE
from backend.utils.logger import get_logger

log = get_logger(__name__)

_BASE = "https://api.openalex.org"
_TIMEOUT = TIMEOUT_SECONDS
_MAX_RESULTS = PAPERS_PER_SOURCE
_FIELDS = ",".join([
    "id",
    "title",
    "abstract_inverted_index",
    "cited_by_count",
    "publication_year",
    "type",
    "primary_location",
    "authorships",
    "ids",
    "open_access",
])


@dataclass
class OpenAlexWork:
    """
    A single work record from the OpenAlex API.

    Attributes:
        work_id: OpenAlex work ID (e.g. 'W2741809807').
        title: Full title of the work.
        abstract: Reconstructed abstract text (may be empty).
        year: Publication year.
        citation_count: Total inbound citations.
        authors: List of author display names.
        doi: Digital Object Identifier (None if unavailable).
        pmid: PubMed ID (None if not indexed).
        work_type: OpenAlex work type (e.g. 'article', 'review').
        journal: Journal or venue name.
        is_open_access: True if full text is freely available.
        open_access_url: URL to free full text (None if paywalled).
    """

    work_id: str
    title: str
    abstract: str
    year: int | None
    citation_count: int
    authors: list[str]
    doi: str | None
    pmid: str | None
    work_type: str
    journal: str | None
    is_open_access: bool
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
        return "OpenAlex"


def _reconstruct_abstract(inverted_index: dict | None) -> str:
    """
    Reconstruct a readable abstract from an OpenAlex inverted index.

    OpenAlex stores abstracts as ``{word: [position, ...], ...}`` dicts
    to avoid reproducing copyrighted text verbatim.  This function
    reverses the mapping back to a natural-language string.

    Args:
        inverted_index: Dict mapping each word to a list of character
            positions where that word appears.  ``None`` or empty dict
            returns an empty string.

    Returns:
        Reconstructed abstract string, or empty string if unavailable.
    """
    if not inverted_index:
        return ""
    position_word: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        for pos in positions:
            position_word.append((pos, word))
    position_word.sort(key=lambda x: x[0])
    return " ".join(w for _, w in position_word)


def _parse_work(raw: dict) -> OpenAlexWork | None:
    """
    Parse a raw OpenAlex API result dict into an OpenAlexWork.

    Args:
        raw: Single work dict from the API 'results' array.

    Returns:
        OpenAlexWork on success, None if title is missing.
    """
    title = (raw.get("title") or "").strip()
    if not title or title.lower() == "none":
        return None

    # Abstract reconstruction
    abstract = _reconstruct_abstract(raw.get("abstract_inverted_index"))

    # Authors
    authorships = raw.get("authorships") or []
    authors: list[str] = []
    for a in authorships:
        author_info = a.get("author") or {}
        name = author_info.get("display_name", "")
        if name:
            authors.append(name)

    # IDs
    ids = raw.get("ids") or {}
    doi_raw = ids.get("doi") or (raw.get("primary_location") or {}).get("landing_page_url", "")
    doi: str | None = None
    if doi_raw and "doi.org" in doi_raw:
        doi = doi_raw.split("doi.org/")[-1]

    pmid_raw = ids.get("pmid", "")
    pmid: str | None = None
    if pmid_raw:
        pmid = str(pmid_raw).replace("https://pubmed.ncbi.nlm.nih.gov/", "").strip("/")

    # Journal
    primary_loc = raw.get("primary_location") or {}
    source = primary_loc.get("source") or {}
    journal = source.get("display_name") if isinstance(source, dict) else None

    # Open access
    oa_info = raw.get("open_access") or {}
    is_oa = bool(oa_info.get("is_oa"))
    oa_url = oa_info.get("oa_url")

    return OpenAlexWork(
        work_id=(raw.get("id") or "").replace("https://openalex.org/", ""),
        title=title,
        abstract=abstract,
        year=raw.get("publication_year"),
        citation_count=int(raw.get("cited_by_count") or 0),
        authors=authors,
        doi=doi,
        pmid=pmid,
        work_type=raw.get("type", "article"),
        journal=journal,
        is_open_access=is_oa,
        open_access_url=oa_url,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def search_openalex(
    query: str,
    max_results: int = _MAX_RESULTS,
) -> list[OpenAlexWork]:
    """
    Search OpenAlex for scholarly works matching a query.

    Filters to works that have abstracts available and sorts by citation
    count descending to surface the most-cited relevant literature.

    Args:
        query: Free-text search query.
        max_results: Maximum number of works to return (max 200).

    Returns:
        List of OpenAlexWork objects sorted by citation count.
        Returns empty list on failure.

    Raises:
        aiohttp.ClientError: Propagated on network failure after all retries.
    """
    params = {
        "search": query,
        # Restrict to peer-reviewed journal articles only:
        #   - type:article  → excludes books, datasets, dissertations
        #   - primary_location.source.type:journal → excludes repositories (preprints)
        #   - has_abstract:true → abstracts required for evidence grading
        "filter": "has_abstract:true,type:article,primary_location.source.type:journal",
        "sort": "cited_by_count:desc",
        "per-page": min(max_results, 50),
        "select": _FIELDS,
        "mailto": "pulse@health.app",  # OpenAlex polite pool — faster responses
    }

    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(f"{_BASE}/works", params=params) as resp:
            if resp.status in (429, 503):
                log.warning("openalex_rate_limited", query=query[:60])
                return []
            resp.raise_for_status()
            data = await resp.json()

    works: list[OpenAlexWork] = []
    for raw in data.get("results") or []:
        work = _parse_work(raw)
        if not work or not work.abstract:
            continue
        # Secondary preprint guard: catches edge cases the API filter misses.
        if is_preprint(work.journal, work.open_access_url):
            log.debug("openalex_preprint_rejected", title=work.title[:60])
            continue
        works.append(work)

    log.info(
        "openalex_search_complete",
        query=query[:60],
        results=len(works),
    )
    return works
