# Sana Health Backend

FastAPI backend for the Sana Health AI health co-pilot.

## Quick Start

```bash
pip install -r requirements.txt
cp .env.example .env  # fill in ANTHROPIC_API_KEY and SUPABASE_* values
uvicorn backend.main:app --reload --port 8000
```

## Module Map

```
backend/
├── main.py                  # All API routes (FastAPI app)
├── health/
│   ├── injector.py          # check_emergency() + build_health_system_prompt()
│   ├── profile.py           # get_profile() / upsert_profile() — Supabase I/O
│   └── updater.py           # Background profile fact extraction from conversations
├── features/
│   ├── triage.py            # classify_triage_level() — UI urgency badge
│   ├── lab_interpreter.py   # interpret_lab_result() — plain-language explanations
│   ├── lab_rater.py         # rate_lab_results() — High/Normal/Low with demographics
│   ├── lab_reference_ranges.py  # Demographic-adjusted reference ranges
│   ├── visit_prep.py        # generate_visit_summary() — one-page doctor brief
│   ├── drug_interactions.py # check_drug_interactions() — known pair warnings
│   └── patterns.py          # Regex patterns shared across features
├── rag/
│   ├── health_rag.py        # retrieve_health_evidence() — full RAG orchestrator
│   ├── query_expander.py    # expand_query() — Claude Haiku generates 3 queries
│   ├── reranker.py          # rank_papers() — OCEBM grading + composite score
│   ├── context_builder.py   # build_evidence_block() — formats papers for prompt
│   └── sources/
│       ├── _shared.py       # PREPRINT_MARKERS, format_authors(), is_preprint()
│       ├── semantic_scholar.py  # Semantic Scholar API (200M+ papers)
│       ├── openalex.py      # OpenAlex API (250M+ works, free)
│       ├── clinicaltrials.py    # ClinicalTrials.gov API v2
│       ├── fda_drugs.py     # FDA openFDA drug label API
│       ├── rxnorm.py        # NLM RxNorm drug name normalisation
│       └── medlineplus.py   # NLM MedlinePlus patient-facing summaries
├── intake/
│   ├── lab_ocr.py           # Claude Vision OCR for lab result images/PDFs
│   ├── document_classifier.py   # Determines if upload is bloodwork
│   └── healthkit_sync.py    # Apple HealthKit wearable data ingestion
├── evidence/
│   ├── pubmed.py            # PubMed E-utilities citation search (fallback)
│   ├── google_scholar.py    # Google Scholar scraper (primary citation source)
│   ├── query_builder.py     # Domain classification + MeSH query builder
│   └── citation_formatter.py    # Formats citations for prompts and responses
├── models/
│   ├── health_profile.py    # HealthProfile, LabResult, Medication, WearableSummary
│   ├── conversation.py      # Conversation history models
│   └── intake.py            # Document classification and intake models
└── utils/
    ├── constants.py         # CLAUDE_SONNET, CLAUDE_HAIKU, token/timeout values
    ├── parsing.py           # parse_iso_date(), extract_json()
    ├── logger.py            # structlog wrapper — get_logger(name)
    └── retry.py             # tenacity retry helpers
```

## Adding a New RAG Source

1. Create `backend/rag/sources/your_source.py`
2. Define a dataclass with: `title`, `abstract`, `year`, `citation_count`, `authors: list[str]`, `doi`, `pmid`, `journal`, and properties `display_authors` (use `format_authors`) and `source_label`
3. Define `async def search_your_source(query: str, max_results: int = PAPERS_PER_SOURCE) -> list[YourType]`
4. Import and add to the fan-out in `rag/health_rag.py` → `retrieve_health_evidence()`
5. Export from `rag/sources/__init__.py`
6. Write an ADR in `docs/adr/`

## Safety Rules

- `check_emergency()` **must** run before every LLM call — no exceptions (see `main.py`)
- Never use `print()` — always `log = get_logger(__name__)`
- Never use `Any` type or bare `except`
- Model names live in `utils/constants.py` — never hardcode strings

## Running Tests

```bash
cd backend
python -m pytest tests/ -x
```
