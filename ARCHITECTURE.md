# Sana Health — Architecture

## System overview
Two core systems power every response:
1. HEALTH MEMORY — persistent HealthProfile injected as system prompt context
2. EVIDENCE ENGINE — multi-source RAG with OCEBM reranking (Semantic Scholar, OpenAlex, PubMed, ClinicalTrials.gov, FDA, MedlinePlus)

## Request flow
User question
  → check_emergency() [deterministic string matching, no LLM, zero latency]
  → load HealthProfile from Supabase
  → classify_health_domain(question) [MeSH keyword mapping]
  → expand_query() via Claude Haiku → 3 academic query variants
  → asyncio.gather(search_semantic_scholar, search_openalex) [6 concurrent requests]
  → rank_papers() [OCEBM composite: 0.50 evidence + 0.30 citations + 0.20 recency]
  → build_health_system_prompt(profile, top_citations)
  → Anthropic claude-sonnet-4-6
  → return answer + citations + triage_level
  → [background] update_profile_from_conversation() via Claude Haiku

## Backend modules
- health/injector.py: emergency gate (20+ AND-group patterns) + system prompt assembly
- health/profile.py: Supabase CRUD for HealthProfile
- health/updater.py: background health fact extraction post-conversation
- rag/health_rag.py: multi-source RAG orchestrator with query expansion + OCEBM reranking
- evidence/pubmed.py: PubMed esearch + efetch + XML parsing (fallback source)
- evidence/query_builder.py: health domain classification + query optimization
- intake/lab_ocr.py: Claude Vision lab result extraction (image + PDF)
- intake/document_classifier.py: document type classification before OCR
- intake/healthkit_sync.py: HealthKit wearable payload processing
- features/triage.py: deterministic triage level classification
- features/lab_rater.py: personalised lab rating (80+ tests, age/sex/BMI-adjusted ranges)
- features/visit_prep.py: doctor visit summary generation
- features/drug_interactions.py: medication interaction checking
- agents/scrape_agent.py: autonomous literature-backed reference range updater
- models/health_profile.py: Pydantic v2 data models (HealthProfile, ProfileUpdate, LabResult, etc.)
- utils/logger.py: structured logging (structlog), utils/constants.py, utils/parsing.py

## Database (Supabase PostgreSQL + RLS)
Tables: health_profiles, lab_results, conversations, symptom_logs, documents
All tables have RLS enabled — users access only their own data
Performance: composite index on (user_id, date_collected DESC)

## Web (Next.js 16 + React 19 + TypeScript strict + Tailwind CSS)
- Auth (email/password via Supabase Auth) + 5-step health onboarding
- ChatInterface with SSE streaming + image/PDF attachment support
- HealthProfileSidebar always visible — demographics, conditions, meds, allergies, labs, BMI calculator
- EditProfileModal — 5 tabs (Demographics, Conditions, Medications, Allergies, Learned facts)
- Bloodwork page — upload, classify, personalised rating with Table/Chart toggle
- CitationCard with PubMed links and display summaries

## API Endpoints (9 routes)
| Route | Method | Purpose |
|---|---|---|
| /health | GET | Health check |
| /api/chat | POST | Main chat (non-streaming) |
| /api/chat/stream | POST | SSE streaming chat |
| /api/profile/{user_id} | GET | Fetch health profile |
| /api/profile | POST | Create profile (onboarding) |
| /api/profile/{user_id} | PUT | Update profile (edit modal) |
| /api/labs/scan | POST | Lab image OCR + personalised rating |
| /api/documents/analyze | POST | Document classification + extraction |
| /api/visit-prep/{user_id} | GET | Doctor visit preparation summary |
| /api/drug-check | POST | Drug interaction check |
| /api/health-rag/query | POST | Direct RAG evidence retrieval |
