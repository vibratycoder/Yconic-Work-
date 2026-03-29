# ADR-011: RAG Source Registry Pattern

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

The health RAG pipeline needs to query multiple academic and authoritative sources — Semantic Scholar, OpenAlex, ClinicalTrials.gov, FDA openFDA, RxNorm, and MedlinePlus — in parallel. Without a deliberate integration pattern, adding or removing sources risks tight coupling to a central dispatcher, making each source hard to test in isolation and increasing the blast radius of a single source failure.

## Decision

Each source is implemented as a standalone async module (e.g., `scrapers/clinicaltrials.py`, `scrapers/fda_drugs.py`) that exposes one primary async function and returns typed dataclasses. `health_rag.py` fans out to all sources using `asyncio.gather(..., return_exceptions=True)`, collects results, filters out exceptions, and merges them into a ranked context block. No abstract base class or plugin registry is required because the fan-out list in `health_rag.py` is the registry.

## Alternatives Considered

1. **Abstract base class with `register()` decorator** — Provides a formal plugin contract but adds boilerplate for every source and makes the call graph implicit. The small, fixed number of sources does not justify the overhead.
2. **Single unified client** — A monolithic client that handles all sources internally is simpler initially but becomes a maintenance bottleneck; one broken source or API change affects the whole class.
3. **Plugin system (importlib entry points)** — Maximum extensibility for third-party sources, but far exceeds current requirements and complicates deployment and testing.

## Consequences

**Positive:** Each scraper module is independently testable; a new source is added by creating one file and appending one coroutine to the `gather()` call; a failing source is isolated and logged without blocking the others.

**Negative / Trade-offs:** The `gather()` call in `health_rag.py` is the implicit registry — it must be updated manually when sources are added or removed. There is no auto-discovery.

## Implementation Notes

- Each source module lives in `backend/scrapers/`.
- The return type contract is a `list[dict]` with keys `title`, `snippet`, `url`, and optional `source` — enforced by the caller, not a base class.
- `asyncio.gather(..., return_exceptions=True)` ensures a timeout or HTTP error from one source never raises to the caller.
- Adding a new source: create `scrapers/<name>.py`, implement `async def fetch_<name>(query: str) -> list[dict]`, add to the `gather()` in `health_rag.py`.

## Compliance & Safety

- Each scraper must respect the rate limits and terms of service of its upstream API.
- No user PII is sent to external APIs; only the anonymised query string is transmitted.
- Source attribution must be preserved in returned snippets so the LLM can cite original references.
