# ADR-005: Chat Evidence Injection and System Prompt Architecture

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Sana Health engineering team

## Context

The core chat endpoint must synthesise multiple heterogeneous inputs — a user's health profile, real-time wearable data, retrieval-augmented evidence, uploaded files, and safety triage — into a single coherent prompt before calling Claude. Without a principled layering strategy, prompt construction becomes ad hoc, evidence is omitted or duplicated, and there is no reliable way to enforce safety constraints (such as emergency gating or citation requirements) consistently across all requests. A structured injection architecture was needed to make the prompt both auditable and extensible as new context sources are added.

## Decision

The POST /api/chat endpoint orchestrates a deterministic pipeline before every Claude call: (1) emergency gate runs first and short-circuits with an emergency response if triggered, (2) the user's HealthProfile is loaded from Supabase, (3) a domain classifier maps the question to one of approximately ten health domains (cardiology, nephrology, neurology, etc.) so that evidence retrieval is targeted rather than exhaustive, (4) RAG retrieves relevant evidence chunks, (5) the system prompt is assembled in fixed layers by `backend/health/injector.py`, and (6) only then is the Anthropic messages API called using `claude-sonnet-4-6`.

The system prompt layers are applied in strict order:
1. Role and voice instructions — establishes Claude as a cautious health co-pilot that never diagnoses and always recommends consulting a doctor.
2. Health profile context block — demographics, conditions, current medications, allergies, and recent lab values.
3. Evidence block — retrieved citations with title, authors, year, journal, abstract, PMID, DOI, and evidence level, with instructions to cite inline as [1][2] and prioritise Level 1–2 evidence.
4. Wearable context — recent heart rate, sleep, activity, and other metrics when available.
5. Attachment instructions — present only when the user has uploaded files, directing Claude on how to interpret the supplied document or image blocks.

Multi-modal inputs (JPEG, PNG, WebP, GIF, and PDF) are passed inline to the Anthropic messages API as base64-encoded image blocks or document blocks respectively. After the response is streamed to the client, `asyncio.create_task()` launches `update_profile_from_conversation()` in the background to extract and persist new health facts without blocking the response.

Every response includes a triage level field (`'emergency' | 'urgent' | 'routine' | null`) derived from the emergency gate result, surfaced to the frontend for UI-level urgency signalling.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Single flat prompt string concatenated at call site | Untestable, no separation of concerns, impossible to selectively enable/disable layers (e.g., wearable context when device is not paired) |
| Retrieval without domain classification — query all evidence domains | Increases noise and token cost; domain classification ensures retrieved chunks are topically relevant to the question |
| External pharmacist / evidence API (e.g., UpToDate) for each chat turn | Latency and licensing cost; RAG over curated corpus is sufficient for informational use case |
| Pass attachments as URLs rather than inline blocks | Requires persistent file hosting and signed URL management; inline base64 avoids external storage for transient chat attachments |
| Run profile update synchronously before returning response | Adds 200–800 ms to perceived latency for a background housekeeping task; user does not need the updated profile in the same response turn |
| Use a cheaper/faster model (e.g., claude-haiku) for final answers | Medical context requires strong reasoning and instruction-following; `claude-sonnet-4-6` is the minimum acceptable quality bar for safety-critical health responses |

## Consequences

### Positive
- Emergency gate is enforced at the outermost layer of the pipeline — it is structurally impossible for a Claude call to occur before triage runs.
- Layered prompt assembly is unit-testable per layer; `injector.py` can be tested with mock profile and evidence fixtures.
- Domain classification reduces retrieved evidence to the most relevant chunks, keeping prompts focused and token-efficient.
- Triage level in every response allows the frontend to surface appropriate urgency cues (e.g., banner, 911 prompt) without parsing free text.
- Background profile extraction improves personalisation over time without any latency penalty for the user.
- Multi-modal support is transparent to the prompt layer — the attachment instruction block is conditionally injected, keeping the base prompt clean when no files are present.

### Negative / Trade-offs
- The sequential pipeline (profile load → classify → retrieve → assemble → call) adds several async round-trips before the LLM call begins; end-to-end latency is higher than a naive single-step call.
- Domain misclassification silently degrades evidence quality — if a cardiology question is misclassified as general wellness, relevant cardiovascular studies may not be retrieved.
- Inline base64 encoding of attachments increases request payload size; very large PDFs or high-resolution images may approach Anthropic API request size limits.
- The fixed layer ordering means wearable context always appears after evidence; if the user's question is primarily about their wearable data, this ordering may be suboptimal for attention.
- Background task failure (e.g., Supabase write error in `update_profile_from_conversation`) is silent from the user's perspective; fact extraction must have its own error logging and retry strategy.

## Implementation Notes

- `backend/main.py` — POST /api/chat route; orchestrates the full pipeline, calls `check_emergency()` as the first operation, assembles the messages list, invokes `anthropic.messages.create()` with `claude-sonnet-4-6`, and spawns the background task.
- `backend/health/injector.py` — `build_system_prompt(profile, evidence, wearables, has_attachments)` assembles the layered system prompt string; each layer is a distinct function for isolated testing.
- `backend/health/updater.py` — `update_profile_from_conversation(user_id, user_message, assistant_response)` extracts structured health facts (conditions mentioned, medications referenced, symptoms) and upserts them into the user's HealthProfile in Supabase.
- Evidence citation objects returned to the client include: `title`, `authors`, `year`, `journal`, `abstract`, `pmid`, `doi`, `evidence_level`.
- Triage response field is derived from `check_emergency()` return value: non-null string maps to `'emergency'`; further severity classification distinguishes `'urgent'` from `'routine'`.

## Compliance & Safety

- `check_emergency()` is the sole hard gate before any LLM interaction; it must never be removed, reordered, or made conditional. This is a project non-negotiable.
- The system prompt explicitly instructs Claude to never diagnose, always recommend professional consultation, acknowledge uncertainty, and cite evidence. These instructions are injected programmatically and cannot be overridden by user messages.
- All uploaded file content (images, PDFs) is processed in-memory and passed directly to the Anthropic API; files must not be persisted to storage without explicit user consent and appropriate data governance controls.
- Health profile data passed into the prompt is scoped to the authenticated user via Supabase Row Level Security — the profile load must always use the authenticated `user_id` from the session token, never a client-supplied identifier.
- Background fact extraction writes to the user's HealthProfile; the extractor must validate and sanitise extracted facts before persistence to prevent prompt-injection-driven profile corruption.
- Triage level returned in the API response must be treated as informational only; it does not replace a clinical assessment and must be labelled accordingly in the frontend UI.
