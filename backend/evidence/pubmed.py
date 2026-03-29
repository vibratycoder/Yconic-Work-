"""PubMed E-utilities client for evidence-based citation retrieval."""
from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from typing import Optional
import aiohttp
from lxml import etree
from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from backend.utils.logger import get_logger

log = get_logger(__name__)

PUBMED_ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
MAX_CITATIONS = 3
REQUEST_TIMEOUT = 10


@dataclass
class Citation:
    """
    A single PubMed citation with metadata for evidence display.

    Attributes:
        pmid: PubMed ID string
        title: Article title
        journal: Journal name
        year: Publication year
        abstract: Article abstract text
        authors: Formatted author string
    """
    pmid: str
    title: str
    journal: str
    year: str
    abstract: str
    authors: str = ""

    @property
    def pubmed_url(self) -> str:
        """
        Return the canonical PubMed URL for this article.

        Returns:
            Full URL string to PubMed abstract page.
        """
        return f"https://pubmed.ncbi.nlm.nih.gov/{self.pmid}/"

    @property
    def display_summary(self) -> str:
        """
        Return a short display summary for UI list rendering.

        Returns:
            Truncated title with journal and year.
        """
        title_trunc = self.title[:80] + "..." if len(self.title) > 80 else self.title
        return f"{title_trunc} — {self.journal} ({self.year})"

    def to_prompt_block(self) -> str:
        """
        Format citation as a structured block for LLM system prompt injection.

        Returns:
            Multi-line string with PMID, title, journal, year, and abstract.
        """
        abstract_trunc = self.abstract[:1200] + "..." if len(self.abstract) > 1200 else self.abstract
        return (
            f"PMID: {self.pmid}\n"
            f"Title: {self.title}\n"
            f"Authors: {self.authors}\n"
            f"Journal: {self.journal} ({self.year})\n"
            f"Abstract: {abstract_trunc}"
        )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def search_pubmed(query: str, max_results: int = MAX_CITATIONS) -> list[str]:
    """
    Search PubMed for article PMIDs matching a query string.

    Uses E-utilities esearch endpoint with retry logic for resilience.

    Args:
        query: PubMed search query string (may include MeSH terms)
        max_results: Maximum number of PMIDs to return

    Returns:
        List of PMID strings (may be empty if no results or on error).

    Raises:
        aiohttp.ClientError: On network failure after all retries exhausted.
    """
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": str(max_results),
        "retmode": "json",
        "sort": "relevance",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                PUBMED_ESEARCH_URL,
                params=params,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
                pmids: list[str] = data.get("esearchresult", {}).get("idlist", [])
                log.info("pubmed_search_complete", query=query[:60], pmid_count=len(pmids))
                return pmids
    except aiohttp.ClientError as exc:
        log.warning("pubmed_search_failed", query=query[:60], error=str(exc))
        raise


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def fetch_abstracts(pmids: list[str]) -> list[Citation]:
    """
    Fetch full article metadata and abstracts for a list of PMIDs.

    Uses E-utilities efetch endpoint with XML parsing.

    Args:
        pmids: List of PubMed ID strings to fetch

    Returns:
        List of Citation objects with metadata populated.

    Raises:
        aiohttp.ClientError: On network failure after all retries exhausted.
    """
    if not pmids:
        return []
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
        "rettype": "abstract",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                PUBMED_EFETCH_URL,
                params=params,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ) as resp:
                resp.raise_for_status()
                xml_text = await resp.text()
                citations = _parse_pubmed_xml(xml_text)
                log.info("pubmed_fetch_complete", pmid_count=len(pmids), parsed=len(citations))
                return citations
    except aiohttp.ClientError as exc:
        log.warning("pubmed_fetch_failed", pmids=pmids, error=str(exc))
        raise


def _parse_pubmed_xml(xml_text: str) -> list[Citation]:
    """
    Parse PubMed efetch XML response into Citation objects.

    Handles malformed XML gracefully by returning empty list on parse failure.

    Args:
        xml_text: Raw XML string from PubMed efetch API

    Returns:
        List of Citation objects. Empty list on parse failure.
    """
    citations: list[Citation] = []
    try:
        root = etree.fromstring(xml_text.encode("utf-8"))
    except etree.XMLSyntaxError as exc:
        log.warning("pubmed_xml_parse_failed", error=str(exc))
        return []

    for article in root.findall(".//PubmedArticle"):
        try:
            pmid_el = article.find(".//PMID")
            pmid = pmid_el.text.strip() if pmid_el is not None and pmid_el.text else ""
            if not pmid:
                continue

            title_el = article.find(".//ArticleTitle")
            title = (title_el.text or "").strip() if title_el is not None else ""

            journal_el = article.find(".//Journal/Title")
            journal = (journal_el.text or "").strip() if journal_el is not None else ""

            year_el = article.find(".//PubDate/Year")
            year = (year_el.text or "").strip() if year_el is not None else ""

            # Build abstract from all AbstractText elements (handles structured abstracts)
            abstract_parts: list[str] = []
            for abs_el in article.findall(".//AbstractText"):
                label = abs_el.get("Label")
                text = abs_el.text or ""
                if label:
                    abstract_parts.append(f"{label}: {text}")
                elif text:
                    abstract_parts.append(text)
            abstract = " ".join(abstract_parts).strip()

            # Build authors string
            author_parts: list[str] = []
            for author in article.findall(".//Author")[:3]:
                last = author.find("LastName")
                initials = author.find("Initials")
                if last is not None and last.text:
                    name = last.text
                    if initials is not None and initials.text:
                        name += f" {initials.text}"
                    author_parts.append(name)
            authors = ", ".join(author_parts)
            if len(article.findall(".//Author")) > 3:
                authors += " et al."

            citations.append(Citation(
                pmid=pmid,
                title=title,
                journal=journal,
                year=year,
                abstract=abstract,
                authors=authors,
            ))
        except (AttributeError, ValueError) as exc:
            log.warning("pubmed_article_parse_failed", error=str(exc))
            continue

    return citations


async def get_citations_for_question(
    question: str,
    health_domain: str,
    max_results: int = MAX_CITATIONS,
) -> list[Citation]:
    """
    Orchestrate a full PubMed search for a health question.

    Builds an optimized query, searches PubMed, fetches abstracts, and
    returns citations. Degrades gracefully — returns empty list on any failure.

    Args:
        question: User's health question in natural language
        health_domain: Classified domain from classify_health_domain
        max_results: Maximum citations to return

    Returns:
        List of Citation objects, empty on any failure.
    """
    from backend.evidence.query_builder import build_pubmed_query
    query = build_pubmed_query(question, health_domain)
    log.info("pubmed_query_built", domain=health_domain, query=query[:80])

    try:
        pmids = await search_pubmed(query, max_results)
        if not pmids:
            log.info("pubmed_no_results", query=query[:80])
            return []
        citations = await fetch_abstracts(pmids)
        return citations
    except RetryError as exc:
        log.warning("pubmed_all_retries_failed", error=str(exc))
        return []
    except Exception as exc:
        log.error("pubmed_pipeline_failed", error=str(exc))
        return []
