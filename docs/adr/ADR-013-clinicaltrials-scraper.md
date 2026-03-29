# ADR-013: ClinicalTrials.gov API v2 Integration

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Clinical trial data surfaces direct, patient-relevant evidence about treatments under investigation — information that peer-reviewed literature searches alone do not reliably surface. Early versions of the RAG pipeline lacked this source, which meant responses to questions like "are there trials for my condition?" required users to leave Sana Health and navigate clinicaltrials.gov manually. Including structured trial data improves response quality for condition-specific and treatment-related queries.

## Decision

Use the ClinicalTrials.gov REST API v2 (`https://clinicaltrials.gov/api/v2/studies`). Queries are filtered by `query.cond` (condition) and paginated. Each result is mapped to a typed dataclass containing: NCT ID, official title, phase, overall status, enrollment count, and the brief summary. Results are returned as `list[ClinicalTrial]` and converted to the standard RAG snippet dict before insertion into the context block.

## Alternatives Considered

1. **Parse ClinicalTrials RSS feeds** — RSS feeds exist but carry only a subset of study metadata and lack structured fields like phase and enrollment; unsuitable for rich context injection.
2. **Third-party aggregator API** — Services like Citeline aggregate trial data but introduce vendor lock-in, usage costs, and an additional failure point; the official API is free and authoritative.
3. **Scrape HTML from clinicaltrials.gov** — HTML scraping is fragile against site redesigns and violates the spirit of the published REST API; the v2 API makes scraping unnecessary.

## Consequences

**Positive:** NCT IDs enable deep-linking so users can navigate directly to a trial's full listing; phase and status fields allow the LLM to distinguish active recruiting trials from completed or terminated ones; no authentication overhead.

**Negative / Trade-offs:** The API enforces an approximate rate limit of ~3 requests per second; the scraper must respect this with per-request delays or backoff. Trial data can be verbose — snippet truncation is required to stay within token budgets.

## Implementation Notes

- Module: `backend/scrapers/clinicaltrials.py`.
- Base URL: `https://clinicaltrials.gov/api/v2/studies?query.cond={condition}&pageSize=5`.
- Use `aiohttp` with the shared `TIMEOUT_SECONDS` constant; wrap with `tenacity` using `MAX_RETRIES`.
- NCT IDs are formatted as deep-link URLs: `https://clinicaltrials.gov/study/{nct_id}`.
- Filter results to `RECRUITING` or `ACTIVE_NOT_RECRUITING` status for highest relevance.

## Compliance & Safety

- ClinicalTrials.gov data is public domain (US federal government); no licensing restrictions apply.
- The LLM prompt must clearly frame trial results as "potentially relevant studies" rather than treatment recommendations — clinical trial eligibility must be assessed by a clinician.
- Trial summaries must never be presented as approved therapies; phase information must always be included in the context passed to the model.
