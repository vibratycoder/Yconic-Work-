"""NLM RxNorm REST API client — canonical drug name normalisation and concept lookup.

RxNorm (https://www.nlm.nih.gov/research/umls/rxnorm/) is the NLM's normalised
nomenclature for clinical drugs.  This module exposes two public coroutines:

* ``normalize_drug_name`` — resolve a free-text drug name to its canonical RxNorm
  name via RxCUI lookup.
* ``search_rxnorm`` — retrieve a list of drug concepts matching a query name.

No authentication is required; the API is freely accessible.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import aiohttp

from backend.rag.sources._shared import format_authors
from backend.utils.constants import TIMEOUT_SECONDS, PAPERS_PER_SOURCE
from backend.utils.logger import get_logger

log = get_logger(__name__)

_BASE = "https://rxnav.nlm.nih.gov/REST"
_TIMEOUT = TIMEOUT_SECONDS


@dataclass
class RxNormDrug:
    """
    A single drug concept record from the NLM RxNorm API.

    Attributes:
        rxcui: RxNorm Concept Unique Identifier.
        name: Canonical drug name as returned by RxNorm.
        synonym: Alternate label (None when the API provides none).
        tty: RxNorm term type code, e.g. ``"IN"`` (ingredient),
            ``"BN"`` (brand name), ``"SCD"`` (semantic clinical drug).
        citation_count: Always 0 — RxNorm is a terminology, not a literature
            source.
        year: Publication / release year (None — not provided by RxNorm).
        authors: Empty list — filled by ``display_authors`` at access time.
        doi: Not applicable for RxNorm records; always None.
        pmid: Not applicable for RxNorm records; always None.
        title: Human-readable label constructed as ``"RxNorm: {name}"``.
        abstract: One-line description: ``"{name} ({tty}) — RxCUI: {rxcui}"``.
        journal: Fixed string ``"NLM RxNorm"`` to satisfy the shared result
            interface.
        open_access_url: Deep-link to the RxNav concept browser for this RXCUI.
    """

    rxcui: str
    name: str
    synonym: str | None
    tty: str
    citation_count: int = 0
    year: int | None = None
    authors: list[str] = field(default_factory=list)
    doi: str | None = None
    pmid: str | None = None
    title: str = field(init=False)
    abstract: str = field(init=False)
    journal: str | None = "NLM RxNorm"
    open_access_url: str | None = field(init=False)

    def __post_init__(self) -> None:
        """Derive computed fields after dataclass initialisation."""
        self.title = f"RxNorm: {self.name}"
        self.abstract = f"{self.name} ({self.tty}) — RxCUI: {self.rxcui}"
        self.open_access_url = (
            f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={self.rxcui}"
        )

    @property
    def display_authors(self) -> str:
        """
        Return the fixed source attribution string for RxNorm records.

        Returns:
            The string ``"NLM RxNorm"``.
        """
        return "NLM RxNorm"

    @property
    def source_label(self) -> str:
        """
        Return a short human-readable source identifier.

        Returns:
            The string ``"RxNorm"``.
        """
        return "RxNorm"


async def normalize_drug_name(name: str) -> str:
    """
    Resolve a free-text drug name to its canonical RxNorm name.

    Makes two sequential requests to the RxNorm REST API:

    1. ``GET /rxcui.json?name={name}&search=1`` to obtain the primary RxCUI
       for the given name string.
    2. ``GET /rxcui/{rxcui}/properties.json`` to retrieve the canonical
       ``name`` field for that concept.

    If either request fails, returns a non-200 status, or yields no usable
    data, the original ``name`` argument is returned unchanged so callers
    always receive a non-empty string.

    Args:
        name: Free-text drug name to normalise, e.g. ``"tylenol"`` or
            ``"acetaminophen 500mg"``.

    Returns:
        Canonical RxNorm name string, or the original ``name`` on any
        failure or when no matching concept is found.
    """
    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        # Step 1: resolve name → RxCUI
        rxcui: str | None = None
        try:
            async with session.get(
                f"{_BASE}/rxcui.json",
                params={"name": name, "search": "1"},
            ) as resp:
                if resp.status != 200:
                    log.warning(
                        "rxnorm_rxcui_lookup_failed",
                        drug_name=name,
                        status=resp.status,
                    )
                    return name
                data = await resp.json()
                rxcui = (
                    (data.get("idGroup") or {}).get("rxnormId") or [None]
                )[0]
        except aiohttp.ClientError as exc:
            log.warning("rxnorm_rxcui_request_error", drug_name=name, error=str(exc))
            return name

        if not rxcui:
            log.debug("rxnorm_no_rxcui_found", drug_name=name)
            return name

        # Step 2: resolve RxCUI → canonical name
        try:
            async with session.get(
                f"{_BASE}/rxcui/{rxcui}/properties.json",
            ) as resp:
                if resp.status != 200:
                    log.warning(
                        "rxnorm_properties_lookup_failed",
                        rxcui=rxcui,
                        status=resp.status,
                    )
                    return name
                props_data = await resp.json()
                canonical: str | None = (
                    (props_data.get("properties") or {}).get("name")
                )
        except aiohttp.ClientError as exc:
            log.warning(
                "rxnorm_properties_request_error", rxcui=rxcui, error=str(exc)
            )
            return name

        if not canonical:
            log.debug("rxnorm_no_canonical_name", rxcui=rxcui)
            return name

        log.info("rxnorm_normalized", original=name, canonical=canonical, rxcui=rxcui)
        return canonical


async def search_rxnorm(
    drug_name: str,
    max_results: int = PAPERS_PER_SOURCE,
) -> list[RxNormDrug]:
    """
    Search RxNorm for drug concepts matching a given drug name.

    Calls ``GET /drugs.json?name={drug_name}`` and iterates over all
    ``conceptGroup[].conceptProperties[]`` entries, collecting up to
    ``max_results`` concepts as ``RxNormDrug`` objects.

    A 404 response is treated as "no results" and returns an empty list.
    Other HTTP errors are logged and also return an empty list, so the
    RAG pipeline degrades gracefully rather than raising.

    Args:
        drug_name: Drug name query string, e.g. ``"metformin"``.
        max_results: Maximum number of ``RxNormDrug`` records to return.
            Defaults to ``PAPERS_PER_SOURCE``.

    Returns:
        List of ``RxNormDrug`` objects (may be empty).  The list contains
        at most ``max_results`` items.
    """
    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        try:
            async with session.get(
                f"{_BASE}/drugs.json",
                params={"name": drug_name},
            ) as resp:
                if resp.status == 404:
                    log.info(
                        "rxnorm_drugs_not_found",
                        drug_name=drug_name,
                    )
                    return []
                if resp.status != 200:
                    log.warning(
                        "rxnorm_drugs_unexpected_status",
                        drug_name=drug_name,
                        status=resp.status,
                    )
                    return []
                data = await resp.json()
        except aiohttp.ClientError as exc:
            log.warning(
                "rxnorm_drugs_request_error", drug_name=drug_name, error=str(exc)
            )
            return []

    concept_groups: list[dict] = (
        (data.get("drugGroup") or {}).get("conceptGroup") or []
    )

    results: list[RxNormDrug] = []
    for group in concept_groups:
        for concept in group.get("conceptProperties") or []:
            if len(results) >= max_results:
                break
            rxcui: str = concept.get("rxcui", "")
            concept_name: str = concept.get("name", "")
            if not rxcui or not concept_name:
                continue
            results.append(
                RxNormDrug(
                    rxcui=rxcui,
                    name=concept_name,
                    synonym=concept.get("synonym") or None,
                    tty=concept.get("tty", ""),
                )
            )
        if len(results) >= max_results:
            break

    log.info(
        "rxnorm_search_complete",
        drug_name=drug_name,
        results=len(results),
    )
    return results
