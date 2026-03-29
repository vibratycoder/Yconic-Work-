# ADR-017: Shared Parsing Utilities in utils/parsing.py

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Two parsing operations recurred across multiple backend modules with subtly different, inconsistent implementations:

1. **ISO date parsing** — `datetime.fromisoformat()` in Python < 3.11 does not accept the `Z` UTC suffix or `+00:00` timezone offsets produced by Supabase; each module that needed a `date` object worked around this differently.
2. **JSON extraction from LLM output** — Claude occasionally wraps JSON in markdown fences (` ```json ... ``` `) or includes a preamble sentence before the object; calling `json.loads()` directly on raw LLM output fails unpredictably.

Both problems were solved independently in at least three modules each, producing divergent error-handling behaviour and a maintenance burden.

## Decision

A single `utils/parsing.py` module exposes two functions:

- `parse_iso_date(value: str) -> date | None` — strips any timezone suffix (everything from `+` or `Z` onward) before passing to `datetime.fromisoformat()`, returns `None` on any `ValueError`.
- `extract_json(text: str) -> dict | list | None` — first tries `json.loads(text.strip())`; on failure, scans the string for the first `{` or `[` delimiter and attempts to parse from that position; returns `None` if all attempts fail.

Both functions absorb exceptions internally and return `None` rather than raising, so callers handle one sentinel value instead of multiple exception types.

## Alternatives Considered

1. **`dateutil.parser` (third-party)** — `python-dateutil` handles a wide range of date string formats including timezone-aware ISO strings, but introduces a dependency for a problem that is fully solvable with four lines of stdlib code.
2. **Require callers to handle their own parsing** — Keeps modules independent but perpetuates duplicated, inconsistent logic; the next developer to add a new endpoint will re-solve the same problem a fourth time.
3. **Regex for JSON extraction** — A regex like `\{.*\}` with `re.DOTALL` can locate a JSON block, but nested objects with closing braces make regex-based extraction unreliable; the delimiter-scan approach is simpler and more correct.

## Consequences

**Positive:** A single tested implementation eliminates divergent behaviour; `extract_json` is the canonical, mandatory path for parsing all Claude JSON responses; future LLM output format changes are fixed in one place.

**Negative / Trade-offs:** `extract_json` returning `None` shifts the burden of handling a failed parse to the caller, which must explicitly check and decide on a fallback — this is intentional but requires discipline.

## Implementation Notes

- Module: `backend/utils/parsing.py`.
- `extract_json()` must be used in `lab_analysis.py`, `document_classifier.py`, `visit_prep.py`, and any future module that calls the Anthropic SDK and expects a JSON response — `json.loads()` directly on LLM output is prohibited.
- `parse_iso_date()` is used in `health_profile.py` and any module that reads date fields from Supabase rows.
- Both functions must have full docstrings and type annotations per project non-negotiables.
- Unit tests covering the timezone-suffix strip and the markdown-fence JSON extraction cases are mandatory.

## Compliance & Safety

- Parsing failures in safety-critical paths (e.g., drug interaction date checks) must log a structured warning via `utils/logger.py` and surface a degraded response to the user rather than silently returning stale or incorrect data.
- `extract_json` must never be used to parse emergency triage output — emergency checks use string matching, not JSON, to eliminate any parsing failure mode on the critical safety path.
