# ADR-001: Emergency Triage Gate Before Every LLM Call

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Pulse engineering team

## Context

Pulse is an AI health co-pilot that processes user-submitted symptom descriptions and health queries using a large language model. A subset of health queries describe life-threatening emergencies (e.g., chest pain radiating to the left arm, stroke symptoms, anaphylaxis, suicidal ideation) where any delay — including the latency of an LLM API call — could cost a user their life. Relying on the LLM to identify and escalate emergencies is unsafe: models can hallucinate, produce overly verbose responses, experience network timeouts, or be rate-limited. A deterministic, dependency-free safety gate was needed to intercept these queries before any AI processing begins.

## Decision

A pure-Python function `check_emergency()` in `backend/health/injector.py` performs deterministic keyword and pattern matching against the user's message before every LLM call. If the message matches any pattern in the emergency corpus (chest pain radiating to left arm, stroke symptoms, difficulty breathing, suicidal ideation, overdose, anaphylaxis, and similar life-threatening presentations), the function immediately returns a hardcoded `EMERGENCY_RESPONSE` string directing the user to call 911 or go to the nearest emergency room. If no emergency pattern is matched, the function returns `None` and normal processing continues. This check is the first operation executed in the `POST /api/chat` endpoint in `main.py`, before the user's health profile is loaded and before any call to the Anthropic SDK is made. This behavior is a non-negotiable invariant of the codebase — no code path may invoke the LLM without first passing through `check_emergency()`.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Delegate emergency detection to the LLM via a system prompt instruction | Unsafe: LLM responses are non-deterministic, subject to network latency, rate limits, and potential hallucination. A model failure or timeout during an emergency query could delay a life-saving response. |
| Use a fine-tuned classifier model for emergency detection | Adds ML infrastructure complexity and introduces a probabilistic component. A classifier can produce false negatives. The deterministic regex/keyword approach has zero false negatives for the defined pattern set. |
| Implement emergency detection as middleware or a FastAPI dependency | Technically viable, but placing the check explicitly as the first line in the route handler makes the invariant visible and harder to accidentally bypass when adding new endpoints or refactoring middleware stacks. |
| Outsource to a third-party crisis API (e.g., Crisis Text Line API) | Introduces a network dependency. If the external service is down or slow, the safety gate fails. The hardcoded response requires no network call and cannot be degraded by external outages. |

## Consequences

### Positive
- Zero-latency emergency response: the gate executes in microseconds with no I/O, no model loading, and no network calls.
- Deterministic and testable: `check_emergency("chest pain radiating to left arm")` must return the emergency string; `check_emergency("stomach hurts a little")` must return `None`. These are enforceable unit test assertions.
- No dependency on LLM availability: emergencies are handled even during Anthropic API outages, rate-limit exhaustion, or cold-start latency spikes.
- Auditability: the full pattern set lives in a single Python module, making it straightforward to review, extend, and audit.
- Liability reduction: demonstrating that a hardcoded, LLM-bypass safety gate exists and runs unconditionally is a meaningful technical safeguard in any regulatory or legal review.

### Negative / Trade-offs
- Pattern maintenance burden: the keyword/regex corpus must be manually maintained. New emergency presentations not in the pattern set will not be caught by this gate and will fall through to the LLM.
- No nuance: the gate cannot distinguish "my friend had chest pain last year" from "I am having chest pain right now." Overly broad patterns may produce false positives, which is the deliberately conservative choice.
- Single language support: the current pattern set is English-only. Non-English emergency queries will not be intercepted.
- The hardcoded `EMERGENCY_RESPONSE` string cannot be personalised or contextualised — the same message is returned regardless of the specific emergency described.

## Implementation Notes

- Primary function: `check_emergency(message: str) -> str | None` in `backend/health/injector.py`
- Hardcoded response constant: `EMERGENCY_RESPONSE` (defined in the same module), containing instructions to call 911 and go to the nearest emergency room
- Invocation site: `POST /api/chat` in `backend/main.py` — first statement in the route handler body, before profile loading and before any Anthropic SDK call
- Pattern corpus covers at minimum: chest pain radiating to left arm, stroke symptoms (sudden facial drooping, arm weakness, speech difficulty), suicidal ideation, self-harm intent, drug or medication overdose, anaphylaxis, severe difficulty breathing, and loss of consciousness
- No external imports, no database calls, no async I/O — the function is synchronous and self-contained
- Unit tests must assert both the positive case (emergency string returned) and the negative case (None returned) for representative inputs

## Compliance & Safety

This gate is the primary technical safeguard ensuring Pulse does not interpose an AI model between a user and emergency services. From a HIPAA and general medical software risk perspective, failing to escalate a life-threatening emergency to emergency services is a critical-severity failure mode. The decision to make this check non-negotiable and unconditional (per `CLAUDE.md`) reflects that priority. Any future refactoring that moves, gates, or conditions this check must be treated as a safety-critical change and reviewed with the same rigor as a change to a medical device. The response deliberately avoids any AI-generated content so that its wording can be reviewed and approved independently of model behavior.
