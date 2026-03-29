# ADR-007: Authentication and Authorization via Supabase Auth and Row-Level Security

**Status**: Accepted
**Date**: 2026-03-29
**Deciders**: Sana Health engineering team

## Context

Sana Health stores and processes personally sensitive health data including symptom logs, lab results, health profiles, and conversation histories. The system spans three surfaces — a FastAPI backend, a Next.js 14 web client, and an Expo React Native mobile client — all of which must enforce that users can only access their own data. A consistent identity layer is needed across all surfaces without requiring a custom auth implementation, and Supabase (already used as the primary database) provides a built-in auth system with native integration into its Postgres Row-Level Security (RLS) framework.

## Decision

Authentication is handled entirely by Supabase Auth using email/password credentials and JWT session tokens. The Supabase JS client on web (`web/lib/supabase.ts`) and the Supabase React Native client on mobile (`mobile/lib/supabase.ts`) manage session lifecycle, token storage, and user identity via `getCurrentUser()` and `signOut()` helpers. The `user_id` is passed from the client as a body parameter in API requests to the FastAPI backend. Authorization is enforced at the database layer through Supabase Postgres Row-Level Security policies on all tables containing user data (`health_profiles`, `lab_results`, `conversations`, `symptom_logs`, `documents`), each with a policy of the form `auth.uid() = user_id`. The backend does not currently implement server-side JWT verification middleware; it relies on RLS to reject any cross-user data access at the query level.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Custom JWT middleware in FastAPI to verify tokens server-side | More secure than trusting a client-supplied `user_id`, but adds complexity and requires the Supabase JWT secret to be available to the backend. Deferred in favour of RLS-only enforcement as an interim approach, with server-side verification noted as a future improvement. |
| Roll a custom auth system (bcrypt passwords, custom JWT issuance) | High implementation cost and security risk. Supabase Auth provides battle-tested session management, secure token storage, and future extensibility (OAuth, MFA) at no marginal cost. |
| Use a third-party auth provider (Auth0, Firebase Auth) | Increases vendor count without meaningful benefit given Supabase is already the database provider. Native RLS integration would be lost, requiring a separate mapping layer between the auth provider's user IDs and Supabase rows. |
| OAuth providers (Google, Apple sign-in) | Not implemented at this stage. The Supabase Auth integration is designed to support OAuth providers as a future addition without architectural changes. |
| Pass JWT in Authorization header and verify in FastAPI | Architecturally correct and planned as a future hardening step, but not yet implemented. RLS provides a compensating control in the interim. |

## Consequences

### Positive
- Supabase Auth and RLS are tightly integrated: a correctly configured RLS policy makes unauthorized cross-user data access impossible at the database layer regardless of application-layer bugs.
- Consistent auth pattern across web and mobile: both clients use the same Supabase client library, reducing cognitive overhead and divergence risk.
- Session tokens are managed by the Supabase SDK, which handles refresh, expiry, and secure storage (AsyncStorage on React Native, localStorage/cookies on web) without custom code.
- Email/password auth is immediately available with no infrastructure work; OAuth and MFA can be enabled in the Supabase dashboard without backend changes.
- RLS policies are version-controlled as SQL migrations, making authorization rules auditable and reviewable alongside application code.

### Negative / Trade-offs
- The backend currently trusts the client-supplied `user_id` body parameter without server-side JWT verification. A malicious or misconfigured client could supply any `user_id`. RLS mitigates this at the database layer, but application-layer logic (e.g., constructing prompts, logging) that runs before the DB query could act on a spoofed identity.
- Mobile and web onboarding flows (`mobile/app/(auth)/onboarding.tsx`, `web/app/onboarding/page.tsx`) currently post the initial health profile with `user_id='placeholder'`, meaning profiles created during onboarding are not associated with the authenticated user until this is corrected. This is a known defect.
- No server-side session revocation check: once a JWT is issued, it is valid until expiry unless Supabase's token revocation mechanism is explicitly invoked. A compromised token cannot be instantly invalidated from the backend.
- RLS policies must be kept in sync with the data model — adding a new table with user-scoped data requires a corresponding RLS policy or a security gap exists.
- No multi-tenancy or role-based access control (RBAC) beyond the single-user ownership model enforced by RLS.

## Implementation Notes

- Web Supabase client and auth helpers: `web/lib/supabase.ts` — exports `getCurrentUser()` and `signOut()`
- Mobile Supabase client and auth helpers: `mobile/lib/supabase.ts` — same interface for React Native
- Web onboarding route: `web/app/onboarding/page.tsx` — known issue: posts `user_id='placeholder'`
- Mobile onboarding screen: `mobile/app/(auth)/onboarding.tsx` — same known issue
- RLS-protected tables: `health_profiles`, `lab_results`, `conversations`, `symptom_logs`, `documents`
- RLS policy pattern on each table: `USING (auth.uid() = user_id)` with equivalent `WITH CHECK` clause for inserts and updates
- `user_id` is passed as a body field in `POST /api/chat` and related backend endpoints; no `Authorization` header parsing is currently performed by FastAPI middleware
- Recommended near-term hardening: add a FastAPI dependency that extracts and verifies the Supabase JWT from the `Authorization` header using the Supabase JWT secret, and derives `user_id` server-side rather than accepting it from the request body

## Compliance & Safety

Sana Health handles health data that may qualify as Protected Health Information (PHI) under HIPAA and as sensitive personal data under GDPR. Supabase's RLS enforcement means that even a compromised application layer cannot exfiltrate another user's health records via a database query, which is a meaningful technical safeguard. The known `user_id='placeholder'` defect in onboarding is a data integrity issue that must be resolved before any production deployment handling real patient data — health profiles created with a placeholder identity are not RLS-protected to the correct user. Server-side JWT verification should be implemented before launch to close the trust gap between the client-supplied identity and the database-enforced identity. All health data in transit is protected by TLS via Supabase's managed infrastructure. Session tokens stored client-side by the Supabase SDK should be treated as sensitive credentials; on mobile, AsyncStorage encryption should be evaluated for devices that do not provide OS-level storage encryption.
