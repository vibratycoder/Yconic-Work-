# Chat Flow

The core health conversation loop. Every message follows the same 8-step pipeline.

## Entry point

```
POST /api/chat
```

**Request model:** `ChatRequest` — `user_id`, `question`, `conversation_history`, optional `attachments`

## Pipeline

```
User message
     │
     ▼
1. check_emergency()          ← deterministic, no LLM
     │ emergency?
     ├──► return 911 response immediately (stop)
     │
     ▼
2. get_profile(user_id)       ← Supabase health_profiles + lab_results
     │
     ▼
3. classify_health_domain()   ← keyword classification into medical domain
     │
     ▼
4. get_citations_for_question() ← PubMed / Google Scholar (up to 3 citations)
     │
     ▼
5. build_health_system_prompt() ← profile context + citations + attachment guidance
     │
     ▼
6. Claude claude-sonnet-4-6.create()   ← text or multimodal (images/PDFs)
     │
     ▼
7. classify_triage_level()    ← EMERGENCY / URGENT / ROUTINE / INFORMATIONAL
     │
     ▼
8. return ChatResponse         ← answer + citations + triage_level
     │
     └──► background: update_profile_from_conversation()
```

## Step details

### 1 — Emergency gate
`check_emergency()` in `backend/health/injector.py` runs **before any LLM call**. Uses AND-group pattern matching — all terms in a group must be present. Returns a fixed 911 string on match; `None` otherwise. See [emergency-triage.md](emergency-triage.md).

### 2 — Profile load
`get_profile()` fetches the `health_profiles` row and joins the last 20 `lab_results` rows. On failure the request continues with an empty profile (chat is never blocked by a DB error).

### 3 — Domain classification
`classify_health_domain()` in `backend/evidence/query_builder.py` maps the question to a medical domain string (e.g. `"cardiology"`, `"endocrinology"`) used to shape the PubMed query.

### 4 — Citation retrieval
`get_citations_for_question()` in `backend/evidence/pubmed.py` tries Google Scholar first, falls back to PubMed E-utilities. Returns up to 3 `Citation` objects with PMID, title, journal, year, and a display summary.

### 5 — System prompt assembly
`build_health_system_prompt()` in `backend/health/injector.py` injects:
- Full `HealthProfile.to_context_string()` (demographics, conditions, meds, abnormal labs, wearables, facts)
- PubMed citation blocks (or a fallback note if no citations found)
- Attachment instructions when files are present

### 6 — Claude inference
**Model:** `claude-sonnet-4-6`
**Max tokens:** 1024
For text messages: simple `{"role": "user", "content": text}`.
For attachments: multimodal content array with image/document blocks followed by a text block.

### 7 — Triage classification
`classify_triage_level()` in `backend/features/triage.py` runs on the user text to assign a UI urgency level. See [emergency-triage.md](emergency-triage.md).

### 8 — Background profile update
`update_profile_from_conversation()` runs as a FastAPI `BackgroundTask` after the response is sent. Non-blocking. See [profile-learning.md](profile-learning.md).

## Files

| File | Role |
|------|------|
| `backend/main.py` | Route handler, orchestration |
| `backend/health/injector.py` | Emergency gate, system prompt builder |
| `backend/health/profile.py` | Profile load from Supabase |
| `backend/evidence/pubmed.py` | Citation retrieval |
| `backend/evidence/query_builder.py` | Domain classification |
| `backend/health/updater.py` | Background fact extraction |
| `backend/features/triage.py` | Triage level classification |
| `web/components/ChatInterface.tsx` | Web UI |

## Response model

```python
ChatResponse(
    conversation_id: str,
    answer: str,
    citations: list[dict],   # pmid, title, journal, year, pubmed_url, display_summary, source
    health_domain: str,
    triage_level: "emergency" | "urgent" | "routine" | "informational" | None,
    is_emergency: bool,
)
```
