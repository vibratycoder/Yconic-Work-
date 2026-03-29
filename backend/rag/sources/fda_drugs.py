"""FDA openFDA drug label client — official US drug prescribing information.

The FDA openFDA API exposes structured drug label (package insert) data:
- Indications and usage
- Warnings and precautions
- Contraindications
- Dosage and administration
- Adverse reactions

No authentication required; rate limits apply (240 requests/minute anonymous,
120 000/day with API key).

API reference: https://open.fda.gov/apis/drug/label/
"""
from __future__ import annotations

from dataclasses import dataclass, field

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.rag.sources._shared import format_authors
from backend.utils.constants import TIMEOUT_SECONDS, MAX_RETRIES, PAPERS_PER_SOURCE
from backend.utils.logger import get_logger

log = get_logger(__name__)

_BASE = "https://api.fda.gov/drug/label.json"
_TIMEOUT = TIMEOUT_SECONDS
_MAX_RESULTS_CAP = 10


@dataclass
class FDADrugLabel:
    """
    A single drug label record from the FDA openFDA drug label database.

    Attributes:
        set_id: FDA SPL Set ID (unique label identifier).
        generic_name: Generic (non-proprietary) drug name.
        brand_name: Proprietary/brand name, or None if unavailable.
        manufacturer: Name of the drug's manufacturer, or None if unavailable.
        indications: Full indications-and-usage text from the label.
        warnings: Warnings and precautions text from the label.
        citation_count: Always 0 — drug labels are not academic papers.
        year: Always None — openFDA does not expose a publication year field.
        authors: Single-item list with manufacturer name, or ``["FDA"]``.
        doi: Always None — drug labels are not journal articles.
        pmid: Always None — drug labels are not PubMed-indexed.
        title: Formatted as ``"FDA Label: <brand_name or generic_name>"``.
        abstract: First 500 characters of indications, falling back to warnings.
        journal: Always ``"FDA Drug Label Database"`` for display purposes.
        open_access_url: Always None (labels are accessed via API, not a URL).
    """

    set_id: str
    generic_name: str
    brand_name: str | None
    manufacturer: str | None
    indications: str
    warnings: str
    citation_count: int = 0
    year: int | None = None
    authors: list[str] = field(default_factory=list)
    doi: str | None = None
    pmid: str | None = None
    title: str = ""
    abstract: str = ""
    journal: str | None = "FDA Drug Label Database"
    open_access_url: str | None = None

    @property
    def display_authors(self) -> str:
        """
        Return a formatted manufacturer string using the shared author formatter.

        Returns:
            Formatted string, e.g. ``"Pfizer Inc"`` or ``"FDA"``.
        """
        return format_authors(self.authors)

    @property
    def source_label(self) -> str:
        """Return a short human-readable source identifier."""
        return "FDA openFDA"


def _first_item(value: list[str] | None) -> str:
    """
    Return the first element of a list, or an empty string if unavailable.

    openFDA fields are arrays of strings; most callers only need the first entry.

    Args:
        value: List of strings from an openFDA field, or None.

    Returns:
        First element of the list, or ``""`` if the list is None or empty.
    """
    if not value:
        return ""
    return value[0]


def _parse_label(raw: dict) -> FDADrugLabel | None:
    """
    Parse a single openFDA drug label result dict into an FDADrugLabel.

    Args:
        raw: Single result dict from the openFDA API ``results`` array.

    Returns:
        FDADrugLabel on success, None if the set ID or generic name is missing.
    """
    openfda = raw.get("openfda") or {}

    set_id = (raw.get("set_id") or "").strip()
    if not set_id:
        return None

    generic_name = _first_item(openfda.get("generic_name")).strip()
    if not generic_name:
        # Fall back to substance_name if generic_name absent
        generic_name = _first_item(openfda.get("substance_name")).strip()
    if not generic_name:
        return None

    brand_name_raw = _first_item(openfda.get("brand_name")).strip()
    brand_name: str | None = brand_name_raw or None

    manufacturer_raw = _first_item(openfda.get("manufacturer_name")).strip()
    manufacturer: str | None = manufacturer_raw or None

    indications = _first_item(raw.get("indications_and_usage")).strip()
    warnings = _first_item(raw.get("warnings")).strip()

    title = f"FDA Label: {brand_name or generic_name}"

    # Abstract: first 500 chars of indications, falling back to warnings
    abstract_source = indications or warnings
    abstract = abstract_source[:500]

    authors: list[str] = [manufacturer] if manufacturer else ["FDA"]

    return FDADrugLabel(
        set_id=set_id,
        generic_name=generic_name,
        brand_name=brand_name,
        manufacturer=manufacturer,
        indications=indications,
        warnings=warnings,
        citation_count=0,
        year=None,
        authors=authors,
        doi=None,
        pmid=None,
        title=title,
        abstract=abstract,
        journal="FDA Drug Label Database",
        open_access_url=None,
    )


@retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=1, min=1, max=8))
async def search_fda_drugs(
    drug_name: str,
    max_results: int = PAPERS_PER_SOURCE,
) -> list[FDADrugLabel]:
    """
    Search the FDA openFDA drug label database for a drug by generic name.

    Uses an exact phrase search on the ``openfda.generic_name`` field.
    Partial matches are not performed; callers should normalise the drug name
    before passing it in (lowercase, no salt/ester suffixes).

    Args:
        drug_name: Generic drug name to search for (e.g. ``"metformin"``).
        max_results: Maximum number of label records to return (capped at 10
            to avoid returning dozens of reformulations).

    Returns:
        List of FDADrugLabel objects for matching drug labels.
        Returns an empty list on 404 (drug not found), 429/503 responses,
        or if all parsed records are invalid.

    Raises:
        aiohttp.ClientError: Propagated on network failure after all retries.
    """
    limit = min(max_results, _MAX_RESULTS_CAP)
    params: dict[str, str | int] = {
        "search": f'openfda.generic_name:"{drug_name}"',
        "limit": limit,
    }

    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(_BASE, params=params) as resp:
            if resp.status == 404:
                log.info(
                    "fda_drugs_not_found",
                    drug_name=drug_name[:60],
                )
                return []
            if resp.status in (429, 503):
                log.warning(
                    "fda_drugs_rate_limited",
                    drug_name=drug_name[:60],
                    status=resp.status,
                )
                return []
            resp.raise_for_status()
            data = await resp.json()

    labels: list[FDADrugLabel] = []
    for raw in data.get("results") or []:
        label = _parse_label(raw)
        if label is None:
            continue
        labels.append(label)

    log.info(
        "fda_drugs_search_complete",
        drug_name=drug_name[:60],
        results=len(labels),
    )
    return labels
