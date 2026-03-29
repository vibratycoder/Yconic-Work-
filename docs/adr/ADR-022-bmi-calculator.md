# ADR-022: Inline BMI Calculator in HealthProfileSidebar

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Users filling in their health profile need BMI feedback during profile setup to understand whether the height and weight values they are entering produce a medically meaningful result. Without immediate feedback, users who enter values in the wrong units (e.g., kilograms instead of pounds) only discover the error when the AI produces an implausible analysis. Additionally, users unfamiliar with their own BMI benefit from seeing it contextualised against standard classification bands without leaving the profile form.

## Decision

A `BmiCalculator` component is embedded directly in `HealthProfileSidebar.tsx`. It provides input fields for height (feet + inches) and weight (pounds) in Imperial units, matching the most common user preference in the target market. On mount, the component pre-fills from the user's existing `height_cm` and `weight_kg` profile values by converting to Imperial. BMI is calculated entirely client-side and displayed alongside a gradient BMI bar (Underweight / Normal / Overweight / Obese) with a position marker. Conversions: 1 ft = 30.48 cm, 1 in = 2.54 cm, 1 lb = 0.4536 kg.

## Alternatives Considered

1. **Separate modal** — Placing the calculator in a modal keeps the sidebar visually clean but adds an interaction step (opening the modal) and breaks the spatial connection between the inputs and the BMI feedback.
2. **Link to external calculator** — Linking to an external BMI tool (e.g., NIH calculator) removes the user from the app at a critical onboarding moment and provides no pre-fill from their profile data.
3. **Server-side calculation only** — Sending height/weight to the backend for BMI calculation is unnecessary network overhead for a trivial arithmetic operation; it also blocks the user from seeing immediate feedback while typing.

## Consequences

**Positive:** Immediate, no-latency BMI feedback without any API call; pre-fill from existing profile reduces re-entry friction; the gradient bar contextualises the number for users unfamiliar with BMI classifications; Imperial inputs match the US-market default.

**Negative / Trade-offs:** Imperial-to-metric conversion is done client-side — any input rounding may introduce small discrepancies (< 0.5 BMI units) compared to a server-side calculation using stored metric values. The component adds ~60 lines to `HealthProfileSidebar.tsx`; if the sidebar grows, extraction to `components/BmiCalculator.tsx` should be considered.

## Implementation Notes

- Location: `web/components/HealthProfileSidebar.tsx`, `BmiCalculator` sub-component.
- BMI formula: `weight_kg / (height_m ** 2)`, displayed to one decimal place.
- Classification thresholds: Underweight < 18.5, Normal 18.5–24.9, Overweight 25–29.9, Obese ≥ 30.
- Gradient bar: CSS linear-gradient from blue (Underweight) through green (Normal) to yellow (Overweight) to red (Obese); marker position = `clamp(0, ((bmi - 10) / 35) * 100, 100)%`.
- No `useEffect` network call; all state is `useState` with derived BMI computed inline.
- Pre-fill logic: `const initFeet = Math.floor(height_cm / 30.48); const initInches = Math.round((height_cm / 2.54) % 12)`.

## Compliance & Safety

- BMI is a screening tool, not a diagnostic measure; the component must display a disclaimer note: "BMI is a screening tool. Consult a healthcare provider for a personalised assessment."
- The calculated BMI value must never be automatically written back to the user's health profile — profile height and weight are the source of truth; BMI is derived and display-only.
- No user data is transmitted externally during BMI calculation; this is a fully offline, client-side computation.
