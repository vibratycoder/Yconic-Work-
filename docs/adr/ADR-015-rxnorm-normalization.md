# ADR-015: RxNorm Drug Name Normalization

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Users enter drug names in highly variable forms: brand names ("Tylenol"), generic names ("acetaminophen"), abbreviations ("APAP"), partial names ("amox"), or misspellings ("ibuprophen"). This variability causes FDA drug label lookups and drug interaction checks to silently fail when the search string does not exactly match an API's indexed name. Without normalisation, the reliability of any drug-name-dependent feature is proportional to how carefully the user types.

## Decision

A `normalize_drug_name(name: str) -> str | None` function in `utils/rxnorm.py` calls the NLM RxNav REST API (`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=<name>&search=1`) to obtain a canonical RxCUI, then resolves that RxCUI to the official display name via a second call (`/REST/rxcui/<id>/property.json?propName=RxNorm%20Name`). The normalised name is returned as a string; `None` is returned if the drug is not found in RxNorm. All downstream drug lookups (FDA, interaction checks) call this function first.

## Alternatives Considered

1. **Fuzzy string matching** — Libraries like `rapidfuzz` can match approximate names against a local list, but maintaining a comprehensive, up-to-date local drug list is operationally expensive and still fails for brand-name-to-generic resolution.
2. **NLP entity extraction** — A named-entity recognition model (e.g., scispaCy with the `en_ner_bc5cdr_md` model) can extract drug mentions from free text but is overkill for the normalisation-only use case and adds a heavy dependency.
3. **Hardcoded alias table** — A curated `Dict[str, str]` covers common brand names but is immediately incomplete, requires ongoing manual maintenance, and cannot handle misspellings or new drugs.

## Consequences

**Positive:** Consistent normalisation across FDA lookups and drug interaction checks; brand-name to generic resolution is handled authoritatively; RxNorm is freely maintained by NLM and updated monthly.

**Negative / Trade-offs:** Two serial HTTP calls add approximately 200 ms of latency per drug name; this is acceptable on non-emergency paths (visit prep, drug check) but must never be on the critical path of emergency triage. If RxNav is unavailable, the function must fall back to returning the original input string rather than blocking the request.

## Implementation Notes

- Module: `backend/utils/rxnorm.py`.
- Use `aiohttp` for async HTTP; both calls can be made with the shared `TIMEOUT_SECONDS` constant.
- Cache normalised results in a module-level `dict[str, str]` LRU cache (`functools.lru_cache` on a sync wrapper, or `aiocache` for async) to avoid redundant network calls within a single request lifecycle.
- The function must be called in `drug_check.py` and `fda_drugs.py` — never skipped to "save time".
- Return type is `str | None`; callers must handle `None` explicitly (do not pass `None` to downstream APIs).

## Compliance & Safety

- RxNorm is a US government resource (NLM/NIH); no API key or licensing fee is required.
- Drug name normalisation must never alter warnings or contraindication text — only the lookup key is normalised; all retrieved content is used verbatim.
- If normalisation fails (returns `None`), the feature must degrade gracefully with a user-visible note that the drug name could not be verified, rather than silently using an unverified name.
