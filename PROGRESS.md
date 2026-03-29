# Pulse — Build Progress

Last updated: 2026-03-29

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

## Phase 5 — Mobile + Web UI
- [x] mobile/app/(app)/chat.tsx (dark theme, image attachments, loading dots)
- [x] mobile/components/ChatBubble.tsx
- [x] mobile/components/CitationSheet.tsx
- [x] mobile/components/TriageAlert.tsx
- [x] web/components/ChatInterface.tsx
- [x] web/components/HealthProfileSidebar.tsx
- [x] mobile/app/(app)/labs.tsx (dark theme, simulated blood panel, Table/Chart toggle, bullet charts)
- [x] mobile/app/(app)/profile.tsx (dark theme, 5-tab layout, FACT_CATEGORIES lifestyle tab)
- [x] mobile/app/(app)/home.tsx
- [x] mobile/app/(auth)/onboarding.tsx (5-step flow, health facts questionnaire)
- [x] mobile/app/(app)/_layout.tsx (dark tab bar)
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
- [x] ARCHITECTURE.md
- [x] PULSE_MASTER_REPORT.md
