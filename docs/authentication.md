# Authentication & Onboarding

Supabase-based auth with an automatic onboarding gate for new users.

## Auth flow

```
App launch
     │
     ▼
supabase.auth.getSession()
     │
     ├── No session → /auth screen
     │
     └── Session exists
               │
               ▼
         GET /api/profile/{user_id}
               │
               ├── 404 / null → /onboarding
               │
               └── Profile found → home / chat
```

## Web

**Files:** `web/app/page.tsx`, `web/app/auth/page.tsx`, `web/lib/supabase.ts`

- `page.tsx` (home) checks `getCurrentUser()` on mount. No session → redirect to `/auth`.
- `/auth` page handles email/password sign-in and sign-up via `supabase.auth.signInWithPassword()` / `signUp()`.
- On successful sign-up, a minimal `HealthProfile` is created via `POST /api/profile` before redirecting to `/onboarding`.
- Session is persisted in `localStorage` by the Supabase client automatically.

## Onboarding steps

### `web/app/onboarding/page.tsx` — 5 steps

| Step | Fields |
|------|--------|
| 1 — Your basics | Age, sex, height (ft/in), weight (lbs) |
| 2 — Medical conditions | Multi-select from 26 common conditions + custom entry |
| 3 — Current medications | Name, dose, frequency (add multiple) |
| 4 — Allergies | Multi-select from 15 common allergens + custom entry |
| 5 — Lifestyle & goals | Exercise frequency, sleep hours, smoking status, alcohol use, health goals |

On completion calls `POST /api/profile` to create the `health_profiles` row in Supabase.

## Supabase auth tables

Managed entirely by Supabase. The app uses `auth.users` UUIDs as `user_id` throughout. Row-level security policies ensure users can only access their own rows:

```sql
create policy "Users own their health profiles"
  on health_profiles for all using (auth.uid() = user_id);
```

The backend uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) for server-side operations. The web client uses `SUPABASE_ANON_KEY` (subject to RLS) for auth.

## Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Backend + web | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Bypasses RLS for server operations |
| `SUPABASE_ANON_KEY` | Web | Client auth, subject to RLS |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Exposed to browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Exposed to browser |

## Files

| File | Role |
|------|------|
| `web/app/auth/page.tsx` | Web sign-in / sign-up page |
| `web/app/page.tsx` | Auth guard before chat |
| `web/app/onboarding/page.tsx` | Web onboarding form (5 steps) |
| `web/lib/supabase.ts` | Supabase browser client + `getCurrentUser()` |
| `backend/main.py` | `POST /api/profile` (create at onboarding) |
| `schema.sql` | Table definitions + RLS policies |
