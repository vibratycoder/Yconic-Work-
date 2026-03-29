# Backend Architecture

## Overview

The Sana Health backend is a FastAPI application (`backend/main.py`) that routes all HTTP traffic through a single entry-point module. It delegates to four core sub-packages — `health/`, `features/`, `rag/`, and `intake/` — plus shared infrastructure in `utils/` and `models/`.

---

## Module Dependency Tree

```
backend/main.py
├── health/
│   ├── injector.py       check_emergency(), build_health_system_prompt()
│   ├── profile.py        get_profile(), upsert_profile()  [Supabase I/O]
│   └── updater.py        update_profile_from_conversation()  [background]
│
├── features/
│   ├── triage.py         classify_triage_level()
│   ├── lab_rater.py      rate_lab_results()
│   ├── lab_reference_ranges.py  age/sex-adjusted reference ranges
│   ├── lab_interpreter.py  lab-value text descriptions
│   ├── visit_prep.py     generate_visit_summary()
│   ├── drug_interactions.py  check_drug_interactions()
│   └── patterns.py       shared regex helpers
│
├── rag/
│   ├── health_rag.py     retrieve_health_evidence()  [orchestrator]
│   ├── query_expander.py expand_query()  [Claude Haiku]
│   ├── reranker.py       rank_papers()  [OCEBM scoring]
│   ├── context_builder.py build_evidence_block()
│   └── sources/
│       ├── semantic_scholar.py
│       ├── openalex.py
│       ├── clinicaltrials.py
│       ├── fda_drugs.py
│       ├── rxnorm.py
│       ├── medlineplus.py
│       └── _shared.py    format_authors(), is_preprint()
│
├── intake/
│   ├── lab_ocr.py        extract_lab_results_from_image/pdf()
│   ├── document_classifier.py  classify_document()
│   └── healthkit_sync.py sync wearable data
│
├── models/
│   ├── health_profile.py HealthProfile, LabResult, Medication, WearableSummary
│   ├── conversation.py   Conversation model
│   └── intake.py         DocumentClassification model
│
├── evidence/             Legacy PubMed evidence layer
│   ├── pubmed.py         get_citations_for_question()
│   ├── query_builder.py  classify_health_domain()
│   └── citation_formatter.py
│
└── utils/
    ├── constants.py      CLAUDE_SONNET, MAX_TOKENS_DEFAULT, TIMEOUT_SECONDS …
    ├── logger.py         get_logger()  [structlog]
    ├── parsing.py        parse_iso_date(), extract_json()
    └── retry.py          tenacity retry decorators
```

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Load balancer health check — returns `{"status": "ok"}` |
| `POST` | `/api/chat` | Main chat endpoint — full LLM interaction loop |
| `GET` | `/api/profile/{user_id}` | Retrieve a user's health profile |
| `POST` | `/api/profile` | Create or upsert a profile (body contains `user_id`) |
| `PUT` | `/api/profile/{user_id}` | Update an existing profile |
| `POST` | `/api/labs/scan` | Upload lab image for OCR extraction + rating |
| `POST` | `/api/documents/analyze` | Classify document; extract labs if bloodwork |
| `GET` | `/api/visit-prep/{user_id}` | Generate doctor-visit preparation summary |
| `POST` | `/api/drug-check` | Check a new drug against current medications |
| `POST` | `/api/health-rag/query` | Retrieve grounded academic evidence for a question |

---

## Request Lifecycle — Chat Message

The following describes exactly what happens when a client calls `POST /api/chat`.

### 1. Emergency Gate (synchronous, no LLM)

`check_emergency(request.get_text())` is called immediately. This is a pure string-matching function defined in `backend/health/injector.py`. If any emergency pattern matches, the function returns a response string containing a 911 directive and the route returns immediately — no database call, no LLM call.

```
check_emergency("chest pain radiating to left arm")
→ "Call 911 immediately. This sounds like a medical emergency…"
```

### 2. Health Profile Load

`get_profile(user_id)` fetches the user's `HealthProfile` from Supabase. On failure the route falls back to an empty profile rather than erroring, so the response degrades gracefully.

### 3. Domain Classification

`classify_health_domain(text)` assigns the question to a medical domain (e.g. `"cardiology"`, `"endocrinology"`) for use in citation retrieval.

### 4. PubMed Citation Fetch

`get_citations_for_question(text, health_domain)` queries the legacy PubMed evidence layer and returns `Citation` objects.

### 5. System Prompt Assembly

`build_health_system_prompt(profile, citations, attachment_count)` composes the Claude system prompt by injecting:
- Full `HealthProfile` rendered as structured text
- Peer-reviewed citations
- Attachment-handling instructions when files are present

### 6. Multi-modal Message Construction

If attachments are present, the route constructs a multi-part `content` block containing base64-encoded images or PDF documents followed by a directive text prompt. Otherwise the message is plain text.

### 7. Claude API Call

`anthropic.AsyncAnthropic().messages.create()` is called with `model=CLAUDE_SONNET`, `max_tokens=MAX_TOKENS_DEFAULT`, the assembled system prompt, and the conversation history.

### 8. Background Profile Update

`update_profile_from_conversation()` is queued as a FastAPI `BackgroundTask`. It re-reads the full conversation (including the new exchange) and extracts any new health facts to persist back to Supabase.

### 9. Triage Classification

`classify_triage_level(text)` runs after the LLM response to assign a UI urgency level (`emergency`, `urgent`, `routine`, `informational`) for the frontend to act on.

### 10. Response

A `ChatResponse` is returned containing `answer`, `citations`, `health_domain`, `is_emergency`, `triage_level`, and `conversation_id`.

---

## Key Design Decisions

**`_require_profile()` helper** — All endpoints that require an authenticated profile call the shared `_require_profile(user_id)` helper, which raises `HTTP 404` if the profile is absent and `HTTP 500` if the Supabase lookup raises. This avoids duplicated try/except blocks across routes.

**CORS** — Currently set to `allow_origins=["*"]`. Restrict to the production domain before launch.

**Structured logging** — All log calls use `get_logger(__name__)` from `utils/logger.py`. Never use `print()`.

**Model constants** — All model names and token limits live in `utils/constants.py`. Import from there; do not hard-code strings.
