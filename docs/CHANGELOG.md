# Changelog

All notable changes to Pulse are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] - 2026-03-29

Backend Optimizations & New Scraping Sources

### Added

- `backend/utils/constants.py` — centralized model name constants (`CLAUDE_SONNET`, `CLAUDE_HAIKU`), token budgets (`MAX_TOKENS_DEFAULT`, `MAX_TOKENS_VISIT_PREP`, `MAX_TOKENS_QUERY_EXPAND`), and HTTP configuration (`TIMEOUT_SECONDS`, `MAX_RETRIES`, `PAPERS_PER_SOURCE`, `RAG_TOP_K`). All backend modules now import from here instead of hard-coding values.
- `backend/utils/parsing.py` — shared parsing utilities: `parse_iso_date()` for robust date string normalisation and `extract_json()` for extracting JSON from LLM responses that may include surrounding prose.
- `backend/rag/sources/_shared.py` — eliminates duplicated helper code across source clients: `format_authors()` (up to 3 names + et al.) and `is_preprint()` (matches arXiv, bioRxiv, medRxiv, SSRN, Research Square).
- `backend/rag/sources/clinicaltrials.py` — ClinicalTrials.gov API v2 client. Searches 400,000+ registered studies by condition/keyword. Returns `ClinicalTrial` dataclass with NCT ID, phase, status, enrollment, sponsor, and brief summary.
- `backend/rag/sources/fda_drugs.py` — FDA openFDA drug label client. Fetches official prescribing information including indications, warnings, and contraindications for a given generic drug name. Returns `FDADrugLabel` dataclass.
- `backend/rag/sources/rxnorm.py` — NLM RxNorm REST API client. Exposes `normalize_drug_name()` for canonical drug name resolution and `search_rxnorm()` for drug concept lookup. Returns `RxNormDrug` dataclass.
- `backend/rag/sources/medlineplus.py` — MedlinePlus NLM health topic client. Fetches consumer-facing health topic summaries via the NLM web-search service. Parses XML response with `xml.etree.ElementTree`. Returns `MedlinePlusTopic` dataclass.
- `_require_profile()` helper in `backend/main.py` — shared profile-loading logic that raises `HTTP 404` when profile is absent and `HTTP 500` on Supabase error. Eliminates 3 duplicate try/except blocks from route handlers.
- 12 new Architecture Decision Records (ADR-011 through ADR-022) in `docs/adr/`.

### Changed

- All RAG source clients updated to import timeout and retry constants from `utils/constants.py` instead of local literals.
- `backend/rag/health_rag.py` — `PAPERS_PER_SOURCE` and `RAG_TOP_K` now sourced from `utils/constants.py`.
- `backend/health/injector.py` — `build_health_system_prompt()` now accepts `attachment_count` parameter to inject file-specific guidance when documents are attached to a chat message.
- `backend/main.py` — `/api/chat` route constructs multi-modal content blocks for image and PDF attachments; `_build_attachment_prompt()` helper formats a directive prompt that connects attached files to the user's question.
- `/api/documents/analyze` endpoint updated to use Claude's document API for PDF extraction and Vision API for image extraction, routing by MIME type.

### Removed

- Dead constant `CRITICAL_THRESHOLDS` from `backend/features/lab_interpreter.py` — was defined but never referenced anywhere in the codebase.

---

## [0.2.0] - 2026-03-28

Mobile App & Web Enhancements

### Added

- Full Expo SDK 51 React Native mobile application with dark theme matching the web application design.
- Mobile home screen (`mobile/app/(app)/home.tsx`) — time-of-day greeting, `HealthSummaryCard`, quick-access chat button, abnormal labs preview with pull-to-refresh.
- Mobile chat screen (`mobile/app/(app)/chat.tsx`) — full multi-turn conversational interface with triage-level badge and citation display.
- Mobile labs screen (`mobile/app/(app)/labs.tsx`) — lab results with colour-coded High/Normal/Low indicators, bullet chart visualisation, `SIMULATED_LABS` demo data.
- Mobile profile screen (`mobile/app/(app)/profile.tsx`) — 5-tab health profile editor (Demographics, Conditions, Medications, Allergies, Lifestyle) with FACT_CATEGORIES toggle-pill UI for lifestyle facts.
- Mobile wearable summary card — read-only display of 7-day HealthKit averages rendered below the profile tabs.
- 5-step mobile onboarding (`mobile/app/(auth)/onboarding.tsx`) — collects demographics, conditions, medications, lifestyle facts, and health goals; submits to `POST /api/profile` on completion.
- `mobile/lib/api.ts` — typed API client for `fetchHealthProfile()` and `updateHealthProfile()`.
- `mobile/lib/types.ts` — TypeScript type definitions mirroring backend Pydantic models.
- Web: removed manual upload panel from bloodwork tab; added simulated reference panel showing lab values in context of population reference ranges.
- Web: added BMI calculator to `HealthProfileSidebar` — displays calculated BMI with category label (Underweight / Normal / Overweight / Obese) when height and weight are populated.
- Web onboarding (`web/app/onboarding/page.tsx`) — 5-step profile collection matching mobile onboarding, with `COMMON_CONDITIONS` and `COMMON_ALLERGIES` chip pickers.
- `web/lib/health-facts.ts` — source of truth for `FACT_CATEGORIES` definitions used in the onboarding Lifestyle step.
- ADR-001 through ADR-010 added to `docs/adr/`.

### Changed

- Mobile tab navigator updated to include Home, Chat, Labs, and Profile tabs with consistent dark-theme styling.
- Web Supabase client refactored to `web/lib/supabase.ts` with `getCurrentUser()` helper used across onboarding and authenticated pages.

---

## [0.1.0] - Initial Release

Core Platform

### Added

- FastAPI backend (`backend/main.py`) with complete API surface: chat, profile CRUD, lab scan, document analysis, visit prep, drug interaction check.
- Anthropic Claude integration with emergency triage gate (`check_emergency()` in `backend/health/injector.py`) running before every LLM call.
- `HealthProfile` Pydantic model with `to_context_string()` method for LLM system prompt injection.
- `LabResult`, `LabStatus`, `Medication`, `WearableSummary` data models.
- Supabase authentication, Postgres storage, and Row Level Security on all tables.
- `health_profiles`, `lab_results`, `conversations`, `symptom_logs`, `documents` tables with full RLS policies.
- Multi-source RAG pipeline: Semantic Scholar + OpenAlex with OCEBM evidence grading and composite scoring (0.50 × evidence + 0.30 × citation + 0.20 × recency).
- `backend/rag/query_expander.py` — Claude Haiku generates 3 academic search queries per user question.
- `backend/rag/reranker.py` — OCEBM classification, deduplication by DOI/PMID/title, composite scoring, top-N selection.
- `backend/rag/context_builder.py` — formats ranked papers into structured evidence block for system-prompt injection.
- Lab OCR via Claude Vision (`backend/intake/lab_ocr.py`) — extracts structured `LabResult` objects from uploaded images and PDFs.
- Document classifier (`backend/intake/document_classifier.py`) — determines whether an uploaded file contains bloodwork using Claude Vision.
- HealthKit wearable sync (`backend/intake/healthkit_sync.py`) — imports Apple HealthKit data into `WearableSummary`.
- Personalised lab rating (`backend/features/lab_rater.py`) — rates lab values as High/Normal/Low using age- and sex-adjusted reference ranges.
- Visit preparation summary (`backend/features/visit_prep.py`) — generates structured doctor-visit prep from health profile.
- Drug interaction checking (`backend/features/drug_interactions.py`) — flags known interactions between a new drug and current medications.
- `classify_triage_level()` (`backend/features/triage.py`) — post-LLM urgency classification for UI badges.
- `utils/logger.py` — structlog-based structured logging; `get_logger(__name__)` used everywhere.
- `tests/test_triage.py` and `tests/test_health_injector.py` — initial test suite for safety-critical emergency gate.
- Next.js 14 web application with Tailwind CSS, Supabase auth, and dark design system.
- `schema.sql` — complete Supabase schema with RLS, indexes, and foreign key constraints.
