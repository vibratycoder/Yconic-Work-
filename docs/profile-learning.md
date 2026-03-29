# Profile Learning from Conversations

After every chat response, Sana Health automatically extracts new health facts from the conversation and appends them to the user's profile. This runs as a non-blocking background task.

## Trigger

Registered as a FastAPI `BackgroundTask` at the end of the `POST /api/chat` handler — after the response has already been sent to the client.

```python
background_tasks.add_task(
    update_profile_from_conversation,
    request.user_id,
    full_conversation,   # history + new user message + assistant answer
)
```

## Process

**File:** `backend/health/updater.py`

```
Full conversation (all turns)
         │
         ▼
Load current profile facts from Supabase
         │
         ▼
Claude Haiku — extract new facts not already in profile
         │
         ▼
Parse JSON array response
         │
         ▼
Append to profile.health_facts  (capped at last 50)
Increment profile.conversation_count
         │
         ▼
upsert_profile() → Supabase
```

## Fact extraction prompt

Claude Haiku receives:

```
EXISTING FACTS:
- <fact 1>
- <fact 2>
...

CONVERSATION:
USER: ...
ASSISTANT: ...
```

**System prompt:**
> "Review this health conversation and extract any new medical facts about the user. Return ONLY a JSON array of short factual strings. Only include facts NOT already in their profile. Return [] if nothing new. Return ONLY valid JSON — no markdown."

**Example output:**
```json
["Reported worsening knee pain for 3 weeks", "Started walking 30 min daily"]
```

## Storage

`health_facts` is a `jsonb` array in the `health_profiles` table. The list is kept to the **50 most recent** facts. The last 10 are injected into every Claude system prompt under `HEALTH HISTORY`.

## Failure handling

All exceptions are caught and logged — the task **never blocks or retries**. If fact extraction fails (API error, JSON parse error, network issue), the profile is simply not updated for that conversation. The chat response already delivered to the user is unaffected.

```python
except json.JSONDecodeError as exc:
    log.warning("fact_extraction_json_failed", ...)
except Exception as exc:
    log.error("profile_update_failed", ...)
```

## Model used

**Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — chosen for speed and low cost in a background task context. Max tokens: 512.

## Files

| File | Role |
|------|------|
| `backend/health/updater.py` | `update_profile_from_conversation()` |
| `backend/health/profile.py` | `get_profile()`, `upsert_profile()` |
| `backend/main.py` | Background task registration |
