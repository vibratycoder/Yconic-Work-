# Scraping Sources

## Overview

The Sana Health RAG pipeline retrieves evidence from 6 external data sources. All source clients live in `backend/rag/sources/`. They share common helper utilities from `backend/rag/sources/_shared.py` and respect the HTTP configuration constants defined in `backend/utils/constants.py`.

All clients use `aiohttp` for async HTTP and `tenacity` for retry logic. Network errors and non-2xx responses always return empty lists so the RAG pipeline degrades gracefully rather than raising.

---

## Source Comparison Table

| Source | File | API Endpoint | Auth | Rate Limit | Content Type | Citation Count | Preprint Filter |
|--------|------|-------------|------|------------|-------------|---------------|----------------|
| Semantic Scholar | `semantic_scholar.py` | `https://api.semanticscholar.org/graph/v1/paper/search` | Optional API key | 100 req/5 min (unauth); 1 req/sec (auth) | Peer-reviewed papers | Yes | Yes |
| OpenAlex | `openalex.py` | `https://api.openalex.org/works` | None | Polite pool (mailto) | Peer-reviewed papers | Yes | Yes (API filter + secondary guard) |
| ClinicalTrials.gov | `clinicaltrials.py` | `https://clinicaltrials.gov/api/v2/studies` | None | 429 handling | Clinical trials | No (always 0) | N/A |
| FDA openFDA | `fda_drugs.py` | `https://api.fda.gov/drug/label.json` | None | 240 req/min anonymous | Drug labels | No (always 0) | N/A |
| RxNorm (NLM) | `rxnorm.py` | `https://rxnav.nlm.nih.gov/REST` | None | No published limit | Drug terminology | No (always 0) | N/A |
| MedlinePlus (NLM) | `medlineplus.py` | `https://wsearch.nlm.nih.gov/ws/query` | None | No published limit | Consumer health | No (always 0) | N/A |

---

## 1. Semantic Scholar

**File:** `backend/rag/sources/semantic_scholar.py`

### API Endpoint

`GET https://api.semanticscholar.org/graph/v1/paper/search`

### Authentication

Set `SEMANTIC_SCHOLAR_API_KEY` in `.env`. If present, the client adds an `x-api-key` header. The key is optional — the API works without it at a lower rate limit.

### Rate Limits

- Unauthenticated: 100 requests per 5 minutes
- Authenticated: approximately 1 request per second (higher quota)
- HTTP 429 responses return an empty list immediately (no retry)

### Fields Extracted

| Field | Description |
|-------|-------------|
| `paper_id` | Semantic Scholar internal ID |
| `title` | Full paper title |
| `abstract` | Full abstract text |
| `year` | Publication year |
| `citation_count` | Total inbound citations |
| `authors` | List of author name strings |
| `doi` | DOI (from `externalIds.DOI`) |
| `pmid` | PubMed ID (from `externalIds.PubMed`) |
| `publication_types` | Study design tags (e.g. `"Meta-Analysis"`, `"RCT"`) |
| `journal` | Journal or venue name |
| `tldr` | AI-generated one-sentence summary |
| `open_access_url` | URL to free full text |

### Preprint Filtering

`is_preprint(journal, open_access_url)` from `_shared.py` is applied to each parsed paper. Papers matching known preprint venues (arXiv, bioRxiv, medRxiv, SSRN, Research Square) are dropped before returning.

### Fallback Behaviour

- HTTP 429: logs a warning, returns `[]`
- Network error after 3 retries (tenacity, exponential backoff 1–8 s): re-raises `aiohttp.ClientError`
- Missing title: paper is skipped

---

## 2. OpenAlex

**File:** `backend/rag/sources/openalex.py`

### API Endpoint

`GET https://api.openalex.org/works`

### Authentication

None required. The client adds `mailto=pulse@health.app` as a query parameter to participate in the OpenAlex "polite pool", which receives faster response times and is less aggressively rate-limited.

### Rate Limits

- Polite pool (with mailto): no published hard limit, but high-volume use requires contact
- HTTP 429 and 503 responses return an empty list

### Fields Extracted

| Field | Description |
|-------|-------------|
| `work_id` | OpenAlex work ID (e.g. `W2741809807`) |
| `title` | Full title |
| `abstract` | Reconstructed from inverted index |
| `year` | Publication year |
| `citation_count` | Total inbound citations |
| `authors` | Author display names |
| `doi` | DOI extracted from `ids.doi` |
| `pmid` | PubMed ID from `ids.pmid` |
| `work_type` | OpenAlex work type (e.g. `"article"`, `"review"`) |
| `journal` | Journal name from `primary_location.source.display_name` |
| `is_open_access` | Boolean |
| `open_access_url` | Free full-text URL |

### Abstract Reconstruction

OpenAlex stores abstracts as inverted indexes (`{word: [position, ...]}`) to avoid copyright issues. The `_reconstruct_abstract()` function reverses this mapping by sorting `(position, word)` tuples and joining with spaces.

### Preprint Filtering

The API query includes `primary_location.source.type:journal` to filter out repository-hosted preprints at the API level. A secondary `is_preprint()` guard from `_shared.py` catches edge cases.

### Fallback Behaviour

- HTTP 429, 503: returns `[]`
- Papers with empty abstract after reconstruction are dropped
- Network errors after 3 retries: re-raises

---

## 3. ClinicalTrials.gov

**File:** `backend/rag/sources/clinicaltrials.py`

### API Endpoint

`GET https://clinicaltrials.gov/api/v2/studies`

Uses `query.cond` parameter for condition/keyword matching. Results are in API-default relevance order.

### Authentication

None. The API is publicly accessible.

### Rate Limits

- No hard limit published; 429/503 handling returns `[]`
- Results capped at 20 per call (`_MAX_RESULTS_CAP`) to avoid overwhelming the pipeline

### Fields Extracted

| Field | Source in API Response |
|-------|----------------------|
| `nct_id` | `protocolSection.identificationModule.nctId` |
| `title` | `protocolSection.identificationModule.briefTitle` |
| `abstract` | `protocolSection.descriptionModule.briefSummary` |
| `status` | `protocolSection.statusModule.overallStatus` |
| `year` | Parsed from `statusModule.startDateStruct.date` |
| `phase` | `protocolSection.designModule.phases[0]` |
| `enrollment` | `designModule.enrollmentInfo.count` |
| `sponsor` | `protocolSection.sponsorCollaboratorsModule.leadSponsor.name` |

### Preprint Filtering

Not applicable. All records are registered clinical trials.

### Fallback Behaviour

- HTTP 429, 503: returns `[]`
- Missing NCT ID or title: record is skipped
- `citation_count` is always `0` — ClinicalTrials has no citation metric

---

## 4. FDA openFDA

**File:** `backend/rag/sources/fda_drugs.py`

### API Endpoint

`GET https://api.fda.gov/drug/label.json`

Uses an exact phrase search on `openfda.generic_name` field.

### Authentication

None. Rate limits increase with an API key (not currently used).

### Rate Limits

- 240 requests per minute (anonymous)
- 120,000 requests per day (anonymous)
- HTTP 429, 503: returns `[]`
- Results capped at 10 per call (`_MAX_RESULTS_CAP`)

### Fields Extracted

| Field | Source |
|-------|--------|
| `set_id` | `raw.set_id` — FDA SPL Set ID |
| `generic_name` | `openfda.generic_name[0]` |
| `brand_name` | `openfda.brand_name[0]` |
| `manufacturer` | `openfda.manufacturer_name[0]` |
| `indications` | `indications_and_usage[0]` |
| `warnings` | `warnings[0]` |

The `abstract` is set to the first 500 characters of `indications`, falling back to `warnings`. The `title` is formatted as `"FDA Label: <brand_name or generic_name>"`.

### Preprint Filtering

Not applicable. FDA labels are official regulatory documents.

### Fallback Behaviour

- HTTP 404: drug not found, returns `[]`
- HTTP 429, 503: returns `[]`
- Missing `set_id` or `generic_name`: record is skipped
- `year` is always `None`; `doi` and `pmid` are always `None`

---

## 5. RxNorm (NLM)

**File:** `backend/rag/sources/rxnorm.py`

### API Endpoints

- `GET https://rxnav.nlm.nih.gov/REST/rxcui.json` — resolve name to RxCUI
- `GET https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/properties.json` — get canonical name
- `GET https://rxnav.nlm.nih.gov/REST/drugs.json` — search drug concepts

### Authentication

None. Freely accessible.

### Rate Limits

No published limit. The client does not use tenacity retries on this source; network errors return `[]` or the original drug name.

### Fields Extracted

| Field | Description |
|-------|-------------|
| `rxcui` | RxNorm Concept Unique Identifier |
| `name` | Canonical drug name |
| `synonym` | Alternate label |
| `tty` | Term type code (`"IN"` = ingredient, `"BN"` = brand name, `"SCD"` = semantic clinical drug) |

The `abstract` is formatted as `"{name} ({tty}) — RxCUI: {rxcui}"`. The `open_access_url` links to the RxNav concept browser.

### Key Function: `normalize_drug_name()`

This is a utility function used independently of the RAG pipeline. It resolves a free-text drug name (e.g. `"tylenol"`) to its canonical RxNorm name (`"Acetaminophen"`) via two sequential API calls. Returns the original name on any failure.

### Preprint Filtering

Not applicable. RxNorm is a controlled terminology.

### Fallback Behaviour

- HTTP 404: returns `[]`
- Non-200 responses: returns `[]`
- Network errors: returns `[]` (does not re-raise)

---

## 6. MedlinePlus (NLM)

**File:** `backend/rag/sources/medlineplus.py`

### API Endpoint

`GET https://wsearch.nlm.nih.gov/ws/query`

Uses `db=healthTopics` and `term={query}` parameters. The response format is XML.

### Authentication

None. Freely accessible.

### Rate Limits

No published limit.

### Fields Extracted

The response XML contains `<document>` elements with `<content name="...">` children:

| Content Name | Field |
|-------------|-------|
| `title` | Topic title |
| `FullSummary` | HTML-formatted summary text (stripped to plain text) |
| `organizationName` | Authoring organisation |
| `url` | Canonical MedlinePlus URL |

HTML tags are stripped from `FullSummary` using `xml.etree.ElementTree` (standard library — no third-party dependency). The `abstract` is set to the first 500 characters of the stripped summary.

### Preprint Filtering

Not applicable. MedlinePlus content is editorially reviewed by the NLM.

### Fallback Behaviour

- Non-200 HTTP response: logs warning, returns `[]`
- XML parse error: logs warning, returns `[]`
- Network error (`aiohttp.ClientError`): returns `[]`
- Missing title: record is skipped

---

## Shared Utilities

**File:** `backend/rag/sources/_shared.py`

### `format_authors(authors: list[str]) -> str`

Returns up to 3 author names joined by commas, appending `"et al."` if there are more than 3. Returns `"Unknown authors"` for an empty list.

### `is_preprint(journal: str | None, url: str | None) -> bool`

Returns `True` if the journal name or URL contains a known preprint venue identifier:
- arXiv
- bioRxiv
- medRxiv
- SSRN
- Research Square
- Preprints.org
