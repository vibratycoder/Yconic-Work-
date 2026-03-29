# ADR-016: MedlinePlus Health Topic Scraper

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

The RAG pipeline retrieves primarily peer-reviewed academic literature, which tends to be technical and written for clinicians. Many Pulse users are non-clinical consumers who find dense academic abstracts confusing or inaccessible. Adding plain-language, patient-facing health summaries from a trusted source improves the LLM's ability to answer general health questions in accessible language without sacrificing accuracy.

## Decision

Query the NLM MedlinePlus web search API (`https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=<query>`) and parse the XML response to extract health topic titles and summaries. The scraper returns up to three topic summaries as standard RAG snippet dicts. Results are passed to `health_rag.py` alongside academic citations; the LLM prompt instructs the model to blend patient-facing summaries with peer-reviewed evidence.

## Alternatives Considered

1. **MedlinePlus Connect FHIR API** — The FHIR interface is designed for EHR integration (ICD-10 / SNOMED code lookups) rather than free-text health topic search; it would require mapping user queries to medical codes before retrieval, adding complexity with no benefit for general-purpose queries.
2. **Scrape medlineplus.gov pages** — Direct HTML scraping returns the same content but is fragile to page-structure changes; the web search API provides structured XML specifically intended for programmatic consumption.
3. **Consumer health NLP corpus** — Pre-downloading and embedding a static snapshot of MedlinePlus topics into a local vector store would eliminate the network call but requires periodic refresh, storage, and an embedding pipeline — disproportionate for the value added at this stage.

## Consequences

**Positive:** Plain-language summaries help the model answer questions accessibly; NLM content is editorially reviewed by medical professionals; the web search API is free and does not require authentication.

**Negative / Trade-offs:** XML response parsing adds a dependency on `lxml`; topic coverage is broad but not exhaustive — rare conditions may return zero results. Patient-facing summaries sometimes omit nuance present in academic sources, so they must complement rather than replace peer-reviewed snippets.

## Implementation Notes

- Module: `backend/scrapers/medlineplus.py`.
- Response format: XML with `<nlmSearchResult>` root; topics are in `<list name="HealthTopics"><document>` elements; title is in `<content name="title">`, summary in `<content name="FullSummary">`.
- Use `lxml.etree.fromstring()` for parsing; handle malformed XML with a logged warning and empty return list.
- Limit to top 3 results (`<count>3</count>` in query or slice after parsing) to stay within token budget.
- Show patient-facing summaries in the context block before academic citations to prime the model's tone.

## Compliance & Safety

- MedlinePlus content is produced by NLM/NIH and is in the public domain; no licensing restrictions apply.
- Summaries must not be presented as a substitute for a clinical consultation; the standard disclaimer in the system prompt covers this.
- Health topic content is consumer-oriented and reviewed for accuracy, but is not a substitute for personalised medical advice based on the user's specific profile.
