# ADR-009: Drug Interaction Checking via Rule-Based Pair Matching

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Sana Health engineering team

## Context

Users of Sana Health may be prescribed multiple medications and may ask whether a newly recommended drug is safe to take alongside their existing regimen. Drug-drug interactions can cause serious adverse events — including bleeding, serotonin syndrome, and metabolic crises — so the application must surface known high-risk combinations proactively. The question was whether to implement this check using an LLM, an external pharmacological database, or a curated deterministic rule set. For a safety-critical feature, predictability and auditability of outputs were weighted heavily over coverage breadth.

## Decision

Drug interaction checking is implemented as a deterministic, rule-based substring matcher operating against a curated list of known high-risk interaction pairs defined in `backend/features/drug_interactions.py`. The POST /api/drug-check endpoint accepts the user's current medications (name, dose, frequency) plus a candidate new drug, checks every current medication against the new drug using the pair list, and returns a list of warning strings for each flagged combination. An empty list indicates no known interactions in the curated set.

The curated pair list includes clinically significant combinations such as:
- Warfarin + aspirin (major bleeding risk)
- SSRI + tramadol (serotonin syndrome)
- Metformin + iodinated contrast dye (lactic acidosis risk)
- ACE inhibitor + potassium-sparing diuretic (hyperkalemia)

Every response includes a mandatory disclaimer that the check is not a substitute for clinical pharmacist review. The user's current medications are also embedded in the chat system prompt via `backend/health/injector.py`, so Claude is aware of the full medication context in conversational turns even when the dedicated drug-check endpoint is not called explicitly.

No LLM or external API is invoked in the drug-check pathway.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Use Claude/LLM to reason about drug interactions | LLM outputs are non-deterministic; a model may hallucinate an interaction, miss a known one, or vary its severity framing across calls — unacceptable for a safety-critical check where false negatives carry clinical risk |
| Integrate an external database (DrugBank, RxNorm, OpenFDA) | Adds external API dependency, rate-limit risk, licensing obligations, and network latency to a synchronous safety check; also introduces a third-party failure mode that could silently degrade the feature |
| Comprehensive NLP-based fuzzy drug name matching | Increases implementation complexity and risk of false positives; substring matching is sufficient for the curated pair list and is easier to audit and extend |
| Rely solely on the chat system prompt medication context | Passive — Claude may not surface interaction warnings unprompted, and the chat pathway is not a reliable gate for systematic interaction screening |
| Delegate entirely to frontend with a client-side rule list | Exposes the full interaction rule set to clients, bypasses server-side audit logging, and cannot guarantee rule list version consistency |

## Consequences

### Positive
- Outputs are fully deterministic and reproducible — the same inputs always produce the same warnings, making the feature auditable and testable with exact assertions.
- No external API dependency means the feature has no network failure modes and adds negligible latency to the request.
- The curated pair list is version-controlled alongside the application code, so every change to interaction rules is tracked in git with a clear commit history.
- Rule-based logic is straightforward to unit test — each known pair can have a dedicated test case verifying the warning string and severity.
- The mandatory disclaimer on every response correctly sets user expectations and reduces liability from users treating the check as a clinical clearance.
- Dual coverage (dedicated endpoint + chat system prompt context) means drug-interaction awareness permeates the product without requiring users to navigate to a specific feature.

### Negative / Trade-offs
- Coverage is limited to the manually curated pair list; uncommon but clinically significant interactions not in the list will not be flagged (false negatives are the primary risk).
- Substring matching does not handle brand names, generic name variants, abbreviations, or misspellings — a user entering "Coumadin" instead of "warfarin" will not trigger the warfarin + aspirin rule.
- The curated list requires ongoing manual maintenance as new drug interactions are identified; there is no automated mechanism to import updates from pharmacovigilance databases.
- Dose and frequency fields are accepted in the request but are not used in the current matching logic — the interaction check is binary (present/absent) rather than dose-dependent.
- The feature should not be marketed as a comprehensive drug safety check; its limited scope must be clearly communicated to users and clinical reviewers.

## Implementation Notes

- `backend/features/drug_interactions.py` — defines the `KNOWN_INTERACTIONS` list of `(drug_a, drug_b, warning_message)` tuples and the `check_drug_interactions(current_medications, new_drug)` function; matching is case-insensitive substring comparison against both drug name fields.
- `backend/main.py` — POST /api/drug-check route; loads current medications from the user's HealthProfile if `user_id` is provided (supplements or overrides the `current_medications` list in the request body), calls `check_drug_interactions()`, appends the clinical disclaimer to the response, and returns the warnings list.
- The disclaimer string is defined as a module-level constant in `drug_interactions.py` and must be included in every response regardless of whether any interactions are found.
- Interaction pair entries should be reviewed and approved by a clinical advisor before merging; a label convention (e.g., `# clinical-review: approved YYYY-MM-DD`) is recommended in the source file.
- Future enhancement path: normalise drug names against RxNorm CUI codes at ingestion time (when the user adds a medication to their profile) to improve matching accuracy without changing the runtime check logic.

## Compliance & Safety

- The drug interaction check is explicitly scoped as a decision-support tool, not a clinical safety system. Every API response must include the disclaimer directing users to consult a pharmacist or prescribing clinician before making any medication changes.
- False negatives (missed interactions) are the primary safety risk. The curated list must be reviewed regularly — at minimum annually — and any additions must be traceable to a peer-reviewed source or established clinical guideline.
- User medication data is sensitive PHI. The `user_id` must be validated against the authenticated session before loading profile medications; the endpoint must never return another user's medication list.
- Interaction warnings must not include diagnostic language or explicit treatment recommendations — they should describe the risk category and direct the user to professional guidance.
- Audit logging of all drug-check requests (user, new drug queried, warnings returned, timestamp) should be maintained to support retrospective safety review and to identify patterns of high-risk queries.
- The feature must not be used as a gate that blocks users from accessing care; a result of no known interactions must not be interpreted as clinical clearance.
