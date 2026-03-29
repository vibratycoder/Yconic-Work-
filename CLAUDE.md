# Sana Health — Claude Code Configuration

## Project
AI health co-pilot with persistent health memory, personalised lab intelligence, and evidence-graded responses. FastAPI backend (Python 3.11+) + Next.js 16 web (React 19) + Expo SDK 51 mobile. Deployed on Render (backend) + Vercel (web) with Supabase (PostgreSQL + RLS + Auth).

## Non-negotiables
- Emergency triage (check_emergency) runs BEFORE every LLM call — no exceptions
- Full docstrings + type annotations everywhere
- Structured logging via utils/logger.py — never print()
- No Any type, no bare except, no placeholder pass

## Safety first
check_emergency("chest pain radiating to left arm") → must return emergency string
check_emergency("stomach hurts a little") → must return None

21 AND-group emergency patterns in health/injector.py. 15 urgent patterns in features/triage.py. Both are pure string matching — no LLM, zero latency, zero hallucination risk.

## Tech stack
- Backend: FastAPI, Pydantic v2, Anthropic SDK (claude-sonnet-4-6 for chat, Haiku 4.5 for background), aiohttp, tenacity, lxml, supabase-py, scholarly
- Web: Next.js 16, React 19, TypeScript strict, Tailwind CSS
- Mobile: Expo SDK 51, React Native, react-native-health (HealthKit)
- DB: Supabase (PostgreSQL + RLS + Auth), 5 tables: health_profiles, lab_results, conversations, symptom_logs, documents

## API routes (11 total)
- GET /health — health check
- POST /api/chat — single-response chat (emergency gate → profile → citations → Claude)
- POST /api/chat/stream — SSE streaming chat (same pipeline, token-by-token)
- GET /api/profile/{user_id} — fetch full HealthProfile + labs
- POST /api/profile — create profile (onboarding)
- PUT /api/profile/{user_id} — update via ProfileUpdate (editable fields only, no labs/wearables/member_since)
- POST /api/labs/scan — lab image OCR + personalised rating
- POST /api/documents/analyze — document classification + bloodwork extraction
- POST /api/drug-check — drug interaction check (8 known high-risk pairs)
- GET /api/visit-prep/{user_id} — one-page doctor visit summary
- POST /api/health-rag/query — OCEBM-ranked evidence retrieval

## Backend architecture (49 Python files)

### Core pipeline (main.py, ~975 lines)
- Shared helpers: _require_profile(), _load_profile_or_default(), _serialize_citations()
- All imports at module level (uuid, classify_triage_level, etc.)
- Error handling: separate anthropic.AuthenticationError, anthropic.APIError, and generic Exception catches
- Error messages never expose internal exception details

### Health core (health/)
- injector.py (130 lines): check_emergency() — 21 AND-group patterns; build_health_system_prompt()
- profile.py (193 lines): get_profile(), upsert_profile() — Supabase CRUD with full parsing
- updater.py (80 lines): update_profile_from_conversation() — Claude Haiku background fact extraction

### RAG pipeline (rag/)
- health_rag.py (164 lines): retrieve_health_evidence() — 5-stage orchestrator
- query_expander.py (85 lines): expand_query() — Claude Haiku generates 3 academic queries
- reranker.py (310 lines): rank_papers() — OCEBM composite (0.50 evidence + 0.30 citations + 0.20 recency), levels 1-5, dedup by DOI/PMID/title
- context_builder.py (156 lines): build_evidence_block() — star-rated markdown with abstracts

### RAG sources (rag/sources/) — 8 external APIs
- semantic_scholar.py (202 lines): 200M+ papers, TLDRs, study-type classification
- openalex.py (243 lines): 250M+ works, abstract reconstruction from inverted index
- clinicaltrials.py (218 lines): ClinicalTrials.gov API v2, phase/status/enrollment
- fda_drugs.py (226 lines): openFDA drug labels, indications/warnings/contraindications
- rxnorm.py (256 lines): NLM RxNorm drug name normalisation
- medlineplus.py (246 lines): NLM MedlinePlus patient-facing health topics

### Evidence (evidence/)
- pubmed.py (289 lines): PubMed E-utilities esearch + efetch + XML parsing
- google_scholar.py (136 lines): scholarly library-based search
- query_builder.py (97 lines): classify_health_domain() — 9 medical domains, MeSH query builder

### Features (features/)
- triage.py (61 lines): classify_triage_level() — EMERGENCY/URGENT/ROUTINE/INFORMATIONAL, 15 urgent patterns
- lab_rater.py (242 lines): rate_lab_results() — High/Normal/Low/Unknown with deviation_pct
- lab_reference_ranges.py (515 lines): 196 base ranges, sex-specific overrides, age-adjusted functions (eGFR, PSA, BUN, ESR)
- lab_interpreter.py (38 lines): plain-language lab interpretation
- visit_prep.py (94 lines): generate_visit_summary() — Claude-powered doctor brief
- drug_interactions.py (53 lines): check_drug_interactions() — 8 high-risk pairs, bidirectional matching
- patterns.py (42 lines): identify_concerning_patterns() — metabolic syndrome, kidney dysfunction, anemia

### Intake (intake/)
- lab_ocr.py (193 lines): extract_lab_results_from_image() + extract_lab_results_from_pdf() — Claude Vision
- document_classifier.py (186 lines): classify_document() — bloodwork/imaging/prescription/clinical_notes/other, 30+ keyword pre-check
- healthkit_sync.py (101 lines): process_healthkit_payload() — 7-day wearable averages

### Agents (agents/)
- scrape_agent.py (625 lines): autonomous literature-backed reference range updater, 31 biomarkers, PubMed + Google Scholar → Claude extraction → scraped_ranges.py with DOI/PMID citations

### Data (data/)
- scraped_ranges.py (555 lines): 52 biomarkers, 185 ranges, 28 peer-reviewed sources (NEJM, Blood, Ann Intern Med, WHO, ADA, etc.)

### Models (models/)
- health_profile.py: HealthProfile, ProfileUpdate, LabResult (with computed_field: is_abnormal, display_value), Medication, WearableSummary, LabStatus, LabSource
- conversation.py: conversation history models
- intake.py: DocumentClassification, DocumentType

### Utils (utils/)
- constants.py: CLAUDE_SONNET, CLAUDE_HAIKU, MAX_TOKENS_DEFAULT
- logger.py: structlog wrapper — get_logger(name)
- parsing.py: parse_iso_date(), extract_json()
- retry.py: tenacity retry helpers

## Web architecture (19 TypeScript/TSX files)

### Pages (app/)
- auth/page.tsx (317 lines): login + signup with Supabase Auth, creates initial profile on signup
- onboarding/page.tsx (770 lines): 5-step flow (demographics, conditions, medications, allergies, lifestyle/goals)
- page.tsx: auth guard — redirects unauthenticated to /auth, no-profile to /onboarding
- bloodwork/page.tsx (826 lines): upload, classify, personalised rating, Table/Chart toggle, donut chart, filter by status
- health-tracker/page.tsx (523 lines): live EKG waveform (canvas), heart rate, steps, calories, sleep stages

### Components (components/)
- ChatInterface.tsx (537 lines): SSE streaming, image/PDF attachments (5MB images, 32MB PDFs), conversation tracking, draft persistence
- HealthProfileSidebar.tsx (359 lines): demographics, conditions, meds, allergies, labs, BMI calculator (syncs on profile edit), health facts grouped by category
- EditProfileModal.tsx (656 lines): 5 tabs (Demographics with name/age/sex/height/weight, Conditions, Medications, Allergies, Learned facts), saves via ProfileUpdate
- CitationCard.tsx (65 lines): expandable PubMed/Scholar citations

### Lib (lib/)
- api.ts: updateHealthProfile() accepts Partial<HealthProfile>, streamChatMessage() with SSE, fetchHealthProfile(), analyzeDocument(), sendChatMessage()
- supabase.ts: singleton client, getSupabaseClient() with env var validation, signIn/signUp/signOut/getCurrentUser
- types.ts: HealthProfile, Medication, LabResult, RatedLabResult, ChatMessage, Citation, WearableSummary, DocumentAnalysisResult
- health-facts.ts: FACT_CATEGORIES with exclusive groups, ALL_BASELINE_FACTS

## Mobile architecture (19 screen/component files, Expo SDK 51)

### Screens (8 in mobile/app/)
- sign-in.tsx (188 lines), onboarding.tsx (744 lines)
- home.tsx (150 lines), chat.tsx (783 lines) with SSE streaming
- labs.tsx (856 lines), profile.tsx (1420 lines)
- tracker.tsx (341 lines), visit-prep.tsx (295 lines)

### Components (6 in mobile/components/)
- ChatBubble, CitationSheet, HealthSummaryCard, LabCard, SymptomLogger, TriageAlert

## Tests (5 files in tests/)
- test_triage.py: safety-critical emergency detection (chest pain, stroke, overdose, anaphylaxis, false-positive checks)
- test_health_injector.py: system prompt injection (conditions, meds, allergies, demographics, labs, wearables)
- test_lab_ocr.py: Claude Vision JSON parsing, invalid input handling
- test_pubmed_client.py: citation formatting, domain classification, MeSH query construction, XML parsing
- test_chat_stream.py: SSE token ordering, meta events, emergency short-circuit, content-type validation

## Documentation (docs/adr/)
22 Architecture Decision Records: emergency-triage, health-rag-pipeline, lab-ocr-analysis, health-profile-management, chat-evidence-injection, wearable-data-sync, authentication-authorization, document-classification, drug-interaction-checking, visit-preparation, rag-source-registry, constants-centralization, clinicaltrials-scraper, fda-drug-scraper, rxnorm-normalization, medlineplus-scraper, parsing-utilities, profile-load-helper, commit-discipline, mobile-web-parity, simulated-lab-data, bmi-calculator

## Key data flow patterns
- Profile edit: EditProfileModal → PUT /api/profile/{id} (ProfileUpdate, no labs/wearables) → re-fetch full profile via GET → sidebar updates
- Chat: emergency gate → load profile → classify domain → fetch citations → build system prompt → Claude SSE stream → background profile enrichment
- Lab upload: classify document → OCR extract → load profile for demographics → rate with personalised ranges → return rated results
- BMI calculator: syncs local state via useEffect when profile height/weight change

## Commit format
feat(scope): description
fix(scope): description
chore: description
docs: description
test(scope): description
