# Testing Strategy

## Overview

Sana Health tests are located in `tests/` and mirror the backend module structure. The test suite uses `pytest` with `asyncio` support for async endpoints.

```
tests/
├── __init__.py
├── test_health_injector.py    check_emergency() + build_health_system_prompt()
├── test_triage.py             classify_triage_level() + emergency pattern coverage
├── test_lab_ocr.py            Lab OCR extraction and rating
└── test_pubmed_client.py      PubMed citation fetching (legacy evidence layer)
```

---

## Test Categories

### 1. Unit Tests — Pure Functions

Pure functions with no external dependencies are tested directly. No mocking required.

**Examples:**
- `check_emergency(text)` — deterministic string matching
- `classify_triage_level(text)` — deterministic pattern matching
- `rate_lab_results(results, age, sex, ...)` — reference range logic
- `_reconstruct_abstract(inverted_index)` — OpenAlex abstract reconstruction
- `parse_iso_date(s)` and `extract_json(s)` from `utils/parsing.py`
- `format_authors(authors)` from `rag/sources/_shared.py`

These functions have no I/O and no side effects. Tests can call them directly and assert on the return value.

### 2. Integration Tests — API Endpoints

Route-level tests that exercise the full request lifecycle. These tests must hit a **real Supabase test project** — no mocking of the database layer.

**Rationale:** Supabase RLS policies are enforced at the database level. Mocking the client would skip the most important security boundary in the system.

**Setup requirements:**
- Set `SUPABASE_URL` and `SUPABASE_KEY` to a dedicated test project
- Seed the test project with a test user and a known `user_id`
- Tests clean up their own data (delete created rows in `teardown`)

**Endpoints with integration tests:**
- `GET /api/profile/{user_id}` — 200 with data, 404 for unknown user
- `POST /api/profile` — creates profile, idempotent upsert
- `PUT /api/profile/{user_id}` — updates fields, returns 400 on mismatch
- `POST /api/chat` — full happy path, emergency short-circuit
- `GET /api/visit-prep/{user_id}` — 404 for missing profile

### 3. RAG Source Tests — httpx Mock

Tests for the 6 RAG source clients use `httpx` mock (or `aioresponses`) to simulate API responses. This is acceptable because:
- We own the mock boundary — we wrote the client code
- The real APIs require network access, are rate-limited, and return non-deterministic results
- We are testing our parsing logic, not the upstream API

**What is tested:**
- Happy-path parsing: a realistic API response produces the expected model fields
- 429 handling: returns `[]` without raising
- 404 handling (FDA, RxNorm): returns `[]`
- Missing title: record is skipped
- Preprint detection: bioRxiv paper is filtered out
- Abstract reconstruction (OpenAlex): inverted index → readable text

### 4. Emergency Triage — 100% Coverage Required

Emergency triage is safety-critical. **100% line and branch coverage** on `backend/health/injector.py` is required before any deployment. No exceptions.

Coverage is checked with:

```bash
cd backend && python -m pytest tests/test_triage.py tests/test_health_injector.py \
  --cov=backend.health.injector --cov-report=term-missing
```

The test matrix is documented in full in [EMERGENCY_TRIAGE.md](EMERGENCY_TRIAGE.md).

---

## Running Tests

### All tests

```bash
cd backend && python -m pytest tests/ -x
```

The `-x` flag stops on the first failure. Use this during development to get fast feedback.

### Specific test file

```bash
cd backend && python -m pytest tests/test_triage.py -v
```

### With coverage

```bash
cd backend && python -m pytest tests/ --cov=backend --cov-report=term-missing
```

### Async tests

Tests for async functions use `pytest-asyncio`. Decorate async test functions with `@pytest.mark.asyncio` and add `asyncio_mode = "auto"` to `pyproject.toml` (or `pytest.ini`) to avoid per-test decoration.

---

## Test Data Conventions

### HealthProfile factory

```python
def _make_profile(**kwargs) -> HealthProfile:
    defaults = {
        "user_id": "test-user-123",
        "display_name": "Test User",
        "age": 45,
        "sex": "female",
        "primary_conditions": ["hypertension"],
        "current_medications": [
            Medication(name="Lisinopril", dose="10mg", frequency="daily")
        ],
        "allergies": ["penicillin"],
    }
    defaults.update(kwargs)
    return HealthProfile(**defaults)
```

Use this helper (defined in `test_health_injector.py`) rather than constructing `HealthProfile` directly in every test.

### Citation factory

```python
def _make_citation() -> Citation:
    return Citation(
        pmid="12345678",
        title="Hypertension management in primary care",
        journal="JAMA",
        year="2023",
        abstract="Blood pressure control reduces cardiovascular events.",
        authors="Smith et al.",
    )
```

---

## What Not to Mock

| Component | Reason |
|-----------|--------|
| Supabase client (integration tests) | RLS policies must be exercised |
| `check_emergency()` | It's pure Python, never mock it |
| `anthropic.AsyncAnthropic` | Use a test API key or skip in CI with `pytest.mark.skipif` |

---

## CI Considerations

- Set `ANTHROPIC_API_KEY` in CI secrets for tests that call the Anthropic API
- Set `SUPABASE_URL` and `SUPABASE_KEY` to a dedicated test project — never the production project
- Emergency triage tests must always run — they have no external dependencies and no reason to skip
- RAG source tests with httpx mocks are safe to run in CI without network access

---

## Adding New Tests

When adding a new feature:

1. **New emergency pattern** → add a positive test case to `tests/test_triage.py`
2. **New RAG source** → add a parsing test with a mocked API response
3. **New API endpoint** → add an integration test covering 200, 404, and 422 cases
4. **New pure utility function** → add a unit test with a table of input/output pairs

Keep test class names matching the module they test: `class TestEmergencyTriage`, `class TestHealthProfileInjection`, etc.
