# Sana Health — Build Progress

Last updated: 2026-03-29 (v0.3.0)

## Phase 1 — Supabase Schema
- [x] Run schema SQL in Supabase dashboard
- [x] Verify 5 tables created with RLS
- [ ] GET /health returns 200

## Phase 2 — Core Models + Evidence Pipeline
- [x] backend/models/health_profile.py
- [x] backend/models/conversation.py
- [x] backend/evidence/pubmed.py
- [x] backend/evidence/query_builder.py
- [x] backend/health/injector.py
- [x] backend/health/profile.py
- [x] backend/health/updater.py
- [x] backend/main.py

## Phase 3 — Lab OCR
- [x] backend/intake/lab_ocr.py

## Phase 4 — HealthKit
- [x] backend/intake/healthkit_sync.py

## Phase 5 — Web UI
- [x] web/components/ChatInterface.tsx
- [x] web/components/HealthProfileSidebar.tsx
- [x] web/app/bloodwork/page.tsx (Table/Chart view, simulated 20-entry panel, distribution ring)
- [x] web/components/EditProfileModal.tsx (5 tabs: Demographics, Conditions, Medications, Allergies, Learned)
- [x] web/app/onboarding/page.tsx (5-step flow with FACT_CATEGORIES)
- [x] web/lib/health-facts.ts (shared FACT_CATEGORIES module)
- [x] web/lib/api.ts
- [x] web/lib/types.ts
- [x] backend/rag/health_rag.py (multi-source RAG: Semantic Scholar + OpenAlex)
- [x] backend/rag/query_expander.py
- [x] backend/rag/reranker.py (OCEBM evidence grading)
- [x] backend/rag/context_builder.py
- [x] backend/rag/sources/semantic_scholar.py
- [x] backend/rag/sources/openalex.py
- [x] docs/adr/ (10 Architecture Decision Records written)

## Phase 6 — Demo
- [x] seed_demo.py executed (script exists with Marcus Chen full profile)
- [ ] Demo profile verified in Supabase

## Phase 7 — Documentation & Architecture Records
- [x] docs/adr/ADR-001 through ADR-010 (10 ADRs covering all major decisions)
- [x] docs/adr/ADR-011 through ADR-022 (12 new ADRs: scrapers, utilities, patterns)
- [x] ARCHITECTURE.md
- [x] PULSE_MASTER_REPORT.md
- [x] docs/BACKEND_ARCHITECTURE.md
- [x] docs/RAG_PIPELINE.md
- [x] docs/SCRAPING_SOURCES.md
- [x] docs/MOBILE_SCREENS.md
- [x] docs/DATA_MODELS.md
- [x] docs/EMERGENCY_TRIAGE.md
- [x] docs/ONBOARDING_FLOW.md
- [x] docs/TESTING_STRATEGY.md
- [x] docs/DEPLOYMENT.md
- [x] docs/CHANGELOG.md

## Phase 8 — Backend Optimizations
- [x] backend/utils/constants.py (CLAUDE_SONNET, CLAUDE_HAIKU, token/timeout constants)
- [x] backend/utils/parsing.py (parse_iso_date, extract_json)
- [x] backend/rag/sources/_shared.py (PREPRINT_MARKERS, format_authors, is_preprint)
- [x] Replaced all hardcoded model strings with constants
- [x] Added _require_profile() helper in main.py
- [x] Removed dead code: CRITICAL_THRESHOLDS in lab_interpreter.py
- [x] backend/rag/sources/clinicaltrials.py
- [x] backend/rag/sources/fda_drugs.py
- [x] backend/rag/sources/rxnorm.py
- [x] backend/rag/sources/medlineplus.py
