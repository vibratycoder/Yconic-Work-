# ADR-018: _require_profile() Async Helper Pattern

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Three FastAPI endpoint handlers — `visit_prep`, `drug_check`, and `health_rag` — each contained an identical eight-line block: call `get_health_profile(user_id)` inside a `try/except`, raise `HTTPException(500)` on a database error, and raise `HTTPException(404)` if the returned profile is `None`. This pattern was copied verbatim across all three handlers. Any change to the error message, status code, or logging call required three coordinated edits, and the pattern was guaranteed to be copied again the next time a profile-dependent endpoint was added.

## Decision

Extract the repeated pattern into a private async helper `_require_profile(user_id: str) -> HealthProfile` defined at the top of `main.py`. The function calls `get_health_profile`, wraps the call in a `try/except Exception`, logs the error via `utils/logger.py`, and raises:
- `HTTPException(status_code=500, detail="Failed to load profile")` on any database exception.
- `HTTPException(status_code=404, detail="Profile not found")` when the result is `None`.

Endpoint handlers call `profile = await _require_profile(user_id)` as their first statement.

## Alternatives Considered

1. **FastAPI `Depends()` dependency injection** — The idiomatic FastAPI approach; however, `Depends()` requires `user_id` to be a path or query parameter, which conflicts with endpoints that receive it from a request body. A `Depends()` factory that reads the body would circumvent FastAPI's validation and body-parsing flow.
2. **Profile middleware** — A middleware layer that loads the profile before every request and attaches it to `request.state` would handle the loading uniformly but would run for every endpoint, including those (like `/chat`) that do not require a profile, and would make the 404 behaviour non-obvious.
3. **Per-endpoint error handling** — The status quo. No benefit over the extracted helper; perpetuates code duplication.

## Consequences

**Positive:** A single implementation point for profile-load error handling; adding a new profile-dependent endpoint is one line; the 404/500 distinction is consistently applied and tested once.

**Negative / Trade-offs:** `_require_profile` is a module-level private function in `main.py` rather than a reusable library function — if the pattern is needed in a second router file, it must be promoted to a shared module.

## Implementation Notes

- Location: `backend/main.py`, defined before the first endpoint that uses it.
- The `chat` endpoint intentionally does not use `_require_profile`; it constructs an empty `HealthProfile()` when no profile exists, so new users can chat before completing profile setup.
- The helper must use structured logging: `logger.warning("profile_not_found", user_id=user_id)` and `logger.error("profile_load_error", user_id=user_id, error=str(e))`.
- Type annotation: `async def _require_profile(user_id: str) -> HealthProfile`.

## Compliance & Safety

- A 404 response to an unauthenticated request must not leak whether a user ID exists in the system — the response body should be generic. Authentication middleware (ADR-007) runs before this helper and ensures only authenticated users reach these endpoints.
- Database errors must be logged with a correlation ID so they can be traced in the audit log without exposing internal error details in the HTTP response body.
