"""
Pulse Scrape Agent — autonomous blood work reference range updater.

Searches Google Scholar and PubMed for peer-reviewed studies on normal blood
work reference intervals, uses Claude to extract the numeric ranges from
abstracts, and writes the results to:

    scrape.md          — human-readable database with full citations
    backend/data/scraped_ranges.py  — machine-readable Python dict

Usage:
    python -m backend.agents.scrape_agent
    python -m backend.agents.scrape_agent --tests "WBC,Hemoglobin,TSH"
    python -m backend.agents.scrape_agent --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import textwrap
from datetime import date
from pathlib import Path
from typing import TypedDict

import anthropic
import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.utils.logger import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parents[3]
SCRAPE_MD = _REPO_ROOT / "scrape.md"
SCRAPED_RANGES_PY = _REPO_ROOT / "backend" / "data" / "scraped_ranges.py"

# ---------------------------------------------------------------------------
# Biomarker search catalogue
# ---------------------------------------------------------------------------

BIOMARKER_QUERIES: dict[str, str] = {
    # CBC
    "WBC":          "white blood cell count reference interval adults normal range",
    "Hemoglobin":   "hemoglobin reference range adults normal values population study",
    "RBC":          "red blood cell count reference interval healthy adults",
    "Hematocrit":   "hematocrit normal range adults reference interval",
    "MCV":          "mean corpuscular volume normal range adults reference interval",
    "Platelets":    "platelet count reference interval adults healthy population",
    # CMP
    "Glucose":      "fasting glucose reference range normal adults diabetes diagnostic criteria",
    "Creatinine":   "serum creatinine reference interval adults sex-specific",
    "eGFR":         "eGFR reference range adults CKD-EPI normal",
    "Sodium":       "serum sodium reference interval adults normal range",
    "Potassium":    "serum potassium reference interval adults normal range",
    "ALT":          "alanine aminotransferase ALT reference range adults sex-specific upper limit",
    "AST":          "aspartate aminotransferase AST normal range adults reference interval",
    "ALP":          "alkaline phosphatase normal range adults reference interval",
    "Albumin":      "serum albumin reference range adults normal",
    "Total Bilirubin": "total bilirubin reference interval adults",
    # Lipids
    "LDL":          "LDL cholesterol optimal range adults cardiovascular guideline",
    "HDL":          "HDL cholesterol normal range sex-specific cardiovascular",
    "Total Cholesterol": "total cholesterol desirable range adults guideline",
    "Triglycerides": "triglycerides normal range fasting adults reference interval",
    # Thyroid
    "TSH":          "TSH reference interval adults NHANES thyroid stimulating hormone",
    "Free T4":      "free T4 reference range adults normal",
    "Free T3":      "free T3 reference range adults normal",
    # Diabetes
    "HbA1c":        "HbA1c reference range normal prediabetes diabetes diagnostic criteria",
    # Iron
    "Ferritin":     "serum ferritin reference interval adults sex-specific normal range",
    "Iron":         "serum iron reference interval adults normal range",
    # Vitamins
    "Vitamin D":    "25-hydroxyvitamin D reference range sufficiency deficiency Endocrine Society",
    "Vitamin B12":  "vitamin B12 cobalamin reference range deficiency normal",
    "Folate":       "serum folate reference interval adults normal range",
    # Cardiac
    "Troponin":     "high-sensitivity troponin 99th percentile upper reference limit normal",
    "BNP":          "BNP B-type natriuretic peptide reference range heart failure",
    # Inflammation
    "hs-CRP":       "high sensitivity CRP cardiovascular risk reference range adults",
    "ESR":          "erythrocyte sedimentation rate reference interval age-adjusted",
    # Hormones
    "Testosterone": "total testosterone reference range adults sex-specific Endocrine Society",
    "Cortisol":     "morning cortisol reference range adults normal",
    # Kidney
    "Uric Acid":    "uric acid reference range adults sex-specific hyperuricemia",
    "PSA":          "PSA prostate-specific antigen age-specific reference range",
}

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


class ExtractedRange(TypedDict):
    """Claude's structured extraction of a reference range from an abstract."""

    test_name: str
    low: float | None
    high: float | None
    unit: str
    population: str
    note: str
    confidence: str        # "high" | "medium" | "low"


class StudyRecord(TypedDict):
    """Full record combining scholarly metadata with extracted ranges."""

    title: str
    authors: str
    journal: str
    year: str
    pmid: str
    article_url: str
    source: str            # "google_scholar" | "pubmed"
    query_biomarker: str
    extracted: ExtractedRange


# ---------------------------------------------------------------------------
# PubMed search (backup source)
# ---------------------------------------------------------------------------

PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def _pubmed_search(query: str, max_results: int = 3) -> list[dict]:
    """
    Search PubMed for studies matching the query.

    Args:
        query: PubMed search string
        max_results: Maximum number of results to fetch

    Returns:
        List of article metadata dicts with title, authors, journal, year, pmid.
    """
    params = {
        "db": "pubmed", "term": query, "retmax": str(max_results),
        "retmode": "json", "sort": "relevance",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                PUBMED_ESEARCH, params=params,
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
                pmids: list[str] = data.get("esearchresult", {}).get("idlist", [])

        if not pmids:
            return []

        # Fetch summaries
        sum_params = {"db": "pubmed", "id": ",".join(pmids), "retmode": "json", "rettype": "summary"}
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
                params=sum_params,
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                resp.raise_for_status()
                summary = await resp.json()

        results: list[dict] = []
        for pmid in pmids:
            art = summary.get("result", {}).get(pmid, {})
            authors_list = [a.get("name", "") for a in art.get("authors", [])[:3]]
            authors = ", ".join(authors_list)
            if len(art.get("authors", [])) > 3:
                authors += " et al."
            results.append({
                "pmid": pmid,
                "title": art.get("title", ""),
                "authors": authors,
                "journal": art.get("source", ""),
                "year": art.get("pubdate", "")[:4],
                "article_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "abstract": art.get("abstract", ""),
                "source": "pubmed",
            })
        return results

    except Exception as exc:
        log.warning("pubmed_scrape_failed", query=query[:60], error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Google Scholar search
# ---------------------------------------------------------------------------

def _scholar_search_sync(query: str, max_results: int = 3) -> list[dict]:
    """
    Synchronous Google Scholar search for reference range studies.

    Args:
        query: Search query string
        max_results: Maximum results to fetch

    Returns:
        List of article metadata dicts.
    """
    try:
        from scholarly import scholarly  # type: ignore[import-untyped]
    except ImportError:
        log.warning("scholarly_not_installed")
        return []

    results: list[dict] = []
    try:
        gen = scholarly.search_pubs(query)
        for _ in range(max_results):
            try:
                pub = next(gen)
                try:
                    pub = scholarly.fill(pub)
                except Exception:
                    pass
                bib = pub.get("bib", {})
                title = (bib.get("title") or "").strip()
                if not title:
                    continue
                raw_authors = bib.get("author", "")
                if isinstance(raw_authors, list):
                    top = raw_authors[:3]
                    authors = ", ".join(top) + (" et al." if len(raw_authors) > 3 else "")
                else:
                    authors = str(raw_authors).strip()
                results.append({
                    "pmid": str(pub.get("cluster_id") or ""),
                    "title": title,
                    "authors": authors,
                    "journal": (bib.get("journal") or bib.get("venue") or "").strip(),
                    "year": str(bib.get("pub_year") or bib.get("year") or "").strip(),
                    "article_url": str(pub.get("pub_url") or bib.get("pub_url") or ""),
                    "abstract": (bib.get("abstract") or "").strip(),
                    "source": "google_scholar",
                })
            except StopIteration:
                break
            except Exception as exc:
                log.warning("scholar_parse_failed", error=str(exc))
    except Exception as exc:
        log.warning("scholar_search_failed", query=query[:60], error=str(exc))
    return results


async def _scholar_search(query: str, max_results: int = 3) -> list[dict]:
    """Async wrapper around the synchronous scholarly search."""
    loop = asyncio.get_event_loop()
    from functools import partial
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, partial(_scholar_search_sync, query, max_results)),
            timeout=45,
        )
    except (asyncio.TimeoutError, Exception) as exc:
        log.warning("scholar_async_failed", error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Claude extraction
# ---------------------------------------------------------------------------

_EXTRACT_SYSTEM = textwrap.dedent("""
    You are a clinical laboratory data extractor.

    Given a research paper title, journal, year, and abstract, extract the
    specific normal reference range for the requested blood test biomarker.

    Respond ONLY with a single JSON object matching this schema exactly:
    {
      "test_name": "<official test name>",
      "low": <number or null>,
      "high": <number or null>,
      "unit": "<unit string>",
      "population": "<e.g. 'adults ≥18 y', 'males 20-60 y'>",
      "note": "<brief clinical note, or empty string>",
      "confidence": "high" | "medium" | "low"
    }

    Use null for low/high when the range is one-sided (e.g. LDL has no lower
    limit — use null for low). Set confidence='low' if the abstract does not
    explicitly state a numeric reference range for this test.
""").strip()


async def _extract_range_from_abstract(
    client: anthropic.AsyncAnthropic,
    biomarker: str,
    article: dict,
) -> ExtractedRange | None:
    """
    Use Claude to extract a reference range from a paper abstract.

    Args:
        client: Anthropic async client
        biomarker: The target biomarker name (e.g. 'TSH', 'Hemoglobin')
        article: Article metadata dict with title, abstract, journal, year

    Returns:
        ExtractedRange dict if extraction succeeded, None on error.
    """
    abstract = article.get("abstract", "")
    if not abstract:
        return None

    user_msg = (
        f"Biomarker: {biomarker}\n\n"
        f"Title: {article.get('title', '')}\n"
        f"Journal: {article.get('journal', '')} ({article.get('year', '')})\n\n"
        f"Abstract:\n{abstract[:2000]}"
    )

    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=_EXTRACT_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```[a-z]*\n?", "", raw).rstrip("` \n")
        extracted: ExtractedRange = json.loads(raw)
        return extracted
    except (json.JSONDecodeError, KeyError, anthropic.APIError) as exc:
        log.warning("extract_failed", biomarker=biomarker, error=str(exc))
        return None


# ---------------------------------------------------------------------------
# scrape.md writer
# ---------------------------------------------------------------------------

def _append_to_scrape_md(records: list[StudyRecord], dry_run: bool = False) -> None:
    """
    Append new study records to scrape.md.

    Updates the agent run log and adds new entries under each biomarker section.
    Creates the file if it does not exist.

    Args:
        records: List of StudyRecord dicts from this scrape run
        dry_run: If True, print what would be written instead of writing.
    """
    if not records:
        return

    today = date.today().isoformat()
    biomarkers_updated = len({r["query_biomarker"] for r in records})
    studies_added = len(records)

    # Build markdown entries
    entries: list[str] = []
    entries.append(f"\n\n---\n\n## Agent Run — {today}\n")
    entries.append(
        f"Scrape run added **{studies_added} study record(s)** covering "
        f"**{biomarkers_updated} biomarker(s)**.\n"
    )

    by_biomarker: dict[str, list[StudyRecord]] = {}
    for rec in records:
        by_biomarker.setdefault(rec["query_biomarker"], []).append(rec)

    for biomarker, recs in sorted(by_biomarker.items()):
        entries.append(f"\n### {biomarker}\n")
        for rec in recs:
            ex = rec["extracted"]
            low  = ex.get("low")
            high = ex.get("high")
            if low is not None and high is not None:
                range_str = f"{low}–{high} {ex.get('unit', '')}".strip()
            elif high is not None:
                range_str = f"<{high} {ex.get('unit', '')}".strip()
            elif low is not None:
                range_str = f">{low} {ex.get('unit', '')}".strip()
            else:
                range_str = "no numeric range extracted"

            entries.append(
                f"- **{rec['title'][:80]}{'...' if len(rec['title']) > 80 else ''}**\n"
                f"  {rec['authors']} · {rec['journal']} · {rec['year']}"
                + (f" · PMID:{rec['pmid']}" if rec["pmid"] else "")
                + f"\n  Range: {range_str}"
                + (f" | Population: {ex.get('population', '')}" if ex.get("population") else "")
                + (f" | {ex.get('note', '')}" if ex.get("note") else "")
                + f"\n  Confidence: {ex.get('confidence', '?')} | Source: {rec['source']}\n"
            )

    # Update run log row in MEMORY.md — also log to scrape.md itself
    run_log_row = (
        f"| {today} | {biomarkers_updated} | {studies_added} | Automated scrape run |"
    )

    block = "\n".join(entries) + "\n" + run_log_row

    if dry_run:
        print("=== DRY RUN — would append to scrape.md ===")
        print(block)
        return

    with open(SCRAPE_MD, "a", encoding="utf-8") as fh:
        fh.write(block + "\n")

    log.info("scrape_md_updated", path=str(SCRAPE_MD), records=studies_added)


# ---------------------------------------------------------------------------
# scraped_ranges.py updater (Claude rewrites the file)
# ---------------------------------------------------------------------------

_REGEN_SYSTEM = textwrap.dedent("""
    You are a Python code writer for a medical application.

    You will be given:
    1. The CURRENT contents of backend/data/scraped_ranges.py
    2. A list of new reference ranges extracted from peer-reviewed studies

    Your task: update the BASE and SEX_RANGES dicts in the file with the new
    evidence-backed values. Only update entries where the new study has
    confidence='high' or 'medium'. Do not remove existing entries.
    Preserve all docstrings, comments, and file structure exactly.

    Respond ONLY with the complete updated Python file — no markdown fences,
    no explanation.
""").strip()


async def _regenerate_scraped_ranges(
    client: anthropic.AsyncAnthropic,
    records: list[StudyRecord],
    dry_run: bool = False,
) -> None:
    """
    Ask Claude to regenerate scraped_ranges.py incorporating new extracted ranges.

    Args:
        client: Anthropic async client
        records: Newly scraped study records
        dry_run: If True, print the regenerated file instead of writing it.
    """
    if not records:
        return

    current_py = SCRAPED_RANGES_PY.read_text(encoding="utf-8")

    new_ranges_json = json.dumps(
        [
            {
                "biomarker": r["query_biomarker"],
                "extracted": r["extracted"],
                "citation": f"{r['authors']} {r['journal']} {r['year']} PMID:{r['pmid']}",
            }
            for r in records
            if r["extracted"].get("confidence") in ("high", "medium")
        ],
        indent=2,
    )

    user_msg = (
        f"CURRENT FILE:\n```python\n{current_py}\n```\n\n"
        f"NEW EVIDENCE-BACKED RANGES:\n```json\n{new_ranges_json}\n```\n\n"
        "Please update the file with the new ranges where confidence is high or medium."
    )

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=_REGEN_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        updated_py = response.content[0].text.strip()
        # Strip any accidental markdown fences
        updated_py = re.sub(r"^```[a-z]*\n?", "", updated_py).rstrip("` \n")

        if dry_run:
            print("=== DRY RUN — would write scraped_ranges.py ===")
            print(updated_py[:500] + "\n[...truncated...]")
            return

        SCRAPED_RANGES_PY.write_text(updated_py, encoding="utf-8")
        log.info("scraped_ranges_py_updated", path=str(SCRAPED_RANGES_PY))

    except anthropic.APIError as exc:
        log.error("regen_api_failed", error=str(exc))


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

async def run(
    biomarkers: list[str] | None = None,
    dry_run: bool = False,
    max_studies_per_biomarker: int = 2,
) -> None:
    """
    Run the scraping agent.

    For each biomarker:
    1. Search Google Scholar (primary) then PubMed (fallback)
    2. Extract reference ranges from abstracts using Claude Haiku
    3. Collect all study records
    After all biomarkers:
    4. Append new entries to scrape.md
    5. Regenerate scraped_ranges.py with Claude Sonnet

    Args:
        biomarkers: Subset of BIOMARKER_QUERIES keys to process.
                    Defaults to all biomarkers.
        dry_run: Print output without writing files.
        max_studies_per_biomarker: How many studies to process per biomarker.
    """
    client = anthropic.AsyncAnthropic()
    targets = biomarkers or list(BIOMARKER_QUERIES.keys())
    all_records: list[StudyRecord] = []

    for bm in targets:
        query = BIOMARKER_QUERIES.get(bm)
        if not query:
            log.warning("unknown_biomarker", name=bm)
            continue

        log.info("scraping_biomarker", name=bm)

        # Primary: Google Scholar
        articles = await _scholar_search(query, max_results=max_studies_per_biomarker)

        # Fallback: PubMed
        if not articles:
            log.info("scholar_empty_using_pubmed", biomarker=bm)
            articles = await _pubmed_search(query, max_results=max_studies_per_biomarker)

        for article in articles:
            extracted = await _extract_range_from_abstract(client, bm, article)
            if extracted is None:
                continue

            record: StudyRecord = {
                "title": article.get("title", ""),
                "authors": article.get("authors", ""),
                "journal": article.get("journal", ""),
                "year": article.get("year", ""),
                "pmid": article.get("pmid", ""),
                "article_url": article.get("article_url", ""),
                "source": article.get("source", "unknown"),
                "query_biomarker": bm,
                "extracted": extracted,
            }
            all_records.append(record)
            log.info(
                "range_extracted",
                biomarker=bm,
                confidence=extracted.get("confidence"),
                range=f"{extracted.get('low')}–{extracted.get('high')} {extracted.get('unit')}",
            )

    log.info("scrape_complete", total_records=len(all_records))

    # Write outputs
    _append_to_scrape_md(all_records, dry_run=dry_run)
    await _regenerate_scraped_ranges(client, all_records, dry_run=dry_run)

    print(f"Scrape agent finished. {len(all_records)} records processed.")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Parse CLI args and run the agent."""
    parser = argparse.ArgumentParser(
        description="Pulse scrape agent — update blood work reference ranges from peer-reviewed literature.",
    )
    parser.add_argument(
        "--tests", "-t",
        type=str,
        default=None,
        help="Comma-separated biomarker names to process (default: all). "
             f"Available: {', '.join(BIOMARKER_QUERIES.keys())}",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Print what would be written without modifying any files.",
    )
    parser.add_argument(
        "--max-studies", "-m",
        type=int,
        default=2,
        help="Maximum studies to process per biomarker (default: 2).",
    )
    args = parser.parse_args()

    biomarkers: list[str] | None = None
    if args.tests:
        biomarkers = [t.strip() for t in args.tests.split(",") if t.strip()]

    asyncio.run(run(
        biomarkers=biomarkers,
        dry_run=args.dry_run,
        max_studies_per_biomarker=args.max_studies,
    ))


if __name__ == "__main__":
    main()
