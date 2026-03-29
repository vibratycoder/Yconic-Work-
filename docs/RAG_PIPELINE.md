# RAG Pipeline

## Overview

The Pulse RAG (Retrieval-Augmented Generation) pipeline retrieves peer-reviewed academic evidence and injects it into the Claude system prompt before every health question is answered. This grounds every response in the published literature rather than relying on the model's parametric knowledge alone.

The pipeline is implemented in `backend/rag/` and orchestrated by `backend/rag/health_rag.py`.

---

## Pipeline Stages

```
User question
      │
      ▼
┌─────────────────────────┐
│  1. Query Expansion      │  Claude Haiku → 3 academic search queries
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  2. Parallel Retrieval   │  6 async tasks (up to 2 sources × 3 queries)
│  Semantic Scholar        │  per query, returning ScholarPaper objects
│  OpenAlex                │  per query, returning OpenAlexWork objects
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  3. OCEBM Reranking      │  Grade + deduplicate + composite-score + top-N
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  4. Context Builder      │  Format top papers into evidence block text
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  5. Prompt Injection     │  Evidence block prepended to Claude system prompt
└─────────────────────────┘
```

---

## Stage 1 — Query Expansion

**File:** `backend/rag/query_expander.py`

The user's natural-language question is passed to Claude Haiku (`CLAUDE_HAIKU` constant) with an optional patient context snippet (conditions, medications, age, sex — no PII). Haiku generates **3 diverse academic search queries** optimised for database retrieval (MeSH-style terms, Boolean operators).

- Max tokens: `MAX_TOKENS_QUERY_EXPAND` (256)
- Output: `list[str]` with exactly 3 queries
- Patient context must not include identifying information

---

## Stage 2 — Parallel Retrieval

**File:** `backend/rag/health_rag.py`

All source queries run concurrently using `asyncio.gather`. The two primary academic sources each receive all 3 expanded queries:

```
3 × search_semantic_scholar(q)   →  up to 3 × PAPERS_PER_SOURCE results
3 × search_openalex(q)           →  up to 3 × PAPERS_PER_SOURCE results
= up to 6 concurrent HTTP requests
```

`PAPERS_PER_SOURCE` is set to `10` in `utils/constants.py`.

Each source client handles its own retries via `tenacity`. A source failure returns an empty list — partial results are still ranked. The `sources_used` set in `HealthRAGResult` tracks which sources contributed papers.

---

## Stage 3 — OCEBM Reranking

**File:** `backend/rag/reranker.py`

### Composite Scoring Formula

Each paper receives a composite score combining three weighted signals:

```
composite = (0.50 × evidence_score) + (0.30 × citation_score) + (0.20 × recency_score)
```

Where:

| Component | Formula | Description |
|-----------|---------|-------------|
| `evidence_score` | `(5 - level) / 4` | OCEBM level normalised to [0, 1]; Level 1 → 1.0, Level 5 → 0.0 |
| `citation_score` | `min(log10(citations + 1) / log10(1000), 1.0)` | Log-scale citation impact; 1000+ citations → 1.0 |
| `recency_score` | `max(0, 1 - (current_year - pub_year) / 10)` | Linear decay over 10 years; papers older than 10 years → 0.0 |

Evidence quality is the dominant signal at 50%. The weights sum to 1.0.

### OCEBM Evidence Levels

| Level | Label | Study Types |
|-------|-------|-------------|
| 1 | Systematic Review / Meta-Analysis | Meta-analysis, systematic review, Cochrane review |
| 2 | Randomised Controlled Trial | RCT, clinical trial, controlled clinical trial |
| 3 | Cohort / Prospective Study | Cohort, prospective, longitudinal, comparative study |
| 4 | Case-Control / Cross-Sectional | Case-control, cross-sectional, observational |
| 5 | Case Series / Expert Opinion | Review article, editorial, letter, case report, case series |

Papers with unrecognised publication types default to Level 4.

### Deduplication

Papers are deduplicated before ranking using a normalised key:
1. DOI (preferred — `doi:<doi>`)
2. PubMed ID (`pmid:<pmid>`)
3. First 80 characters of normalised title (`title:<prefix>`)

When duplicates are found, the highest-scoring copy is kept.

### Output

`rank_papers(papers, max_results=RAG_TOP_K)` returns a sorted `list[RankedPaper]` with `RAG_TOP_K` (default 10) papers.

---

## Stage 4 — Context Builder

**File:** `backend/rag/context_builder.py`

`build_evidence_block(ranked_papers)` formats the top-ranked papers into a structured text block containing:
- OCEBM level and label
- Paper title, authors, journal, year
- Abstract or TLDR
- DOI / PMID for citation
- Composite score (for transparency)

---

## Stage 5 — Prompt Injection

**File:** `backend/rag/health_rag.py`

`inject_evidence_into_system_prompt(base_system_prompt, rag_result)` prepends the evidence block to the Claude system prompt, separated by a horizontal rule. The model reads the literature context before encountering persona and formatting instructions.

The `/api/health-rag/query` endpoint exposes the full pipeline directly for clients that want to inspect the evidence before sending it to Claude.

---

## Data Sources

All 6 sources are documented in detail in [SCRAPING_SOURCES.md](SCRAPING_SOURCES.md). Summary:

| Source | Type | Auth Required | Rate Limit |
|--------|------|--------------|------------|
| Semantic Scholar | Academic papers | Optional API key | 100 req/5 min (unauth) |
| OpenAlex | Academic papers | None | Polite pool via mailto |
| ClinicalTrials.gov | Clinical trials | None | 429 handling |
| FDA openFDA | Drug labels | None | 240 req/min |
| RxNorm (NLM) | Drug terminology | None | No published limit |
| MedlinePlus (NLM) | Consumer health | None | No published limit |

---

## HealthRAGResult

```python
@dataclass
class HealthRAGResult:
    evidence_block: str          # Formatted text for system-prompt injection
    ranked_papers: list[RankedPaper]
    expanded_queries: list[str]  # The 3 academic queries
    total_candidates: int        # Papers retrieved before deduplication
    sources_used: set[str]       # Source database names that returned results
```

---

## Integration with Chat

The `/api/chat` route currently uses the **legacy PubMed evidence layer** (`backend/evidence/pubmed.py`) for citation retrieval. The newer multi-source RAG pipeline is available via `/api/health-rag/query` and can be integrated by replacing the `get_citations_for_question()` call with `retrieve_health_evidence()` and passing the resulting evidence block to `build_health_system_prompt()`.
