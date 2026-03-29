# ADR-020: Mobile/Web Feature Parity Strategy

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

Pulse ships two frontend clients: a Next.js 14 web application and an Expo React Native mobile application. As new features are developed, there is a natural tendency to prototype on one platform and delay the other indefinitely. This creates a split user experience where web users and mobile users have access to different capabilities, complicating support, documentation, and user expectations. The bloodwork/lab results view and the health insights feed were the first features where this gap became visible.

## Decision

All user-facing features must ship on both platforms in the same release. Parity is maintained through:

- **Shared design tokens**: background `#04090f`, primary `#38bdf8`, and all other palette values are documented and applied identically on both platforms.
- **Identical data constants**: `SIMULATED_LABS` (20 entries) and `FACT_CATEGORIES` are authoritative on the web in `web/lib/health-facts.ts`; mobile duplicates the constant inline until a shared package is introduced.
- **Same filter/sort UX**: both platforms expose the same filter and sort interactions for lab results and health facts.
- **Platform-appropriate rendering**: web uses SVG-based charts (Recharts); mobile uses `View`-based absolute positioning for the same visual output, since SVG library support in React Native adds bundle size and Expo compatibility risk.

## Alternatives Considered

1. **Mobile-only app** — Simplifies the frontend surface to one platform, but Pulse's target users include professionals who prefer desktop; dropping the web app would reduce addressable audience significantly.
2. **Web-first with React Native Web bridge** — React Native Web allows one component tree to render on both platforms, but the current codebase uses Next.js 14 App Router patterns (server components, server actions) that are incompatible with React Native Web's rendering model.
3. **Shared component library (Turborepo / NX monorepo)** — The architecturally correct long-term solution, but introduces significant build and tooling complexity that is premature at the current stage; deferred to a future ADR.

## Consequences

**Positive:** Users get a consistent experience regardless of platform; feature flags and A/B tests can be applied uniformly; QA can test one feature spec against two implementations.

**Negative / Trade-offs:** Every new feature requires two implementations. The `FACT_CATEGORIES` constant is duplicated between `web/lib/health-facts.ts` and the mobile inline constant — any update must be applied in both places until the shared package is introduced.

## Implementation Notes

- `FACT_CATEGORIES` in `web/lib/health-facts.ts` is the source of truth; mobile changes must be backported from there.
- Design token values are documented in this ADR as the authoritative reference until a `tokens.ts` shared package is created.
- Chart rendering: web uses Recharts `<LineChart>`; mobile uses a `View` container with child `View` elements sized by `(value / maxValue) * containerHeight` absolute positioning.
- Feature parity is verified during PR review — a PR adding a web-only feature without a corresponding mobile ticket must include a justification or a follow-up ticket reference.

## Compliance & Safety

- Health data displayed on both platforms must be identical — no platform-specific data filtering that could cause a user to see different lab results on web versus mobile.
- Accessibility: both platforms must meet WCAG 2.1 AA contrast ratios using the shared design tokens; the dark background `#04090f` with primary `#38bdf8` satisfies AA for large text and must be validated for body text sizes.
