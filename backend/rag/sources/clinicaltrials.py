"""ClinicalTrials.gov API v2 client — registered clinical trial search.

ClinicalTrials.gov is the authoritative US registry for clinical trials:
- 400 000+ registered studies worldwide
- Updated daily by study sponsors
- Covers Phase I–IV, interventional and observational designs
- No authentication required; rate limits apply (use 429 handling)

API reference: https://clinicaltrials.gov/data-api/api
"""
from __future__ import annotations

from dataclasses import dataclass, field

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.rag.sources._shared import format_authors
from backend.utils.constants import TIMEOUT_SECONDS, MAX_RETRIES, PAPERS_PER_SOURCE
from backend.utils.logger import get_logger

log = get_logger(__name__)

_BASE = "https://clinicaltrials.gov/api/v2/studies"
_TIMEOUT = TIMEOUT_SECONDS
_MAX_RESULTS_CAP = 20


@dataclass
class ClinicalTrial:
    """
    A single study record from ClinicalTrials.gov.

    Attributes:
        nct_id: ClinicalTrials.gov unique identifier (e.g. 'NCT04280705').
        title: Brief human-readable study title.
        abstract: Brief summary of the study design and objectives.
        year: Year extracted from the study start date (None if unavailable).
        citation_count: Always 0 — ClinicalTrials.gov has no citation metric.
        authors: Single-item list containing the lead sponsor name.
        doi: Always None — clinical trials are not journal articles.
        pmid: Always None — not PubMed-indexed at the trial record level.
        phase: Clinical phase string (e.g. 'Phase 2', 'Phase 3') or None.
        status: Overall recruitment status (e.g. 'Recruiting', 'Completed').
        enrollment: Enrolled or target participant count (None if unreported).
        journal: Set to ``"ClinicalTrials.gov (<status>)"`` for display purposes.
        open_access_url: Direct URL to the study page on ClinicalTrials.gov.
    """

    nct_id: str
    title: str
    abstract: str
    year: int | None
    citation_count: int = 0
    authors: list[str] = field(default_factory=list)
    doi: str | None = None
    pmid: str | None = None
    phase: str | None = None
    status: str = ""
    enrollment: int | None = None
    journal: str | None = None
    open_access_url: str | None = None

    @property
    def display_authors(self) -> str:
        """
        Return a formatted sponsor string using the shared author formatter.

        Returns:
            Formatted string, e.g. ``"Pfizer Inc"`` or ``"Unknown authors"``.
        """
        return format_authors(self.authors)

    @property
    def source_label(self) -> str:
        """Return a short human-readable source identifier."""
        return "ClinicalTrials.gov"


def _parse_year(start_date: str | None) -> int | None:
    """
    Extract a four-digit year from a ClinicalTrials.gov start date string.

    ClinicalTrials.gov dates arrive in several formats:
    ``"2021-03-15"``, ``"March 2021"``, ``"2021"``.  We take the first
    four-character token that looks like a valid year (1900–2100).

    Args:
        start_date: Raw date string from the API, or None.

    Returns:
        Integer year, or None if parsing fails.
    """
    if not start_date:
        return None
    for token in start_date.replace("-", " ").split():
        if len(token) == 4 and token.isdigit():
            year = int(token)
            if 1900 <= year <= 2100:
                return year
    return None


def _parse_trial(raw: dict) -> ClinicalTrial | None:
    """
    Parse a single ClinicalTrials.gov v2 API study object into a ClinicalTrial.

    The v2 API wraps all fields under ``protocolSection`` with nested modules.

    Args:
        raw: Single study dict from the API ``studies`` array.

    Returns:
        ClinicalTrial on success, None if the NCT ID or title is missing.
    """
    protocol = raw.get("protocolSection") or {}

    id_module = protocol.get("identificationModule") or {}
    nct_id = (id_module.get("nctId") or "").strip()
    title = (id_module.get("briefTitle") or "").strip()
    if not nct_id or not title:
        return None

    description_module = protocol.get("descriptionModule") or {}
    abstract = (description_module.get("briefSummary") or "").strip()

    status_module = protocol.get("statusModule") or {}
    overall_status = (status_module.get("overallStatus") or "").strip()
    start_date_struct = status_module.get("startDateStruct") or {}
    start_date = start_date_struct.get("date") if isinstance(start_date_struct, dict) else None
    year = _parse_year(start_date)

    sponsor_module = protocol.get("sponsorCollaboratorsModule") or {}
    lead_sponsor = sponsor_module.get("leadSponsor") or {}
    sponsor_name = (lead_sponsor.get("name") or "").strip()
    authors: list[str] = [sponsor_name] if sponsor_name else []

    design_module = protocol.get("designModule") or {}
    phases_list: list[str] = design_module.get("phases") or []
    phase: str | None = phases_list[0] if phases_list else None
    enrollment_info = design_module.get("enrollmentInfo") or {}
    enrollment_raw = enrollment_info.get("count") if isinstance(enrollment_info, dict) else None
    enrollment: int | None = int(enrollment_raw) if enrollment_raw is not None else None

    return ClinicalTrial(
        nct_id=nct_id,
        title=title,
        abstract=abstract,
        year=year,
        citation_count=0,
        authors=authors,
        doi=None,
        pmid=None,
        phase=phase,
        status=overall_status,
        enrollment=enrollment,
        journal=f"ClinicalTrials.gov ({overall_status})",
        open_access_url=f"https://clinicaltrials.gov/study/{nct_id}",
    )


@retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=1, min=1, max=8))
async def search_clinicaltrials(
    query: str,
    max_results: int = PAPERS_PER_SOURCE,
) -> list[ClinicalTrial]:
    """
    Search ClinicalTrials.gov for studies matching a condition or keyword query.

    Uses the v2 REST API ``/studies`` endpoint with ``query.cond`` for
    condition/keyword matching.  Results are returned in API-default relevance
    order.

    Args:
        query: Free-text condition or keyword search string.
        max_results: Maximum number of trials to return (capped at 20 by this
            client to avoid overwhelming the RAG pipeline).

    Returns:
        List of ClinicalTrial objects matching the query.
        Returns an empty list on 429/503 responses or if no results are found.

    Raises:
        aiohttp.ClientError: Propagated on network failure after all retries.
    """
    page_size = min(max_results, _MAX_RESULTS_CAP)
    params: dict[str, str | int] = {
        "query.cond": query,
        "format": "json",
        "pageSize": page_size,
    }

    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(_BASE, params=params) as resp:
            if resp.status in (429, 503):
                log.warning(
                    "clinicaltrials_rate_limited",
                    query=query[:60],
                    status=resp.status,
                )
                return []
            resp.raise_for_status()
            data = await resp.json()

    trials: list[ClinicalTrial] = []
    for raw in data.get("studies") or []:
        trial = _parse_trial(raw)
        if trial is None:
            continue
        trials.append(trial)

    log.info(
        "clinicaltrials_search_complete",
        query=query[:60],
        results=len(trials),
    )
    return trials
