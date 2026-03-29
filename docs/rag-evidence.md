# RAG Evidence Retrieval

Standalone multi-source academic evidence pipeline. Retrieves, grades, and ranks peer-reviewed papers for a health question.

## Entry point

```
POST /api/health-rag/query
```

Also integrated into the chat flow via `get_citations_for_question()` in `backend/evidence/pubmed.py` (simpler, 3-citation path).

## Full RAG pipeline

**Files:** `backend/rag/`

```
Health question + optional patient context
         │
         ▼
query_expander.py — Claude Haiku expands to 3 queries
  1. Clinical outcomes angle
  2. Mechanism / pathophysiology angle
  3. Epidemiology / risk factor angle
         │
         ▼
Parallel HTTP requests (up to 6 concurrent)
  ├── Semantic Scholar  (semantic_scholar.py)
  └── OpenAlex          (openalex.py)
  For each of the 3 expanded queries
         │
         ▼
Deduplicate by DOI / title
         │
         ▼
reranker.py — Score and rank papers
  Oxford OCEBM evidence grading (1–5)
  Composite score = quality(50%) + citations(30%) + recency(20%)
         │
         ▼
context_builder.py — Format top-N papers as evidence block
         │
         ▼
Return ranked papers + evidence block for system prompt injection
```

## Query expansion

**File:** `backend/rag/query_expander.py`

Claude Haiku receives the question and returns 3 semantically diverse search strings targeting different angles of the same topic. This increases recall across search APIs that respond well to specific phrasing.

## Sources

### Semantic Scholar (`backend/rag/sources/semantic_scholar.py`)
- Free academic search API
- Returns title, abstract, authors, year, citation count, DOI

### OpenAlex (`backend/rag/sources/openalex.py`)
- Open scholarly database (100M+ papers)
- Returns similar fields plus open-access PDF links where available

## Evidence grading

**File:** `backend/rag/reranker.py`

Oxford Centre for Evidence-Based Medicine (OCEBM) levels:

| Level | Study type |
|-------|-----------|
| 1 | Systematic review or meta-analysis |
| 2 | Randomised controlled trial |
| 3 | Cohort or case-control study |
| 4 | Case series or case report |
| 5 | Expert opinion or narrative review |

Papers with high citation counts and recent publication dates score higher in the composite ranking.

## Chat-flow citation path (simpler)

For the main chat endpoint, `get_citations_for_question()` in `backend/evidence/pubmed.py` uses a lighter approach:
1. Try Google Scholar for the health domain query
2. Fall back to PubMed E-utilities if Scholar fails
3. Return up to 3 `Citation` objects

Citations are injected as `PEER-REVIEWED EVIDENCE` blocks in the system prompt, with PMIDs for the model to cite naturally in its response.

## Files

| File | Role |
|------|------|
| `backend/rag/health_rag.py` | Main RAG orchestrator |
| `backend/rag/query_expander.py` | 3-angle query expansion via Claude Haiku |
| `backend/rag/reranker.py` | OCEBM grading + composite scoring |
| `backend/rag/context_builder.py` | Format evidence block for system prompt |
| `backend/rag/sources/semantic_scholar.py` | Semantic Scholar API client |
| `backend/rag/sources/openalex.py` | OpenAlex API client |
| `backend/evidence/pubmed.py` | Simpler 3-citation path for chat flow |
| `backend/evidence/query_builder.py` | Health domain classifier |
| `backend/evidence/citation_formatter.py` | Citation → prompt block formatting |
