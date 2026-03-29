# Sana Health — Process Documentation

Documentation for every major process in the Sana Health backend and web stack.

## Processes

| Doc | Process | Entry point |
|-----|---------|-------------|
| [chat-flow.md](chat-flow.md) | Core health conversation loop | `POST /api/chat` |
| [emergency-triage.md](emergency-triage.md) | Deterministic safety gate + urgency classification | `check_emergency()` |
| [profile-management.md](profile-management.md) | Health profile CRUD + onboarding | `GET/POST/PUT /api/profile` |
| [profile-learning.md](profile-learning.md) | Automatic fact extraction from conversations | Background task after chat |
| [lab-analysis.md](lab-analysis.md) | Bloodwork OCR, rating, and import | `POST /api/labs/scan`, `POST /api/documents/analyze` |
| [document-intake.md](document-intake.md) | Document classification (bloodwork vs other) | `classify_document()` |
| [rag-evidence.md](rag-evidence.md) | Multi-source academic evidence retrieval | `POST /api/health-rag/query` |
| [drug-interactions.md](drug-interactions.md) | Drug interaction checking | `POST /api/drug-check` |
| [visit-prep.md](visit-prep.md) | Doctor visit summary generation | `GET /api/visit-prep/{user_id}` |
| [authentication.md](authentication.md) | Auth flow and onboarding | Supabase auth + onboarding screens |

## Architecture overview

```
┌─────────────────┐        ┌─────────────────┐
│   Next.js 14    │        │  FastAPI backend │
│   (web)         │◄──────►│  Python 3.11+    │
└─────────────────┘        └────────┬────────┘
                                    │
                             ┌──────▼──────┐
                             │  Supabase   │
                             │  Postgres   │
                             │  + Auth     │
                             └─────────────┘
```

**External APIs used:**
- Anthropic Claude API (Sonnet 4.6 for chat/vision, Haiku 4.5 for fact extraction)
- PubMed E-utilities / Google Scholar (citations)
- Semantic Scholar + OpenAlex (RAG evidence retrieval)
