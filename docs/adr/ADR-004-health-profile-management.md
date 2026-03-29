# ADR-004: Health Profile Management

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Pulse engineering team

## Context

Every AI interaction in Pulse must be personalized to the individual user's medical context — their conditions, medications, allergies, and biometric data — so that Claude can reason safely and accurately about health questions. This requires a persistent, structured data model that is loaded on every chat request and injected into the Claude system prompt. A decision was needed on how to store, upsert, and incrementally enrich this profile without data loss or conflicts, particularly given that the primary key (id) is not the natural application-level identifier (user_id). Additionally, an automated mechanism was required to capture new health facts that emerge organically during conversations, without requiring the user to manually update their profile.

## Decision

`HealthProfile` is the canonical user data model for all personalized AI context. One row per user is stored in the Supabase `health_profiles` table, upserted on `user_id` (not the default PK `id`) because the application never supplies `id` in write payloads and `user_id` carries the UNIQUE constraint. The full profile is loaded at the start of every chat request and serialized into a structured context block in the Claude system prompt. After each chat turn, a background task uses Claude Haiku to extract any newly disclosed health facts from the conversation and appends them to the `health_facts` array — never overwriting existing entries — so the profile grows richer over time without user friction.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Store health data as JSONB inside the `users` table | Conflates identity/auth concerns with health data; makes RLS policies more complex and prevents independent schema evolution of the health model. |
| Upsert on default PK (`id`) | The row dict constructed at write time never includes `id` (it is Supabase-generated). Upserting on `id` when `id` is absent causes insert-always behavior, creating duplicate rows per user instead of updating the existing one. |
| Require users to manually log all health facts via the UI | High friction; most contextual signals (e.g., "Knee pain worse at night", "Started walking 30 min daily") surface naturally in conversation and would be lost if capture depended on user action. |
| Run fact extraction synchronously before returning the chat response | Adds latency to every user-facing response. Fact extraction is non-blocking value-add and must not delay the primary reply. |
| Overwrite `health_facts` array on each extraction pass | Risks losing previously captured facts if a later extraction returns a subset. Append-only semantics with deduplication are safer and preserve longitudinal history. |
| Store recent labs inline in `health_profiles` | Lab results have their own schema (date, test name, value, unit, reference range) and grow unboundedly. Keeping them in a separate `lab_results` table with a foreign key allows independent querying, pagination, and schema evolution. |

## Consequences

### Positive
- Every Claude response is contextualized with the user's full medical background, improving accuracy and safety.
- `on_conflict="user_id"` upsert is idempotent and race-condition-safe — concurrent writes converge to a single row.
- Background fact extraction enriches the profile passively, improving future responses without requiring explicit user effort.
- Append-only `health_facts` semantics preserve the full longitudinal health narrative across all conversations.
- Separating lab results into their own table allows fetching only the most recent 20 without bloating the profile payload.
- The 5-tab web modal (Demographics, Conditions, Medications, Allergies, Learned) and inline mobile editor give users full visibility and control over stored data, supporting HIPAA transparency principles.

### Negative / Trade-offs
- Loading the full profile on every chat request adds a Supabase round-trip to the critical path. For users with large `health_facts` arrays or many medications, the system prompt grows accordingly, consuming Claude context window tokens.
- Haiku-based fact extraction is a best-effort heuristic — it may occasionally extract redundant or imprecisely worded facts, which accumulate in `health_facts` over time. No automated deduplication or fact retirement is implemented.
- The `health_facts` free-form string format is human-readable but not structured, making programmatic querying (e.g., "find all users who exercise daily") impractical without further parsing.
- Upsert on `user_id` requires that the UNIQUE constraint on `user_id` is enforced at the database level; if that constraint is ever dropped or renamed, the upsert silently becomes insert-only, creating duplicate rows.
- Medication entries (name, dose, frequency, prescribing_condition) are stored as free-form objects — there is no normalization against a drug database, so typos and variant spellings are not caught.

## Implementation Notes

**Key files:**
- `backend/models/health_profile.py` — Pydantic v2 models: `HealthProfile`, `Medication`, `LabResult`, `WearableSummary`
- `backend/health/profile.py` — `load_profile(user_id)` fetches from Supabase and hydrates the Pydantic model; `save_profile(profile)` performs the upsert with `on_conflict="user_id"`; `build_system_context(profile)` serializes the profile into the Claude system prompt block
- `backend/health/updater.py` — `extract_and_append_facts(user_id, conversation_history)` is the background task; calls Claude Haiku with a structured extraction prompt, receives a JSON list of new fact strings, appends them to `health_facts`, and upserts the profile

**Critical implementation detail — upsert call:**
```python
await supabase.table("health_profiles").upsert(
    row_dict, on_conflict="user_id"
).execute()
```
Using `on_conflict="id"` (the default PK) or omitting `on_conflict` entirely will cause insert failures or duplicate rows because `id` is never present in `row_dict`.

**System prompt injection format:**
```
HEALTH PROFILE:
Name: Jane Doe | Age: 34 | Sex: F | Height: 165 cm | Weight: 68 kg
Conditions: Type 2 Diabetes, Hypertension
Medications: Metformin 500mg twice daily (Diabetes); Lisinopril 10mg once daily (Hypertension)
Allergies: Penicillin
Health facts: Started walking 30 min daily · Knee pain worse at night · Family history of diabetes
```

**Recent labs:** fetched via `SELECT * FROM lab_results WHERE user_id = ? ORDER BY date DESC LIMIT 20` and appended to the profile before system prompt construction.

**UI editing:**
- Web: `web/components/EditProfileModal.tsx` — tabbed modal with 5 panels; the "Learned" tab renders `health_facts` categorized by topic (exercise, sleep, smoking, alcohol, goals) for easy review and deletion.
- Mobile: `mobile/app/(app)/profile.tsx` — inline editing with Enter to confirm / Cancel to discard; height converted from ft/in to cm, weight from lbs to kg before submission.

## Compliance & Safety

- All health profile data is stored in Supabase with Row Level Security (RLS) policies enforcing that users can only read and write their own rows (`user_id = auth.uid()`).
- The profile is never logged in full — structured logging via `utils/logger.py` must omit or redact `current_medications`, `allergies`, and `health_facts` fields to prevent PHI appearing in log streams.
- Health facts extracted by the background task are derived from user-initiated conversation; users retain the ability to view, edit, and delete any stored fact via the UI.
- The `health_profile` context is advisory input to Claude — it does not replace clinical judgment. The emergency triage check (`check_emergency`) runs before every LLM call and is independent of profile data; a user's profile indicating "healthy" does not suppress emergency escalation.
- Medication and allergy data surfaced in the Claude context window must not be used to make prescriptive recommendations; Claude is instructed to defer to the user's prescribing clinician for any medication-related decisions.
