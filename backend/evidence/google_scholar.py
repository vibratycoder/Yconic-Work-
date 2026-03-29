"""Google Scholar client using the scholarly library as the primary evidence source."""
from __future__ import annotations

import asyncio
import hashlib
from functools import partial

from backend.evidence.pubmed import Citation
from backend.utils.logger import get_logger

log = get_logger(__name__)

MAX_RESULTS = 3
REQUEST_TIMEOUT = 30  # scholarly blocks the thread; generous timeout


def _search_sync(query: str, max_results: int) -> list[Citation]:
    """
    Synchronous Google Scholar search via the scholarly library.

    Runs in a thread executor so it does not block the async event loop.
    Fills each result to obtain the full abstract.

    Args:
        query: Plain-text search query
        max_results: Maximum number of results to parse

    Returns:
        List of Citation objects. Empty list on import error or search failure.
    """
    try:
        from scholarly import scholarly  # type: ignore[import-untyped]
    except ImportError:
        log.warning("scholarly_not_installed", hint="pip install scholarly")
        return []

    citations: list[Citation] = []
    try:
        search_gen = scholarly.search_pubs(query)
        for _ in range(max_results):
            try:
                pub = next(search_gen)
            except StopIteration:
                break

            # Fill to retrieve the complete abstract
            try:
                pub = scholarly.fill(pub)
            except Exception as fill_exc:
                log.warning("scholar_fill_failed", error=str(fill_exc))

            try:
                bib: dict = pub.get("bib", {})
                title: str = (bib.get("title") or "").strip()
                if not title:
                    continue

                # Use cluster_id as a stable identifier; fall back to title hash
                cluster_id: str = str(pub.get("cluster_id") or "")
                if not cluster_id:
                    cluster_id = hashlib.md5(title.encode()).hexdigest()[:12]

                # Authors: list[str] or a single string
                raw_authors = bib.get("author", "")
                if isinstance(raw_authors, list):
                    top_authors = raw_authors[:3]
                    authors = ", ".join(top_authors)
                    if len(raw_authors) > 3:
                        authors += " et al."
                else:
                    authors = str(raw_authors).strip()

                journal: str = (bib.get("journal") or bib.get("venue") or "").strip()
                year: str = str(bib.get("pub_year") or bib.get("year") or "").strip()
                abstract: str = (bib.get("abstract") or "").strip()

                # Prefer a stable article URL over the Scholar search link
                article_url: str = (
                    pub.get("pub_url")
                    or bib.get("pub_url")
                    or pub.get("eprint_url")
                    or ""
                )

                citations.append(Citation(
                    pmid=cluster_id,
                    title=title,
                    journal=journal,
                    year=year,
                    abstract=abstract,
                    authors=authors,
                    article_url=str(article_url),
                    source="google_scholar",
                ))
            except Exception as parse_exc:
                log.warning("scholar_article_parse_failed", error=str(parse_exc))
                continue

    except Exception as search_exc:
        log.warning("scholar_search_failed", query=query[:60], error=str(search_exc))

    return citations


async def search_google_scholar(
    query: str,
    max_results: int = MAX_RESULTS,
) -> list[Citation]:
    """
    Search Google Scholar for academic papers matching a health query.

    Delegates to the synchronous scholarly library via asyncio's thread executor
    to avoid blocking the event loop.

    Args:
        query: Natural-language or keyword search query
        max_results: Maximum number of Citation objects to return

    Returns:
        List of Citation objects sourced from Google Scholar.
        Returns empty list on any error so callers can fall back gracefully.
    """
    loop = asyncio.get_running_loop()
    try:
        citations = await asyncio.wait_for(
            loop.run_in_executor(None, partial(_search_sync, query, max_results)),
            timeout=REQUEST_TIMEOUT,
        )
        log.info("scholar_search_complete", query=query[:60], count=len(citations))
        return citations
    except asyncio.TimeoutError:
        log.warning("scholar_search_timeout", query=query[:60])
        return []
    except Exception as exc:
        log.warning("scholar_executor_failed", error=str(exc))
        return []
