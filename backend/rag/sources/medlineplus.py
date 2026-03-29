"""MedlinePlus health topic client — NLM consumer health summaries.

MedlinePlus (medlineplus.gov) is the NLM's authoritative consumer health
information portal.  This module fetches health-topic summaries via the
NLM web-search service at ``https://wsearch.nlm.nih.gov/ws/query``.

The response is XML; each ``<document>`` element contains ``<content>``
children keyed by ``name`` attribute (``title``, ``FullSummary``,
``organizationName``, ``url``).  These are parsed with the standard-library
``xml.etree.ElementTree`` module — no third-party XML dependency required.

No authentication is required; the endpoint is freely accessible.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

import aiohttp

from backend.rag.sources._shared import format_authors
from backend.utils.constants import TIMEOUT_SECONDS, PAPERS_PER_SOURCE
from backend.utils.logger import get_logger

log = get_logger(__name__)

_BASE = "https://wsearch.nlm.nih.gov/ws/query"
_TIMEOUT = TIMEOUT_SECONDS


@dataclass
class MedlinePlusTopic:
    """
    A single health-topic record from MedlinePlus.

    Attributes:
        topic_id: Opaque identifier derived from the document rank/position
            within the search result set.
        title: Health-topic title as returned by MedlinePlus.
        summary: Full HTML-stripped summary text.
        url: Canonical MedlinePlus URL for the topic (None if absent).
        organization: Authoring organisation name, e.g. ``"MedlinePlus"``.
        citation_count: Always 0 — MedlinePlus is an editorial source, not
            a citation-tracked literature database.
        year: Publication year (None — not provided by the search API).
        authors: Single-element list containing ``organization``, so the
            shared ``display_authors`` property produces a meaningful value.
        doi: Not applicable; always None.
        pmid: Not applicable; always None.
        abstract: First 500 characters of ``summary``, used as the snippet
            passed to the RAG ranking stage.
        journal: Fixed string ``"MedlinePlus (NLM)"`` to satisfy the shared
            result interface expected by the RAG pipeline.
        open_access_url: Same as ``url`` — all MedlinePlus content is freely
            accessible.
    """

    topic_id: str
    title: str
    summary: str
    url: str | None
    organization: str
    citation_count: int = 0
    year: int | None = None
    authors: list[str] = field(default_factory=list)
    doi: str | None = None
    pmid: str | None = None
    abstract: str = field(init=False)
    journal: str | None = "MedlinePlus (NLM)"
    open_access_url: str | None = field(init=False)

    def __post_init__(self) -> None:
        """Derive computed fields and default ``authors`` after initialisation."""
        # Truncate summary to 500 chars for the abstract snippet.
        self.abstract = self.summary[:500]
        # Mirror url into open_access_url for the shared interface.
        self.open_access_url = self.url
        # Populate authors from organization if callers used the default.
        if not self.authors:
            self.authors = [self.organization]

    @property
    def display_authors(self) -> str:
        """
        Return a formatted author string derived from the authoring organisation.

        Delegates to the shared ``format_authors`` helper so formatting is
        consistent across all RAG source types.

        Returns:
            Formatted string, e.g. ``"MedlinePlus"`` or ``"Unknown authors"``.
        """
        return format_authors(self.authors)

    @property
    def source_label(self) -> str:
        """
        Return a short human-readable source identifier.

        Returns:
            The string ``"MedlinePlus"``.
        """
        return "MedlinePlus"


def _strip_html(text: str) -> str:
    """
    Remove HTML tags from a string using ElementTree parsing.

    MedlinePlus ``FullSummary`` content contains inline HTML.  This helper
    parses the fragment as XML (wrapped in a synthetic root element) and
    concatenates all text nodes, producing plain prose suitable for display
    and embedding.

    Falls back to returning the raw ``text`` unchanged if parsing fails so
    that a malformed snippet never causes data loss.

    Args:
        text: HTML or plain-text string to clean.

    Returns:
        Plain-text string with all HTML tags removed.
    """
    try:
        root = ET.fromstring(f"<root>{text}</root>")
        parts: list[str] = []
        for node in root.iter():
            if node.text:
                parts.append(node.text.strip())
            if node.tail:
                parts.append(node.tail.strip())
        return " ".join(p for p in parts if p)
    except ET.ParseError:
        # The fragment is not well-formed XML; return as-is.
        return text


def _parse_document(element: ET.Element, index: int) -> MedlinePlusTopic | None:
    """
    Parse a single ``<document>`` XML element into a ``MedlinePlusTopic``.

    Extracts ``<content name="...">`` children, mapping the ``name``
    attribute to the element's text value.

    Args:
        element: The ``<document>`` ``ElementTree`` element to parse.
        index: Zero-based position within the result set, used to construct
            a synthetic ``topic_id`` when no explicit ID is available.

    Returns:
        ``MedlinePlusTopic`` on success, or ``None`` if the title is absent.
    """
    content: dict[str, str] = {}
    for child in element:
        key = child.get("name", "")
        text = (child.text or "").strip()
        if key and text:
            content[key] = text

    title = content.get("title", "").strip()
    if not title:
        return None

    raw_summary = content.get("FullSummary", "")
    summary = _strip_html(raw_summary) if raw_summary else ""

    organization = content.get("organizationName", "MedlinePlus").strip()
    url: str | None = content.get("url") or None

    return MedlinePlusTopic(
        topic_id=str(index),
        title=title,
        summary=summary,
        url=url,
        organization=organization,
    )


async def search_medlineplus(
    query: str,
    max_results: int = PAPERS_PER_SOURCE,
) -> list[MedlinePlusTopic]:
    """
    Search MedlinePlus health topics for a given query string.

    Calls the NLM web-search service at ``https://wsearch.nlm.nih.gov/ws/query``
    with the ``healthTopics`` database and parses the returned XML.  Up to
    ``max_results`` ``<document>`` elements are converted to
    ``MedlinePlusTopic`` objects.

    Network errors and non-200 responses are logged and result in an empty
    list being returned, so the RAG pipeline continues gracefully.

    Args:
        query: Free-text health query, e.g. ``"type 2 diabetes management"``.
        max_results: Maximum number of topics to return.  Defaults to
            ``PAPERS_PER_SOURCE``.

    Returns:
        List of ``MedlinePlusTopic`` objects (may be empty).  Contains at
        most ``max_results`` items.
    """
    params = {
        "db": "healthTopics",
        "term": query,
        "retmax": str(max_results),
    }

    timeout = aiohttp.ClientTimeout(total=_TIMEOUT)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        try:
            async with session.get(_BASE, params=params) as resp:
                if resp.status != 200:
                    log.warning(
                        "medlineplus_unexpected_status",
                        query=query[:60],
                        status=resp.status,
                    )
                    return []
                raw_xml = await resp.text()
        except aiohttp.ClientError as exc:
            log.warning(
                "medlineplus_request_error", query=query[:60], error=str(exc)
            )
            return []

    try:
        root = ET.fromstring(raw_xml)
    except ET.ParseError as exc:
        log.warning("medlineplus_xml_parse_error", query=query[:60], error=str(exc))
        return []

    topics: list[MedlinePlusTopic] = []
    for index, doc_element in enumerate(root.iter("document")):
        if len(topics) >= max_results:
            break
        topic = _parse_document(doc_element, index)
        if topic is not None:
            topics.append(topic)

    log.info(
        "medlineplus_search_complete",
        query=query[:60],
        results=len(topics),
    )
    return topics
