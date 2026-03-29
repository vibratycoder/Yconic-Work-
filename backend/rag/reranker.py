"""Evidence grading and composite re-ranking for retrieved health papers.

Implements the Oxford Centre for Evidence-Based Medicine (OCEBM) 2011
levels of evidence for study classification, combined with citation-count
and recency signals into a single composite score used to rank papers
before context assembly.

Scoring formula
---------------
composite = (
    EVIDENCE_WEIGHT   * evidence_score   +   # study design quality (0–1)
    CITATION_WEIGHT   * citation_score   +   # impact / replication signal (0–1)
    RECENCY_WEIGHT    * recency_score        # how current the work is (0–1)
)

where:
  evidence_score  = (MAX_LEVEL - level) / (MAX_LEVEL - 1)   # higher level → lower score
  citation_score  = min(log10(citations + 1) / log10(1000), 1.0)
  recency_score   = max(0, 1 - (current_year - pub_year) / 10)

Weights sum to 1.0.  Evidence quality is the dominant signal (50 %).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from typing import Union

from backend.rag.sources.openalex import OpenAlexWork
from backend.rag.sources.semantic_scholar import ScholarPaper
from backend.utils.logger import get_logger

log = get_logger(__name__)

# ── Oxford OCEBM evidence levels ────────────────────────────────────────────

EVIDENCE_LEVEL_LABELS: dict[int, str] = {
    1: "Systematic Review / Meta-Analysis",
    2: "Randomised Controlled Trial",
    3: "Cohort / Prospective Study",
    4: "Case-Control / Cross-Sectional",
    5: "Case Series / Expert Opinion",
}

# Publication-type strings → OCEBM level
_TYPE_TO_LEVEL: dict[str, int] = {
    # Level 1
    "meta-analysis":             1,
    "systematic review":         1,
    "cochrane":                  1,
    # Level 2
    "randomized controlled trial": 2,
    "randomised controlled trial": 2,
    "rct":                        2,
    "clinical trial":             2,
    "controlled clinical trial":  2,
    # Level 3
    "cohort":                    3,
    "prospective":               3,
    "longitudinal":              3,
    "comparative study":         3,
    # Level 4
    "case-control":              4,
    "case control":              4,
    "cross-sectional":           4,
    "observational":             4,
    # Level 5
    "review":                    5,
    "editorial":                 5,
    "letter":                    5,
    "case report":               5,
    "case series":               5,
}

_MAX_LEVEL = 5

# Scoring weights — must sum to 1.0
EVIDENCE_WEIGHT = 0.50
CITATION_WEIGHT = 0.30
RECENCY_WEIGHT  = 0.20

AnyPaper = Union[ScholarPaper, OpenAlexWork]


@dataclass
class RankedPaper:
    """
    A retrieved paper enriched with grading metadata and a composite score.

    Attributes:
        paper: Original source paper object (ScholarPaper or OpenAlexWork).
        evidence_level: OCEBM level 1–5 (1 = highest quality).
        evidence_label: Human-readable label for the evidence level.
        composite_score: Weighted composite quality score in [0, 1].
        evidence_score: Component score for study design quality.
        citation_score: Component score for citation impact.
        recency_score: Component score for publication recency.
        dedup_key: Normalised deduplication key (doi or lower-case title).
    """

    paper: AnyPaper
    evidence_level: int
    evidence_label: str
    composite_score: float
    evidence_score: float
    citation_score: float
    recency_score: float
    dedup_key: str

    # Convenience pass-throughs
    @property
    def title(self) -> str:
        """Return the paper title."""
        return self.paper.title

    @property
    def abstract(self) -> str:
        """Return the paper abstract."""
        return self.paper.abstract

    @property
    def year(self) -> int | None:
        """Return the publication year."""
        return self.paper.year

    @property
    def citation_count(self) -> int:
        """Return the citation count."""
        return self.paper.citation_count

    @property
    def authors(self) -> str:
        """Return formatted author string."""
        return self.paper.display_authors

    @property
    def doi(self) -> str | None:
        """Return the DOI if available."""
        return self.paper.doi

    @property
    def pmid(self) -> str | None:
        """Return the PubMed ID if available."""
        return self.paper.pmid

    @property
    def journal(self) -> str | None:
        """Return the journal name if available."""
        return self.paper.journal

    @property
    def source_label(self) -> str:
        """Return the source database label."""
        return self.paper.source_label

    @property
    def tldr(self) -> str | None:
        """Return the AI-generated TLDR if available (Semantic Scholar only)."""
        return getattr(self.paper, "tldr", None)


def _classify_evidence_level(paper: AnyPaper) -> int:
    """
    Classify a paper into an OCEBM evidence level (1–5).

    Checks publication type tags (Semantic Scholar) or work_type
    (OpenAlex) against the ``_TYPE_TO_LEVEL`` mapping.  Defaults to
    level 4 if no recognised type is found.

    Args:
        paper: A ScholarPaper or OpenAlexWork instance.

    Returns:
        Integer evidence level 1–5 (1 = best evidence).
    """
    tags: list[str] = []
    if isinstance(paper, ScholarPaper):
        tags = [t.lower() for t in paper.publication_types]
    elif isinstance(paper, OpenAlexWork):
        tags = [paper.work_type.lower()]
        # OpenAlex abstract often contains study type clues
        abstract_lower = paper.abstract.lower()
        if "meta-analysis" in abstract_lower or "systematic review" in abstract_lower:
            return 1
        if "randomized" in abstract_lower or "randomised" in abstract_lower:
            return 2

    for tag in tags:
        for key, level in _TYPE_TO_LEVEL.items():
            if key in tag:
                return level

    return 4  # default: observational / unknown


def _compute_scores(
    paper: AnyPaper,
    evidence_level: int,
    current_year: int,
) -> tuple[float, float, float]:
    """
    Compute the three component scores for a paper.

    Args:
        paper: Source paper object.
        evidence_level: OCEBM level 1–5.
        current_year: Reference year for recency calculation.

    Returns:
        Tuple of (evidence_score, citation_score, recency_score) each in [0, 1].
    """
    # Evidence score: level 1 → 1.0, level 5 → 0.0
    evidence_score = (_MAX_LEVEL - evidence_level) / (_MAX_LEVEL - 1)

    # Citation score: log scale, 1000+ citations → 1.0
    citations = max(paper.citation_count, 0)
    citation_score = min(math.log10(citations + 1) / math.log10(1000), 1.0)

    # Recency score: linear decay over 10 years, older → 0.0
    pub_year = paper.year or (current_year - 10)
    recency_score = max(0.0, 1.0 - (current_year - pub_year) / 10.0)

    return evidence_score, citation_score, recency_score


def _make_dedup_key(paper: AnyPaper) -> str:
    """
    Generate a normalised deduplication key for a paper.

    Prefers DOI (canonical), then PMID, then lowercased title prefix.

    Args:
        paper: Source paper object.

    Returns:
        String deduplication key.
    """
    if paper.doi:
        return f"doi:{paper.doi.lower().strip()}"
    if paper.pmid:
        return f"pmid:{paper.pmid.strip()}"
    # Fallback: first 80 chars of normalised title
    title_key = " ".join(paper.title.lower().split())[:80]
    return f"title:{title_key}"


def rank_papers(
    papers: list[AnyPaper],
    max_results: int = 12,
) -> list[RankedPaper]:
    """
    Grade, deduplicate, and rank a mixed list of retrieved papers.

    Pipeline:
    1. Classify each paper into an OCEBM evidence level
    2. Compute composite score (evidence + citation + recency)
    3. Deduplicate by DOI / PMID / title — keep highest-scoring copy
    4. Sort descending by composite score
    5. Return top ``max_results``

    Args:
        papers: Mixed list of ScholarPaper and OpenAlexWork objects.
        max_results: Maximum number of ranked papers to return.

    Returns:
        List of RankedPaper objects sorted by composite_score descending.
    """
    current_year = date.today().year
    seen: dict[str, RankedPaper] = {}

    for paper in papers:
        if not paper.title or not paper.abstract:
            continue

        level = _classify_evidence_level(paper)
        ev_score, cit_score, rec_score = _compute_scores(paper, level, current_year)
        composite = (
            EVIDENCE_WEIGHT * ev_score
            + CITATION_WEIGHT * cit_score
            + RECENCY_WEIGHT  * rec_score
        )

        ranked = RankedPaper(
            paper=paper,
            evidence_level=level,
            evidence_label=EVIDENCE_LEVEL_LABELS.get(level, "Unknown"),
            composite_score=round(composite, 4),
            evidence_score=round(ev_score, 4),
            citation_score=round(cit_score, 4),
            recency_score=round(rec_score, 4),
            dedup_key=_make_dedup_key(paper),
        )

        key = ranked.dedup_key
        if key not in seen or composite > seen[key].composite_score:
            seen[key] = ranked

    ranked_list = sorted(seen.values(), key=lambda r: r.composite_score, reverse=True)
    top = ranked_list[:max_results]

    log.info(
        "reranker_complete",
        input_count=len(papers),
        unique_count=len(seen),
        top_count=len(top),
        best_score=top[0].composite_score if top else 0,
        best_level=top[0].evidence_level if top else None,
    )
    return top
