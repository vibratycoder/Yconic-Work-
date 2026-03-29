# ADR-002: Health RAG Pipeline for Evidence-Grounded Medical Responses

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Pulse engineering team

## Context

Claude's training knowledge has a cutoff date and does not cite sources, making it unsuitable as a standalone basis for health guidance where users may act on the information. Pulse requires responses grounded in current, peer-reviewed medical literature to reduce hallucination risk and increase user trust. A Retrieval-Augmented Generation (RAG) pipeline was needed that could fetch real academic evidence at query time, rank it by quality, and inject it into the Claude prompt before the final answer is generated.

## Decision

Implement a multi-stage Health RAG pipeline that expands the user's question into diverse academic queries using Claude Haiku, retrieves papers in parallel from Semantic Scholar and OpenAlex, grades evidence using OCEBM 2011 levels, applies composite scoring, and injects a formatted evidence block into the Claude Sonnet system prompt before generating the final user-facing response.

The pipeline consists of seven sequential stages:

1. **Query expansion** — Claude Haiku (`claude-haiku-4-5-20251001`) generates 3 academically framed queries targeting clinical, mechanistic, and epidemiological angles from the user's natural-language question.
2. **Parallel retrieval** — 6 concurrent `aiohttp` requests (3 queries × 2 sources) fetch papers from Semantic Scholar (200M+ papers) and OpenAlex (250M+ works), with `tenacity` retry logic on transient failures.
3. **Abstract reconstruction** — OpenAlex returns abstracts as inverted indexes (`word → [positions]`); the pipeline reconstructs full abstract text before further processing.
4. **Evidence grading** — Each paper is assigned an OCEBM 2011 level (1–5) inferred from title/abstract keywords: systematic reviews and meta-analyses = 1, RCTs = 2, cohort studies = 3, case-control studies = 4, expert opinion/narrative review = 5.
5. **Composite scoring** — Papers are ranked by a weighted score: 50% evidence quality (inverted OCEBM level), 30% citation count (log-normalized to reduce bias toward older highly-cited work), 20% recency (papers older than 10 years receive a penalty).
6. **Context building** — Top-N ranked papers are formatted into a structured evidence block with star ratings (★–★★★★★), OCEBM level label, source, authors/year/journal, TLDR summary, and an abstract excerpt capped at 600 characters.
7. **Prompt injection** — The evidence block is prepended to the Claude Sonnet system prompt; a citation instruction directs Claude to reference papers inline as [1], [2], etc.

If all retrieval attempts fail, the pipeline returns an empty evidence block and Claude answers from training knowledge, ensuring graceful degradation without hard failures.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Single retrieval source (PubMed only) | PubMed's coverage is strong for clinical medicine but weak for basic science and epidemiology; using two large cross-disciplinary sources (Semantic Scholar + OpenAlex) increases recall across query types |
| Vector database semantic search over a local corpus | Requires maintaining an up-to-date corpus ingestion pipeline, significant storage infrastructure, and embedding costs; live API retrieval provides fresher literature without operational overhead |
| Single query per user question | A single query rarely captures all relevant angles of a medical question; multi-query expansion with targeted academic framings (clinical, mechanism, epidemiology) improves recall of diverse high-quality papers |
| Use Claude Sonnet for query expansion | Haiku is materially cheaper and faster for the structured expansion task, which does not require deep reasoning; reserving Sonnet for the final answer optimises cost and latency |
| Simple recency-only or citation-only ranking | Citation count alone favours older landmark papers over recent evidence; recency alone favours preprints and weak studies; the composite score with OCEBM grading as the dominant factor (50%) reflects clinical evidence standards more faithfully |
| Fail hard when retrieval is unavailable | Hard failures would block all health responses during API outages; graceful degradation to training-knowledge fallback preserves user experience while the absence of an evidence block signals lower certainty |

## Consequences

### Positive
- Responses are grounded in real, citable peer-reviewed literature, reducing hallucination risk on factual medical claims.
- OCEBM-based evidence grading surfaces systematic reviews and RCTs above anecdotal or expert-opinion papers, aligning with clinical best practices.
- Parallel retrieval across two large APIs (450M+ combined works) with query expansion maximises the chance of finding relevant high-quality evidence within a single request latency budget.
- Inline citations ([1], [2]) allow users and clinicians to verify claims directly against source abstracts.
- Haiku/Sonnet split keeps pipeline cost low: query expansion (the high-volume step) uses the cheapest capable model.
- Graceful degradation means no hard dependency on third-party API availability.

### Negative / Trade-offs
- Pipeline adds latency: query expansion + 6 parallel HTTP requests + reranking occur before the final LLM call. P95 latency will be higher than a direct Sonnet call.
- OCEBM level is inferred heuristically from keywords, not parsed from structured metadata; misclassification is possible for papers with atypical abstracts.
- Semantic Scholar and OpenAlex abstract coverage is incomplete; some papers are indexed without full abstracts, reducing context quality for those results.
- Log-normalised citation counts still favour well-known papers; niche but highly relevant recent work may be underweighted.
- The 600-character abstract excerpt truncates detail; full-text retrieval is not performed, so nuanced methodology is not available to Claude.
- Two external API dependencies introduce operational risk; rate limits or schema changes at either provider require pipeline maintenance.

## Implementation Notes

Key files:
- `backend/rag/health_rag.py` — top-level pipeline orchestrator; coordinates all stages and handles the empty-evidence fallback
- `backend/rag/query_expander.py` — Haiku-based query expansion; produces 3 queries (clinical, mechanism, epidemiology) as structured output
- `backend/rag/sources/semantic_scholar.py` — aiohttp client for Semantic Scholar Academic Graph API; handles pagination and field selection
- `backend/rag/sources/openalex.py` — aiohttp client for OpenAlex API; includes inverted-index abstract reconstruction logic
- `backend/rag/reranker.py` — OCEBM keyword classifier and composite scorer (50/30/20 weight split)
- `backend/rag/context_builder.py` — formats ranked papers into the evidence block with star ratings and structured citation metadata

API surface:
- `POST /api/health-rag/query` — accepts `{ question: string, top_n: int }`, returns the evidence block and the grounded Claude response
- Claude Code slash command `/health-rag` via `~/.claude/commands/health-rag.md` for developer-side querying during development

Retry logic: all aiohttp calls are wrapped with `tenacity` (`wait_exponential`, `stop_after_attempt=3`) to handle transient 429/5xx responses from both APIs.

Model identifiers: query expansion uses `claude-haiku-4-5-20251001`; final answer generation uses the project-standard Claude Sonnet model configured in the backend settings.

## Compliance & Safety

- **Emergency triage gate**: per project non-negotiables, `check_emergency()` is called before the RAG pipeline executes. If a user's question matches an emergency pattern (e.g., chest pain radiating to left arm), the pipeline is bypassed and the emergency response is returned immediately. The RAG pipeline must never delay or replace emergency triage.
- **No PII in retrieval queries**: query expansion must not forward user-identifying information (name, DOB, account ID) to third-party academic APIs. Queries must be de-identified clinical/semantic questions only.
- **Evidence is informational, not diagnostic**: the injected system prompt must include a disclaimer instructing Claude that retrieved evidence is for informational grounding only, and that the response does not constitute medical advice or replace professional clinical judgment.
- **Source integrity**: only peer-reviewed academic sources indexed by Semantic Scholar or OpenAlex are injected. Web scraping of non-academic sources is not permitted within this pipeline.
- **Audit logging**: all RAG queries, retrieved DOIs, assigned OCEBM levels, and composite scores must be logged via `utils/logger.py` structured logging for auditability. No `print()` statements.
- **Data retention**: retrieved abstracts are used ephemerally per request and must not be stored in Supabase or any persistent store, as downstream licensing terms for abstract text vary by publisher.
