# Sana Health — Claude Code Configuration

## Project
AI health co-pilot. FastAPI backend + Next.js 14 web.

## Non-negotiables
- Emergency triage (check_emergency) runs BEFORE every LLM call — no exceptions
- Full docstrings + type annotations everywhere
- Structured logging via utils/logger.py — never print()
- No Any type, no bare except, no placeholder pass

## Safety first
check_emergency("chest pain radiating to left arm") → must return emergency string
check_emergency("stomach hurts a little") → must return None

## Tech stack
- Backend: FastAPI, Pydantic v2, Anthropic SDK, aiohttp, tenacity, lxml, supabase-py
- Web: Next.js 14, TypeScript, Tailwind CSS
- DB: Supabase (Postgres + RLS + auth)

## Commit format
feat(scope): description
chore: description
test(scope): description
