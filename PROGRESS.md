# Pulse — Build Progress

## Phase 1 — Supabase Schema
- [ ] Run schema SQL in Supabase dashboard
- [ ] Verify 5 tables created with RLS
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
- [ ] mobile/app/(app)/chat.tsx
- [ ] mobile/components/ChatBubble.tsx
- [ ] mobile/components/CitationSheet.tsx
- [ ] mobile/components/TriageAlert.tsx
- [ ] web/components/ChatInterface.tsx
- [ ] web/components/HealthProfileSidebar.tsx

## Phase 6 — Demo
- [ ] seed_demo.py executed
- [ ] Demo profile verified in Supabase
