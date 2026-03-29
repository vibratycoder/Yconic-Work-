# Deployment

## Overview

Pulse consists of three independently deployed services:

| Service | Runtime | Command |
|---------|---------|---------|
| Backend | Python / uvicorn | `uvicorn backend.main:app --host 0.0.0.0 --port 8000` |
| Web | Next.js 14 | `cd web && npm run build && npm start` |
| Mobile | Expo EAS | `cd mobile && eas build --platform ios` |

All three services require environment variables to be configured before starting.

---

## Environment Variables

### Backend (required)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Sonnet and Claude Haiku calls |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `SUPABASE_KEY` | Supabase service role key (for backend-side access, bypasses RLS) |

### Backend (optional)

| Variable | Description |
|----------|-------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Raises Semantic Scholar rate limit from 100 req/5 min to ~1 req/sec |

### Web (required)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (exposed to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (safe to expose, RLS enforces access) |

Store backend variables in `backend/.env`. Store web variables in `web/.env.local`. Never commit `.env` files to version control.

---

## Backend Deployment

### Prerequisites

```bash
cd backend
pip install -r requirements.txt  # or: uv sync (if using pyproject.toml)
```

### Start the server

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

For production with auto-restart:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Health check

```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

### CORS

The current configuration allows all origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    ...
)
```

**Before launch:** replace `["*"]` with your production domain, e.g. `["https://app.pulse.health"]`. This is set in `backend/main.py`.

---

## Web Deployment

### Prerequisites

```bash
cd web && npm install
```

### Build and start

```bash
cd web && npm run build && npm start
```

### Development

```bash
cd web && npm run dev
```

The web app runs on port 3000 by default.

### Environment file

Create `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Mobile Deployment (Expo EAS)

### Prerequisites

```bash
npm install -g eas-cli
eas login
cd mobile && npm install
```

### iOS build

```bash
cd mobile && eas build --platform ios
```

### Android build

```bash
cd mobile && eas build --platform android
```

### Development build (local device)

```bash
cd mobile && npx expo start
```

### API URL configuration

The mobile app's `lib/api.ts` should point to the backend URL. For local development this is typically `http://localhost:8000`. For production it should be your deployed backend URL.

---

## Supabase Setup

Run the following in the Supabase SQL editor for your project. The full schema is in `schema.sql` at the project root.

### 1. Enable required extension

```sql
create extension if not exists "uuid-ossp";
```

### 2. Create tables

```sql
create table health_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  age integer, sex text, height_cm float, weight_kg float,
  primary_conditions jsonb not null default '[]',
  current_medications jsonb not null default '[]',
  allergies jsonb not null default '[]',
  health_facts jsonb not null default '[]',
  wearable_summary jsonb,
  conversation_count integer not null default 0,
  member_since timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab_results (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  test_name text not null, loinc_code text,
  value float, value_text text, unit text,
  reference_range_low float, reference_range_high float,
  status text check (status in ('normal','low','high','critical','unknown')),
  date_collected date,
  lab_source text check (lab_source in ('photo_ocr','healthkit','manual','pdf')),
  created_at timestamptz not null default now()
);
```

### 3. Enable Row Level Security on all tables

```sql
alter table health_profiles enable row level security;
alter table lab_results enable row level security;
```

This step is **critical**. Without it, all users can read all data.

### 4. Create RLS policies

```sql
create policy "Users own their health profiles"
  on health_profiles for all using (auth.uid() = user_id);

create policy "Users own their lab results"
  on lab_results for all using (auth.uid() = user_id);
```

### 5. Create performance indexes

```sql
create index idx_lab_results_user_date on lab_results(user_id, date_collected desc);
```

### 6. Enable Supabase Auth

In the Supabase dashboard: **Authentication → Providers → Email** — enable email/password sign-up. Configure redirect URLs for your web domain.

---

## Pre-launch Security Checklist

- [ ] CORS `allow_origins` restricted to production domain in `backend/main.py`
- [ ] RLS enabled and policies created on all Supabase tables
- [ ] `SUPABASE_KEY` (service role key) is never exposed to the browser — backend only
- [ ] `ANTHROPIC_API_KEY` is not checked into version control
- [ ] Supabase anon key is safe to expose — RLS is the access control layer
- [ ] `.env` and `.env.local` files are in `.gitignore`
- [ ] Emergency triage test suite passes 100% before deploying any backend change

---

## Dependencies Summary

### Backend Python packages (key)

```
fastapi
uvicorn
anthropic
supabase-py
pydantic[email]
aiohttp
tenacity
python-dotenv
structlog
lxml
```

### Web (key)

```
next (14)
@supabase/supabase-js
tailwindcss
typescript
```

### Mobile (key)

```
expo (~51)
expo-router
react-native
react-native-health (HealthKit)
@supabase/supabase-js
typescript
```
