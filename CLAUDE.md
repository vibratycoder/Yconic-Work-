# Sana Health — Master Prompt

## What This Program Does

Sana Health is an AI health co-pilot that helps patients understand their medical data. A user signs up, enters their health history, and then asks questions about their conditions, medications, and lab results in a chat interface. The system answers using their personal health context and cites real peer-reviewed research. It can also read uploaded lab reports, rate each result against personalised reference ranges, check drug interactions, and generate a one-page summary for their next doctor visit.

The system runs as a FastAPI backend (deployed on Render), a Next.js 16 web app (deployed on Vercel), and an Expo React Native mobile app, all backed by Supabase (PostgreSQL with row-level security).

---

## How a User Gets Started

### Sign Up (web: auth/page.tsx, mobile: sign-in.tsx)
The user enters their name, email, phone, date of birth, and a password. Supabase Auth creates the account. The frontend then calls POST /api/profile to create an empty health profile in the database, and redirects to onboarding.

### Onboarding (web: onboarding/page.tsx, mobile: onboarding.tsx)
A 5-step wizard collects the user's health baseline:
1. **Demographics** — age, biological sex, height (ft/in, converted to cm), weight (lbs, converted to kg)
2. **Medical conditions** — pick from 26 common conditions (Type 2 Diabetes, Hypertension, COPD, etc.) or type custom ones
3. **Medications** — add each drug with name, dose, dose unit (mg/g/mL), and frequency (1-4x per day or as needed)
4. **Allergies** — pick from 15 common allergies (Penicillin, Sulfa drugs, Shellfish, etc.) or type custom ones
5. **Lifestyle & goals** — exercise frequency, sleep hours, smoking status, alcohol use, health goals

The answers from step 5 are converted into structured health facts (e.g. "Exercises 3-4 times per week", "Non-smoker") and stored in the health_facts array on the profile. The completed profile is saved via PUT /api/profile/{user_id} and the user enters the main app.

---

## How Chat Works

### What the user sees (web: ChatInterface.tsx, mobile: chat.tsx)
A full-screen chat interface with:
- A text input (1000 char max) with Send button, Enter to send, Shift+Enter for newline
- Camera button and file picker for attaching images (JPEG/PNG/GIF/WebP, 5MB max) or PDFs (32MB max)
- Drag-and-drop file upload on web
- A persistent health profile sidebar on the left showing all their medical data
- Messages stream in token-by-token with a typing indicator
- Each assistant message can have expandable citation cards below it linking to PubMed/Google Scholar
- Draft text auto-saves to localStorage

### What happens on the backend when a message is sent (POST /api/chat/stream)

**Step 1 — Emergency gate.** Before anything else, `check_emergency()` in health/injector.py runs the user's message through 21 AND-group string patterns. These are pure Python — no AI, no network call, no latency. Patterns include: ["chest pain", "left arm"], ["heart attack"], ["stroke"], ["not breathing"], ["suicidal"], ["overdose"], ["anaphylaxis"], ["severe", "allergic reaction"], and 13 more. If any pattern matches, the backend immediately returns a fixed 911 emergency response string. No Anthropic API call is made. This cannot be bypassed by prompt injection because no LLM is involved.

**Step 2 — Load health profile.** The backend calls get_profile() which queries the health_profiles table in Supabase, parses the user's medications, wearable summary, and member_since date, then separately queries the lab_results table (most recent 20, ordered by date_collected DESC) and attaches them to the profile. If the profile can't be loaded, chat continues with a blank default profile.

**Step 3 — Classify health domain.** classify_health_domain() in evidence/query_builder.py scans the message for keywords across 9 medical domains (cardiology, endocrinology, neurology, pulmonology, gastroenterology, nephrology, hematology, oncology, mental_health). This determines which MeSH terms to use in the PubMed search.

**Step 4 — Fetch citations.** get_citations_for_question() in evidence/pubmed.py builds a PubMed query with the classified domain's MeSH terms and a 5-year recency filter, sends it to PubMed E-utilities esearch API to get PMIDs, then fetches abstracts via efetch. The results are parsed from XML into Citation objects with pmid, title, journal, year, authors, abstract, and pubmed_url.

**Step 5 — Build system prompt.** build_health_system_prompt() in health/injector.py assembles a system prompt containing: the user's full health profile rendered as structured text (demographics, conditions, medications, allergies, abnormal labs, wearable data, health facts), followed by a formatted citation block with the PubMed results, followed by safety rules (always recommend professional medical advice, never diagnose, use the citations to ground responses).

**Step 6 — Stream response.** The backend opens an SSE (Server-Sent Events) connection and calls Claude claude-sonnet-4-6 via the Anthropic SDK's streaming API. Each text token is sent to the frontend as `data: {"token": "..."}`. When streaming completes, a final `data: {"meta": {...}}` event sends the citations array, triage level, health domain, and conversation ID. Then `data: [DONE]` signals the end.

**Step 7 — Triage badge.** classify_triage_level() runs the message through 15 urgent pattern groups (fever+stiff neck, blood in urine, shortness of breath at rest, sudden vision loss, etc.) to assign an EMERGENCY/URGENT/ROUTINE/INFORMATIONAL label for the UI.

**Step 8 — Background profile enrichment.** After the response is sent, a non-blocking background task calls update_profile_from_conversation() which sends the conversation to Claude Haiku with a prompt asking it to extract new health facts (e.g. "patient mentioned they started intermittent fasting"). New facts are deduplicated and appended to the user's health_facts array in Supabase. This means the profile gets richer with every conversation.

### How attachments work
When the user attaches images or PDFs, the frontend base64-encodes them and includes them in the request. The backend constructs a multi-modal content block for Claude — images go as `type: "image"` blocks, PDFs as `type: "document"` blocks. A directive prompt is appended explaining what to extract and how to relate it to the user's health profile.

---

## How Lab Upload and Rating Works

### What the user sees (web: bloodwork/page.tsx, mobile: labs.tsx)
The bloodwork page has an upload area. The user drops or selects a photo/PDF of their lab report. Results appear as colour-coded cards (red for High, green for Normal, blue for Low) with deviation percentages showing how far outside their personalised range each value is. A donut chart shows the overall distribution. Users can toggle between Table view (sortable columns) and Chart view (bullet charts showing value vs range). A filter lets them show only High, Normal, Low, or all results.

### What happens on the backend (POST /api/documents/analyze)

**Step 1 — Classification.** classify_document() in intake/document_classifier.py first runs a keyword pre-check against 30+ bloodwork terms (hemoglobin, glucose, creatinine, cbc, lipid panel, etc.). If keywords match, it's likely bloodwork. If not, Claude Vision classifies the document as bloodwork/imaging/prescription/clinical_notes/other with a confidence score and detected panels list.

**Step 2 — OCR extraction.** If the document is bloodwork, extract_lab_results_from_image() or extract_lab_results_from_pdf() in intake/lab_ocr.py sends the file to Claude Vision with a prompt asking it to extract every lab value into structured JSON: test_name, value, unit, reference_range_low, reference_range_high, status, date_collected. The JSON is parsed with fallback handling for malformed output.

**Step 3 — Personalised rating.** rate_lab_results() in features/lab_rater.py looks up each test in a database of 196 base reference ranges (features/lab_reference_ranges.py). These ranges are adjusted based on the user's demographics:
- **Sex-specific**: different ranges for RBC, Hemoglobin, Hematocrit, Creatinine, ALT, Ferritin, Iron, Testosterone, etc.
- **Age-adjusted**: custom functions for eGFR (declines with age), PSA (increases with age), BUN, and ESR
- **BMI-adjusted**: ranges shifted for certain metabolic markers

Each result gets a rating (High/Normal/Low/Unknown) and a deviation_pct showing how far outside the personalised range it falls (e.g. +18.3% above normal, -12.1% below normal, 0% for normal). A range_note explains adjustments (e.g. "adjusted for male sex", "adjusted for age 65+").

**Step 4 — Pattern detection.** identify_concerning_patterns() in features/patterns.py scans across all results looking for multi-marker patterns: metabolic syndrome (2+ of: high glucose, high triglycerides, low HDL, high blood pressure markers), kidney dysfunction (2+ of: high creatinine, low eGFR, high BUN), and anemia (2+ of: low hemoglobin, low RBC, low hematocrit).

---

## How the Health RAG Pipeline Works (POST /api/health-rag/query)

This is the deep evidence retrieval system, separate from the basic PubMed citations used in chat.

**Step 1 — Query expansion.** expand_query() in rag/query_expander.py sends the user's question plus their patient context (conditions, medications, age, sex) to Claude Haiku. Haiku generates 3 semantically diverse academic search queries — one clinical, one mechanistic, one epidemiological — using MeSH terms and Boolean operators.

**Step 2 — Parallel retrieval.** asyncio.gather() fires 6 concurrent HTTP requests: each of the 3 expanded queries is sent to both Semantic Scholar (200M+ papers) and OpenAlex (250M+ works). Semantic Scholar returns structured metadata including AI-generated TLDRs and study-type classifications. OpenAlex returns works with abstracts reconstructed from inverted indexes.

**Step 3 — OCEBM ranking.** rank_papers() in rag/reranker.py scores every retrieved paper using the Oxford Centre for Evidence-Based Medicine hierarchy:
- Evidence level 1-5: Systematic Review/Meta-Analysis (1) > RCT (2) > Cohort (3) > Case-Control (4) > Case Series/Expert Opinion (5)
- Composite score = 0.50 x evidence_quality + 0.30 x citation_weight (log-scaled) + 0.20 x recency_score (penalises older papers)
- Papers are deduplicated by DOI, PMID, and fuzzy title matching

**Step 4 — Evidence block assembly.** build_evidence_block() in rag/context_builder.py formats the top-ranked papers into a structured markdown block with star ratings (5 stars for systematic reviews, 1 star for case reports), numbered references, author lists, journal names, abstract snippets (600 char max), TLDRs when available, DOI/PMID links, and citation counts.

**Step 5 — Response.** The evidence block is returned along with the expanded queries, paper metadata, total candidate count, and which sources returned results.

---

## How Profile Editing Works

### What the user sees (web: EditProfileModal.tsx)
A modal with 5 tabs:
1. **Basics** — name, age, biological sex (male/female/other toggle), height (ft + in), weight (lbs)
2. **Conditions** — 26 common conditions as toggle pills, plus custom text entry
3. **Medications** — list of current meds with remove button, plus add form (name, dose amount, unit dropdown mg/g/mL, frequency dropdown)
4. **Allergies** — 15 common allergies as toggle pills, plus custom text entry
5. **Learned** — health facts organised by category (Exercise, Sleep, Smoking, Alcohol, Health Goals), plus facts learned from conversations, plus custom fact entry

### What happens when Save is clicked
The frontend sends only the editable fields to PUT /api/profile/{user_id} using the ProfileUpdate model — this deliberately excludes recent_labs (managed in the lab_results table), wearable_summary (managed via HealthKit sync), and member_since (immutable). The backend validates the payload, upserts to Supabase, then re-fetches the full profile (including fresh labs from the lab_results table) and returns it. The frontend then calls loadProfile() to re-fetch the complete profile, which updates the sidebar. The BMI calculator in the sidebar re-syncs its local state via useEffect hooks when the height/weight props change.

---

## How Drug Interaction Checking Works (POST /api/drug-check)

The user submits a new drug name. The backend loads their profile to get their current medications list. check_drug_interactions() in features/drug_interactions.py checks the new drug against 8 known high-risk interaction pairs (warfarin+aspirin, MAOI+SSRI, lithium+NSAIDs, methotrexate+NSAIDs, digoxin+amiodarone, ACE inhibitor+potassium-sparing diuretic, fluoroquinolone+antacid, statin+fibrate). Matching is bidirectional (checks both directions) and uses substring matching so brand names work. Returns a list of warning strings.

---

## How Visit Prep Works (GET /api/visit-prep/{user_id})

The backend loads the user's full health profile, formats it into a structured prompt, and sends it to Claude claude-sonnet-4-6 asking for a one-page doctor visit summary. The response is parsed into a VisitSummary with: chief_complaints, medication_list, abnormal_labs, health_history, questions_to_ask, and full_text. This gives the user a printable summary to bring to their appointment.

---

## How the Scrape Agent Works (backend/agents/scrape_agent.py)

This is a standalone CLI tool that autonomously updates the personalised lab reference ranges from medical literature.

```bash
python -m backend.agents.scrape_agent                    # all 31 biomarkers
python -m backend.agents.scrape_agent --tests "WBC,TSH"  # specific tests
python -m backend.agents.scrape_agent --dry-run           # preview without writing
```

For each of 31 biomarkers (WBC, Hemoglobin, Glucose, Creatinine, TSH, HbA1c, LDL, Ferritin, B12, Troponin, hs-CRP, Testosterone, PSA, etc.):
1. Searches PubMed for reference interval studies
2. Searches Google Scholar via the scholarly library
3. Sends retrieved abstracts to Claude asking it to extract numeric ranges (low, high, unit) with sex-specific and age-specific variants
4. Writes results to backend/data/scraped_ranges.py as Python dicts with full DOI/PMID citations
5. Logs provenance to a scrape.md file

The scraped ranges (currently 185 ranges from 28 peer-reviewed sources including NEJM, Blood, Ann Intern Med, WHO, ADA) supplement the 196 hardcoded base ranges. The lab rater checks scraped ranges first, falling back to base ranges.

---

## How the Sidebar Displays Data (web: HealthProfileSidebar.tsx)

The sidebar is always visible on the left during chat. It shows:
- **Header card**: user's name, age + sex, height + weight, and three stat boxes (condition count, medication count, abnormal lab count — the abnormal box turns orange when > 0)
- **BMI Calculator**: pre-filled from profile, recalculates live as you type; shows BMI value, category (Underweight/Normal/Overweight/Obese), and a colour gradient bar with marker
- **Conditions**: blue pill badges
- **Medications**: name in white, dose and frequency in muted text
- **Allergies**: red pill badges
- **Abnormal Labs**: test name with colour-coded value badge (red for critical, orange for high, blue for low)
- **Normal Labs**: first 5, muted style
- **Wearable data**: 7-day averages for heart rate, sleep, HRV, steps
- **Health facts**: grouped by questionnaire category (Exercise, Sleep, etc.), with a "Learned" bucket for facts extracted from conversations

---

## How the Bio Tracker Works (web: health-tracker/page.tsx)

A simulated health dashboard showing:
- **Live EKG monitor**: canvas-based waveform with mathematically modelled P, Q, R, S, T waves, per-beat variance in amplitude and period for realistic appearance, grid overlay, auto-scrolling
- **Heart rate**: updates every 1.6 seconds with sparkline history chart
- **Steps**: ring progress indicator, updates every 2.2 seconds
- **Calories**: ring progress indicator
- **Sleep breakdown**: horizontal bar showing Awake/REM/Light/Deep stages as percentages

---

## How Auth and Session Management Works

Supabase Auth handles all authentication. The web app uses getSupabaseClient() which initialises a singleton client — it throws an error if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars are missing. The next.config.mjs maps SUPABASE_URL → NEXT_PUBLIC_SUPABASE_URL for deployment environments that don't use the prefix. Sessions persist via Supabase's built-in session storage with auto-refresh. The root page (app/page.tsx) acts as an auth guard: unauthenticated users go to /auth, authenticated users without a health profile go to /onboarding, everyone else goes to chat.

---

## Database Schema (5 tables, all with RLS)

- **health_profiles**: user_id, display_name, age, sex, height_cm, weight_kg, primary_conditions (text[]), current_medications (jsonb[]), allergies (text[]), health_facts (text[]), wearable_summary (jsonb), conversation_count, member_since, updated_at
- **lab_results**: user_id, test_name, loinc_code, value, value_text, unit, reference_range_low, reference_range_high, status (normal/low/high/critical/unknown), date_collected, lab_source (photo_ocr/healthkit/manual/pdf)
- **conversations**: user_id, messages, health_domain, citations, triage_level
- **symptom_logs**: user_id, symptoms, severity (1-10), notes, logged_at
- **documents**: user_id, filename, storage_path, document_type, extracted_facts

All tables enforce `auth.uid() = user_id` via RLS policies. Performance index on lab_results(user_id, date_collected DESC).

---

## Non-negotiables
- Emergency triage (check_emergency) runs BEFORE every LLM call — no exceptions
- Full docstrings + type annotations everywhere
- Structured logging via utils/logger.py — never print()
- No Any type, no bare except, no placeholder pass

## Tech stack
- Backend: FastAPI, Pydantic v2, Anthropic SDK (claude-sonnet-4-6 for chat, Haiku 4.5 for background), aiohttp, tenacity, lxml, supabase-py, scholarly
- Web: Next.js 16, React 19, TypeScript strict, Tailwind CSS
- Mobile: Expo SDK 51, React Native, react-native-health (HealthKit)
- DB: Supabase (PostgreSQL + RLS + Auth)

## Commit format
feat(scope): description
fix(scope): description
chore: description
docs: description
test(scope): description
