# ADR-010: Doctor Visit Preparation Summary Generation

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Sana Health engineering team

## Context

Patients frequently arrive at medical appointments poorly prepared — unable to recall their current medications, uncertain which recent lab results were abnormal, or unsure what questions to ask. Sana Health holds a rich, longitudinal HealthProfile for each user and is well-positioned to generate a concise, structured pre-visit summary that the patient can print or show to their clinician. A decision was needed on how to generate this summary: whether to apply the full chat pipeline (RAG, triage, citations), use a lighter LLM call, or produce it from a template without an LLM at all.

## Decision

The GET /api/visit-prep/{user_id} endpoint loads the user's complete HealthProfile from Supabase — including demographics, conditions, medications, allergies, recent lab results, extracted health facts, and wearable summaries — and passes this data directly to `claude-sonnet-4-6` with a structured generation prompt. No RAG evidence retrieval is performed, and the emergency triage gate is not applied (this is a preparation tool, not an acute symptom pathway). Claude is instructed to produce a plain-text summary constrained to under 400 words, organised into five fixed sections:

1. Chief complaints and reason for visit
2. Current medications list
3. Recent abnormal lab results with values and reference ranges
4. Relevant health history points
5. Three suggested questions for the patient to ask the doctor

The output is plain text without markdown formatting or inline citations, designed to be human-readable when printed. The mobile frontend triggers this feature via a "Prepare for visit" button on the home screen (`home.tsx`), which calls the endpoint and displays the result in a printable view.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Full chat pipeline with RAG and evidence citations | Overkill for a structured summary task; evidence citations are not appropriate in a printable patient-facing document, and RAG adds latency without improving the output quality for this use case |
| Rule-based template filling (no LLM) | Cannot synthesise across the health profile to identify which history points are most relevant to the upcoming visit; LLM provides necessary clinical reasoning to prioritise and frame information appropriately |
| Markdown output with formatting | Markdown symbols render poorly in plain-text print views and are unfamiliar to non-technical users; plain text is more universally readable |
| Apply triage gate before generation | Visit prep is not an acute symptom input pathway — the user is preparing for a scheduled appointment. Triage would add latency and is semantically mismatched to the use case |
| Use a cheaper/faster model for generation | The visit summary is a high-stakes, patient-facing document that will be shown directly to a clinician; `claude-sonnet-4-6` is used to ensure accurate representation of the health profile and appropriate clinical framing |
| Cache the summary and serve stale versions | Health profile data changes frequently (new labs, medication changes, health facts from recent chats); a cached summary could present outdated medication lists or lab values to a clinician, which is a patient safety risk |

## Consequences

### Positive
- The feature is self-contained and low-complexity — it has no dependency on the RAG pipeline, evidence corpus, or real-time external APIs, making it reliable and fast to load.
- A structured five-section output format ensures the summary is consistently organised across users, improving clinician readability and trust in the document.
- Suggested questions help patients who struggle to articulate their concerns engage more productively with their clinician, improving appointment quality.
- Plain-text output is universally printable and displayable without a markdown renderer, making it suitable for the mobile "print/share" use case.
- Absence of citations and evidence blocks reduces the risk of patients or clinicians misinterpreting the document as a clinical evidence review rather than a personal health summary.

### Negative / Trade-offs
- Without RAG, the summary relies entirely on Claude's parametric knowledge for any clinical framing; if the health profile contains unusual conditions or rare medications, framing quality may be lower than with retrieved evidence.
- The 400-word constraint may cause Claude to truncate or omit detail for users with complex, multi-condition health histories; the word limit may need to be made dynamic based on profile complexity.
- Plain-text output cannot include formatting cues (bold, tables) that would improve scannability for a clinician reviewing the document quickly; this is a deliberate trade-off for printability.
- The endpoint has no streaming — the full summary is generated before any content is returned to the client, which may result in a 3–6 second wait for the "Prepare for visit" button to respond.
- The feature does not adapt the summary to the type of appointment (primary care, specialist, emergency follow-up); a cardiology follow-up and a GP annual review would benefit from different emphasis in the summary.

## Implementation Notes

- `backend/features/visit_prep.py` — `generate_visit_summary(user_id: str) -> str` loads the HealthProfile via the Supabase client, constructs the generation prompt with the five-section instruction, calls `anthropic.messages.create()` with `claude-sonnet-4-6` and `max_tokens=600` (generous ceiling above the 400-word target to prevent hard truncation), and returns the plain-text content string.
- `backend/main.py` — GET /api/visit-prep/{user_id} route; validates that `user_id` matches the authenticated session, calls `generate_visit_summary()`, and returns `{"summary": <plain_text>}`.
- The generation prompt explicitly instructs Claude to: use only information present in the provided health profile (no external knowledge for facts), write in second person ("Your current medications include…"), keep each section concise, and flag any section where profile data is insufficient rather than fabricating content.
- `home.tsx` (mobile) — "Prepare for visit" button triggers a GET request to the endpoint, displays a loading indicator during generation, and renders the result in a scrollable, share-able plain-text view with a print/export option.
- The abnormal labs section should highlight values outside the reference range with the actual value and the range — the prompt instructs Claude to include this detail when lab data is present in the profile.

## Compliance & Safety

- The visit summary is derived exclusively from the authenticated user's own HealthProfile; the endpoint must validate the session token and confirm that `user_id` in the path matches the authenticated identity before loading any profile data.
- The generated summary must include a footer disclaimer stating that it is a patient-prepared summary and not a clinical document, and that the treating clinician should verify all information against the patient's medical records.
- Medication lists in the summary are sourced from the user's self-reported profile; they may not reflect prescriptions that were discontinued, changed, or not yet recorded. The disclaimer must acknowledge this limitation.
- Lab values presented as "abnormal" are flagged relative to standard reference ranges embedded in the health profile; the summary must not characterise the clinical significance of abnormalities — it should present values and ranges, leaving interpretation to the clinician.
- The summary must not include any language that constitutes a diagnosis, prognosis, or treatment recommendation. The suggested questions section must prompt the patient to ask the doctor, not assert conclusions.
- As a document that will be shown to third parties (clinicians), the summary is subject to the same data minimisation principles as other PHI exports — it should include only information relevant to a medical appointment and must not surface data fields that the user has not opted into sharing (e.g., mental health notes flagged as private).
