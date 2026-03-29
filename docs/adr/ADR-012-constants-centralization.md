# ADR-012: Constants Centralization in utils/constants.py

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Model names `"claude-sonnet-4-6"` and `"claude-haiku-4-5-20251001"` were hardcoded as string literals in more than six backend files. Timeout values, token limits, retry counts, and RAG retrieval depth (`RAG_TOP_K`) were likewise scattered across modules with no single source of truth. Upgrading a model or tuning a performance parameter required a grep-and-replace across the entire codebase, with a high risk of missing an occurrence and introducing silent inconsistencies.

## Decision

A single `utils/constants.py` module defines all shared configuration constants:

- `CLAUDE_SONNET` and `CLAUDE_HAIKU` — canonical Anthropic model identifiers.
- `MAX_TOKENS_CHAT`, `MAX_TOKENS_ANALYSIS`, `MAX_TOKENS_SHORT` — per-use-case token budgets.
- `TIMEOUT_SECONDS` — default HTTP timeout for all outbound scraper requests.
- `MAX_RETRIES` — tenacity retry ceiling used by all retry-decorated functions.
- `RAG_TOP_K` — number of RAG snippets injected into each LLM prompt.

All modules import from `utils.constants`; no module may hardcode these values locally.

## Alternatives Considered

1. **Environment variables for model names** — Allows runtime overrides without code changes, but model names are not operational secrets and environment-variable sprawl makes the configuration harder to audit and version-control.
2. **`config.py` with Pydantic Settings** — Appropriate when values must be overridden per environment (dev/staging/prod) via `.env` files; the current constants are intentionally uniform across environments.
3. **Each module owns its constants** — Maximises module autonomy but is exactly the anti-pattern that caused the original duplication problem.

## Consequences

**Positive:** A model upgrade is a single-line change in one file; token and timeout tuning is immediately visible to all consumers; code review for a model change is trivial.

**Negative / Trade-offs:** Modules are now coupled to `utils.constants`. A constant moved or renamed without updating all imports causes an `ImportError` at startup rather than a silent wrong value.

## Implementation Notes

- File location: `backend/utils/constants.py`.
- Constants are module-level `str` / `int` / `float` — no class wrapper needed.
- Import pattern: `from utils.constants import CLAUDE_SONNET, MAX_TOKENS_CHAT`.
- When adding a constant, check that no existing module still hardcodes the equivalent literal (CI lint rule recommended).

## Compliance & Safety

- Model names must be reviewed against Anthropic's current API catalogue before each release to ensure deprecated identifiers are not silently falling back to a default.
- `MAX_TOKENS_*` values affect cost; changes should be accompanied by a cost-impact note in the commit message.
