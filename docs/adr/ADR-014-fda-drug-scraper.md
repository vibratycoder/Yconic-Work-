# ADR-014: FDA openFDA Drug Label Scraper

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

The drug interaction checking and visit-preparation features need structured, authoritative information about drug indications and warnings. Without an official source, the LLM must rely solely on training-data knowledge of drug labels, which may be outdated or inaccurate for recently updated black-box warnings or newly approved indications. Linking to official FDA-sourced label text improves safety and answer accuracy.

## Decision

Use the FDA openFDA `/drug/label.json` endpoint (`https://api.fda.gov/drug/label.json?search=openfda.generic_name:<name>`). The scraper extracts the `indications_and_usage` and `warnings` fields from the first matching result and returns them as a single structured dict. The generic drug name is normalised via RxNorm (ADR-015) before being submitted to the FDA query to maximise match rate.

## Alternatives Considered

1. **Parse FDA NDC directory PDFs** — FDA publishes label PDFs, but PDF parsing is brittle, requires additional dependencies (pdfplumber/pdfminer), and structured JSON is already available via openFDA — PDFs are a last resort.
2. **DailyMed API (NLM)** — DailyMed provides SPL (Structured Product Label) XML, which is richer than openFDA JSON but requires XML parsing and namespace handling; openFDA's JSON surface is sufficient for the snippets needed.
3. **Purchase a commercial drug database** — Services like Wolters Kluwer or Elsevier provide enriched drug monographs but introduce per-query licensing costs and vendor dependency; openFDA is free and maintained by a US federal agency.

## Consequences

**Positive:** No API key required; returns structured JSON; federally maintained and updated when labels change; free for any use.

**Negative / Trade-offs:** Generic name search is fuzzy — a brand name submitted directly often returns no results; RxNorm normalisation (ADR-015) adds ~200 ms latency upstream. openFDA coverage skews toward approved US drugs; off-label or international drugs may not be found.

## Implementation Notes

- Module: `backend/scrapers/fda_drugs.py`.
- Always call `normalize_drug_name()` from `utils/rxnorm.py` before querying openFDA.
- Extract `results[0]["indications_and_usage"]` and `results[0]["warnings"]`; handle `KeyError` gracefully — not all labels contain both fields.
- Truncate extracted text to 800 characters before inserting into the RAG context to manage token usage.
- Return `None` (not an exception) when no label is found so the caller can skip gracefully.

## Compliance & Safety

- openFDA data is US government open data; no redistribution restrictions.
- Warnings and contraindications extracted from labels must be surfaced verbatim to the LLM without paraphrase, to avoid inadvertently softening safety language.
- The system prompt must instruct the model to advise users to consult a pharmacist or physician before making medication decisions, regardless of label content.
