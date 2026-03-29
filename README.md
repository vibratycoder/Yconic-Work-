# Sana Health

AI health co-pilot with persistent health memory, personalised lab intelligence, and evidence-graded responses.

**Live:** Backend on Render | Web on Vercel

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11+, Pydantic v2, Anthropic SDK |
| Web | Next.js 16, React 19, TypeScript strict, Tailwind CSS |
| Mobile | Expo SDK 51, React Native |
| Database | Supabase (PostgreSQL + RLS + Auth) |
| Evidence | Semantic Scholar, OpenAlex, PubMed, ClinicalTrials.gov, FDA, MedlinePlus |

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env  # fill in keys
uvicorn backend.main:app --reload --port 8010

# Web
cd web
npm install
npm run dev
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design and [MASTER_PLAN.md](MASTER_PLAN.md) for project context.

## Key Features

- **Deterministic safety gate** — `check_emergency()` runs before every LLM call (pure string matching, no AI)
- **Multi-source RAG** — 6 concurrent academic queries, OCEBM evidence grading
- **Personalised lab ranges** — 80+ tests rated against age/sex/BMI-adjusted ranges
- **Persistent health memory** — profile enrichment after every conversation
- **Lab OCR** — upload photos or PDFs of blood work for automated extraction and rating
- **Self-updating ranges** — scrape agent autonomously refreshes reference ranges from literature

## Project Structure

```
pulse/
├── backend/          # FastAPI API (9 routes, RAG pipeline, safety gate)
├── web/              # Next.js 16 web app (auth, chat, bloodwork, profile)
├── mobile/           # Expo React Native app
├── docs/adr/         # 22 Architecture Decision Records
├── ARCHITECTURE.md   # System design
├── MASTER_PLAN.md    # Full project context
└── CLAUDE.md         # AI pair-programming config
```

## API Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/api/chat` | POST | Chat (non-streaming) |
| `/api/chat/stream` | POST | SSE streaming chat |
| `/api/profile/{user_id}` | GET/PUT | Health profile CRUD |
| `/api/profile` | POST | Create profile (onboarding) |
| `/api/labs/scan` | POST | Lab image OCR + rating |
| `/api/documents/analyze` | POST | Document classification + extraction |
| `/api/visit-prep/{user_id}` | GET | Doctor visit summary |
| `/api/drug-check` | POST | Drug interaction check |
| `/api/health-rag/query` | POST | Direct evidence retrieval |

## Tests

```bash
cd backend && python -m pytest tests/ -x
```
