# ADR-021: Simulated Demo Lab Data for Onboarding

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

New users who have not yet uploaded or entered any lab results see a completely empty bloodwork tab. User testing showed this empty state significantly increases drop-off before users experience the value of Pulse's lab analysis features — they have nothing to interact with and no sense of what the feature offers. Asking users to upload real labs immediately creates friction and privacy hesitation before trust is established.

## Decision

A `SIMULATED_LABS` constant containing 20 representative lab entries is shown when `profileLabs.length === 0`. The demo panel is clearly labelled with an amber "Demo" badge and a subtitle reading "Simulated reference panel · 20-year-old male". An `isDemo: true` flag is attached to all entries. The flag is checked at every write path to ensure demo data is never persisted to Supabase. The 20 entries cover a complete standard reference panel: CBC (Complete Blood Count), CMP (Comprehensive Metabolic Panel), Lipid Panel, and Thyroid function tests.

## Alternatives Considered

1. **Prompt user to upload immediately** — An upload prompt on an empty state is the standard SaaS pattern, but it introduces a hard gate before any value is demonstrated; users with no labs ready to hand will churn.
2. **Show empty state illustration** — A friendly illustration with descriptive copy ("Upload your labs to see insights") is low-friction but still delivers zero interactive value; does not reduce drop-off.
3. **Use aggregate population averages** — Showing population reference ranges without individual values would be accurate but not interactive — users could not see what a personalised analysis looks like.

## Consequences

**Positive:** New users immediately see a populated, interactive lab panel that demonstrates Pulse's analysis capability; amber "Demo" badge ensures no user confuses demo data with their actual results; isDemo guard prevents any accidental write to the database.

**Negative / Trade-offs:** The simulated panel represents a single demographic (20-year-old male) which may not match many users' reference ranges; users with different demographics may see values flagged as out-of-range that would be normal for them. The constant must be maintained if reference range standards change.

## Implementation Notes

- `SIMULATED_LABS` is defined in `mobile/constants/labs.ts` (mobile) and duplicated inline in the web `LabsTab` component until the shared package (ADR-020) is introduced.
- The `isDemo` flag must be checked in the `uploadLab`, `saveLab`, and `syncLabs` functions — a runtime assertion or guard clause is recommended, not just documentation.
- The amber badge uses Tailwind class `bg-amber-500` (web) and `backgroundColor: '#f59e0b'` (mobile).
- CBC entries: WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, Platelets. CMP entries: Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, CO2, Calcium, Total Protein, Albumin. Lipid Panel: Total Cholesterol, LDL, HDL, Triglycerides. Thyroid: TSH.

## Compliance & Safety

- Demo data must never be used in any AI analysis call — the `isDemo` flag must be checked before constructing the user context passed to the Anthropic SDK.
- The "Demo" label must remain visible at all times while demo data is displayed; it must not be dismissible or hidden by the user.
- The subtitle must specify the demographic of the simulated data ("20-year-old male") so users understand the reference ranges are not personalised.
