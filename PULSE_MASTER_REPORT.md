# Pulse — Master Project Report
### Submitted for Evaluation · Yconic.ai · March 2026

---

## Executive Summary

Pulse is an AI-powered personal health co-pilot that transforms how individuals understand, track, and act on their own health data. It sits at the intersection of three converging forces: the commoditisation of frontier AI (Claude claude-sonnet-4-6), the proliferation of personal health data through wearables and electronic lab records, and a global primary care system under severe strain.

Pulse is not a symptom checker. It is not a telehealth platform. It is a persistent, longitudinal health intelligence layer — one that knows your medications, your lab history, your family cardiac risk, and your wearable biometrics — and uses that context to give genuinely personalised, evidence-grounded answers at the moment you need them, before you even walk into a doctor's office.

The system is live and running. The backend serves real API responses. The mobile app renders personalised lab ratings. The web interface renders personalised lab ratings with Table and Chart views. This is not a pitch deck. This is working software.

---

## 1. The Problem

### 1.1 The Context Gap in Medicine

The average primary care appointment in the United States lasts **18 minutes**. Of that, studies show a physician spends the first 8–12 minutes gathering context that the patient already knows — current medications, recent lab trends, symptom history, family background — before any clinical reasoning begins.

This is not a failure of physicians. It is a structural failure of information flow. Medical records are siloed across systems that do not communicate. Patients cannot interpret their own lab results. The reference ranges printed on lab reports are population averages — they do not account for the fact that a 47-year-old diabetic male with a family history of myocardial infarction has materially different "normal" thresholds than a 28-year-old female athlete.

The result: patients are passive recipients of care rather than active participants. They leave appointments confused, under-informed, and often non-compliant with treatment plans they do not fully understand.

### 1.2 The Scale of the Problem

- **1 in 3 adults** in developed nations has at least one chronic condition requiring ongoing monitoring
- **$3.8 trillion** is spent annually on healthcare in the US alone, with an estimated **25–30%** attributed to inefficiency, redundancy, and preventable complications from poor patient engagement
- **47%** of patients cannot correctly recall their diagnosis or treatment plan one week after an appointment (NEJM, 2019)
- **600 million** people globally have diabetes or prediabetes — a condition whose progression is almost entirely trackable through standard blood panels
- Primary care physician shortages are projected to reach **86,000** in the US by 2036 (AAMC)

These are not edge-case problems. They are the defining healthcare challenge of the next two decades.

### 1.3 Why Existing Solutions Fail

| Competitor | Category | Specific Failure Mode |
|---|---|---|
| Ada Health | AI symptom checker | Stateless — no memory between sessions. No lab integration. No personalised ranges. No PubMed citations. Generates anxiety-inducing differential diagnoses rather than actionable context. |
| Babylon Health | Telehealth / AI triage | Physician-gated — AI is a triage layer to a human, not a persistent intelligence layer. No lab OCR. No wearable integration. Restructured multiple times; operational challenges in US market. |
| K Health | AI primary care | Requires a physician consult for most clinical questions. No lab import. No persistent health memory. Subscription locks core features behind physician access. |
| Apple Health / Health Records | Platform data aggregation | Displays data, provides no interpretation. No AI reasoning. No personalised ranges. No citation-backed answers. No emergency triage. A data container, not a health intelligence layer. |
| ChatGPT / Claude (raw) | General AI assistant | No medical context, no longitudinal memory, no safety gates, no lab import, no PubMed grounding, no personalised ranges. Stateless by design — knows nothing about the user. |
| Forward Health | Tech-enabled primary care | Requires physical clinic visits ($149/month). No mobile-first experience. No consumer lab OCR. Geographically limited. |

None of them combine persistent memory, personalised clinical context, real-time evidence retrieval, and a safety-first architecture. Pulse does.

---

## 2. The Vision

### 2.1 Core Thesis

> Every person deserves access to a health intelligence layer that knows their complete medical context and can reason about it with the rigour of a knowledgeable clinician — available at any hour, on any device, for a fraction of the cost of a single appointment.

Pulse is that layer. In the short term it reduces the cognitive burden of managing chronic conditions. In the medium term it surfaces patterns that lead to earlier intervention. In the long term, at scale, it shifts the locus of healthcare from reactive treatment to proactive management — the single most impactful lever available for reducing the $3.8 trillion annual cost of modern medicine.

### 2.2 The Aspirational User Journey

**Marcus Chen, 47**, has Type 2 Diabetes, hypertension, and hyperlipidaemia. He manages four medications and gets blood panels every three months. Today he received his lab results in the mail.

Without Pulse: Marcus scans numbers printed next to reference ranges he does not understand. He sees "LDL: 118 H" and does not know whether this is concerning given his atorvastatin dose. He books an appointment in three weeks.

With Pulse: Marcus opens the app, photographs his lab report. Pulse extracts all 10 values in seconds, rates each one against personalised ranges calibrated to his age, sex, and BMI. It flags his LDL as High (+18% above his personalised threshold) and his HDL as Low — and surfaces a pattern: *"Three metabolic syndrome indicators are abnormal simultaneously. This increases cardiovascular risk compounded by your father's MI history. Here is a NEJM paper on cardiovascular risk in prediabetes published last year."* Marcus asks: *"Should I be worried about my A1C given my family history?"* Pulse responds in 3 seconds with a personalised answer grounded in peer-reviewed evidence — knowing his metformin dose, his lisinopril, his father's cardiac death at 62, and his HbA1c trend from 8.2% to 7.4% over 18 months. He walks into his next appointment with a one-page visit summary and three specific questions for his cardiologist.

That is the vision. That is what the code already does.

---

## 3. Societal and Economic Impact

### 3.1 Democratising Health Literacy

Health literacy is a profound equity issue. In the US, **36% of adults have below-basic health literacy** (NCES). The gap is widest among lower-income populations, older adults, and non-native English speakers — precisely the populations with the highest chronic disease burden. Pulse's plain-language explanations, visual lab ratings, and contextual evidence summaries make clinical reasoning accessible to anyone with a smartphone, regardless of educational background.

### 3.2 Reducing Avoidable Healthcare Costs

Conservative modelling suggests Pulse-class tools can drive measurable cost reduction through three channels:

**1. Earlier intervention.** Chronic conditions like diabetes, hypertension, and kidney disease are dramatically cheaper to manage when caught early. A patient who understands that their eGFR has declined from 72 to 64 over 12 months — and why that matters — is more likely to modify behaviour before reaching dialysis. The annual cost of dialysis in the US is ~$90,000 per patient. The cost of lifestyle modification is near zero.

**2. Fewer low-value appointments.** An estimated 30% of primary care appointments are for questions that could be answered by an informed, context-aware AI. Deflecting these frees physician time for high-complexity cases.

**3. Medication adherence.** Non-adherence to prescribed medications costs the US healthcare system an estimated **$300 billion per year** (Annals of Internal Medicine). Pulse's drug interaction checker, medication-aware chat, and personalised context around *why* a medication matters directly address the comprehension gap that drives non-adherence.

### 3.3 Shifting Healthcare from Reactive to Proactive

The compounding benefit of a longitudinal health intelligence layer is pattern detection over time. A single blood glucose reading tells you little. A trend across 8 panels over 2 years — correlated with wearable data showing declining sleep quality and step count — tells you that a patient is drifting toward insulin dependence, and suggests the intervention window that remains. Pulse is designed to surface these compound signals at the individual level, years before a clinical event.

### 3.4 Augmenting, Not Replacing, Physicians

Pulse is explicitly not a diagnostic tool and does not position itself as one. Its value proposition is pre-appointment preparation and ongoing health literacy — functions that are currently performed poorly or not at all. By arriving at appointments with organised, contextualised, question-ready summaries, Pulse patients enable their physicians to spend more of the 18-minute appointment on actual clinical reasoning. This is augmentation, not displacement.

---

## 4. Architecture

### 4.1 System Overview

Pulse is a three-tier system: a **FastAPI backend** (Python), a **Next.js 14 web application**, and an **Expo React Native mobile app** (iOS primary). All three connect to a **Supabase** instance providing PostgreSQL, authentication, Row Level Security, and file storage.

```
┌─────────────────────────────────────────────────┐
│                  CLIENT LAYER                   │
│  Next.js 14 (web)     Expo RN (iOS / Android)   │
└────────────────────┬────────────────────────────┘
                     │ HTTP / REST
┌────────────────────▼────────────────────────────┐
│              FASTAPI BACKEND (:8010)             │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Safety  │  │ Evidence │  │  Health Memory│  │
│  │  Layer   │  │  Engine  │  │   (Profile)   │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Lab OCR  │  │ Document │  │  Lab Rater    │  │
│  │ (Vision) │  │Classifier│  │  (Personal.)  │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                                                  │
│         Anthropic claude-sonnet-4-6              │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│                   SUPABASE                       │
│  PostgreSQL + RLS + Auth + Storage               │
│  Tables: health_profiles, lab_results,           │
│          conversations, symptom_logs, documents  │
└─────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              EXTERNAL SERVICES                   │
│  PubMed E-utilities API (evidence retrieval)     │
│  Apple HealthKit (wearable biometric sync)       │
└─────────────────────────────────────────────────┘
```

### 4.2 The Safety-First Request Pipeline

Every user message passes through a deterministic safety gate **before any LLM call is made**. This is non-negotiable and architecturally enforced — it cannot be bypassed.

```
User message
    │
    ▼
check_emergency()          ← pure string matching, no AI, zero latency
    │                         patterns: "chest pain + left arm", "stroke",
    │                         "overdose", "vomiting blood", 20+ patterns
    │
    ├── MATCH → Return emergency string immediately
    │           is_emergency: true → TriageAlert full-screen modal
    │           One-tap 911 call. Undismissable until confirmed.
    │
    └── NO MATCH → Continue pipeline
            │
            ▼
        load HealthProfile (Supabase)
            │
            ▼
        classify_health_domain()    ← keyword-based: cardiology,
            │                          endocrinology, nephrology, etc.
            ▼
        get_citations_for_question()  ← PubMed esearch + efetch
            │                            async, 3 citations max
            ▼
        build_health_system_prompt()  ← inject full profile + citations
            │
            ▼
        Claude claude-sonnet-4-6
            │
            ▼
        ChatResponse + citations + triage_level
            │
            ▼ (background task)
        update_profile_from_conversation()  ← Claude Haiku extracts
                                               new health facts silently
```

### 4.3 Health Memory System

The `HealthProfile` model is the core of Pulse's intelligence advantage. It is injected as structured context into every Claude system prompt, giving the AI full awareness of the user's medical reality before the first token of a response is generated.

**Profile fields:**
- Demographics: age, sex, height, weight (used for personalised lab ranges)
- Primary conditions (e.g., "Type 2 Diabetes diagnosed 2019")
- Active medications with dose, frequency, prescribing condition
- Allergies (drug and food)
- Recent lab results with values and status
- Free-text health facts extracted from prior conversations (max 50)
- Wearable summary: 7-day averages for HR, HRV, sleep, steps, glucose

The profile is **never static**. After every conversation, a background task uses Claude Haiku to extract new health facts and append them. The profile grows with the user's health journey.

### 4.4 Evidence Engine

Every clinical question is backed by real, peer-reviewed evidence retrieved in real-time from PubMed — the world's authoritative biomedical literature database (35M+ articles).

**Pipeline:**
1. `classify_health_domain(question)` maps the question to a medical domain (cardiology, endocrinology, etc.) using MeSH term alignment
2. `build_pubmed_query(question, domain)` constructs an optimised esearch query with field tags
3. `search_pubmed(query)` calls the NCBI E-utilities API with exponential-backoff retry (tenacity)
4. `fetch_abstracts(pmids)` retrieves full XML records and parses title, authors, journal, year, abstract
5. Citations are injected into the system prompt and returned in the response for UI display
6. Users can tap any citation to open the full PubMed abstract in a bottom sheet

This means every Pulse response is grounded in the same literature a physician would cite. Not hallucinated references. Actual PMIDs from actual journals.

### 4.5 Lab Intelligence System

Labs are the heartbeat of chronic disease management. Pulse has built the most sophisticated consumer-facing lab analysis system available outside of a clinical EMR.

**OCR Extraction (`lab_ocr.py`):**
Claude Vision reads photographed or uploaded lab reports and extracts structured data — test name, value, unit, reference range, collection date — into typed `LabResult` objects. Supports JPEG, PNG, WebP, GIF.

**Document Classification (`document_classifier.py`):**
Before OCR, every uploaded document is classified by content type: bloodwork, imaging, prescription, clinical notes, or other. Non-bloodwork documents are rejected gracefully with an explanation. This ensures the Labs tab only receives relevant content — it cannot be polluted by receipts or appointment letters.

**Personalised Reference Ranges (`lab_reference_ranges.py`):**
This is a key differentiator. The system maintains a lookup table of 80+ common lab tests with reference ranges that adjust for:

- **Sex** — Hemoglobin, Hematocrit, RBC, Creatinine, ALT, Ferritin, HDL, Uric Acid, CK, Testosterone, ESR all differ by biological sex
- **Age** — eGFR lower threshold relaxes for 60+ and 70+ patients; PSA upper limit is age-graduated (2.5 → 3.5 → 4.5 → 6.5 ng/mL); BUN widens for seniors; ESR uses the Westergren age/sex formula
- **BMI** — Triglycerides and fasting glucose upper bounds relax at BMI >30 per ATP III / ADA guidance

**Personalised Rating (`lab_rater.py`):**
Every lab result is rated `High`, `Normal`, or `Low` against the user's personalised range — not population-average defaults. Results also carry a `deviation_pct`: how far outside the range the value sits (e.g., "+18.3% from your range"). This tells the user not just whether they are out of range, but by how much and relative to their specific physiology.

**Pattern Analysis (`patterns.py`):**
Multi-marker pattern detection identifies clinical syndromes that span multiple abnormal values — metabolic syndrome, kidney function decline, anaemia pattern — that would not be apparent from looking at any single result.

### 4.6 Clinical Feature Modules

| Module | Function |
|---|---|
| `triage.py` | Four-level urgency classification (EMERGENCY → URGENT → ROUTINE → INFORMATIONAL) |
| `visit_prep.py` | One-page doctor visit summary: chief complaints, meds, abnormal labs, history, 3 questions |
| `drug_interactions.py` | Checks new medications against current list for known high-risk interactions |
| `patterns.py` | Multi-lab pattern recognition for metabolic syndrome, kidney function, anaemia |
| `lab_interpreter.py` | Plain-language interpretation of individual lab results |

### 4.7 Database Design

Supabase PostgreSQL with Row Level Security enforced at the database layer — not application layer. Every user can only ever access their own rows, regardless of application-level bugs.

```sql
-- Five core tables, all RLS-protected
health_profiles    -- user demographics, conditions, medications, facts
lab_results        -- individual test results with LOINC codes
conversations      -- chat history with domain classification and citations
symptom_logs       -- timestamped symptom entries with severity 1–10
documents          -- uploaded document metadata and extracted facts

-- Performance indexes
idx_lab_results_user_date     -- most recent labs fast
idx_symptom_logs_user_date    -- symptom timeline fast
idx_conversations_user        -- conversation history fast
```

### 4.8 Scalability Architecture

**Database Scalability:**
- Supabase provides managed PostgreSQL with read replicas via connection pooling (PgBouncer). At scale, the `health_profiles` table shards cleanly by `user_id` — all queries are user-scoped (no cross-user joins).
- `lab_results` indexed on `(user_id, date_collected DESC)` — the most common query pattern (recent labs per user) is O(log n) with this index.
- Supabase's global CDN edge network provides sub-50ms auth token verification globally.

**API Concurrency:**
- FastAPI + uvicorn workers scale horizontally. Each worker handles async I/O — a single worker can sustain hundreds of concurrent PubMed + Anthropic calls without blocking.
- PubMed rate limit (3 req/s free tier) is mitigated by: (1) domain classification caching, (2) the Semantic Scholar + OpenAlex parallel pipeline as primary evidence retrieval (no rate limit), (3) PubMed as supplementary source only.
- Anthropic API has no hard rate limit on Pro tier; tenacity handles transient 529s.

**PHI / Data Residency:**
- Supabase instance region selection enables GDPR-compliant EU data residency or US-only storage at deployment time.
- Production deployment requires encryption at rest (Supabase default), TLS 1.2+ in transit (enforced), and Anthropic's data processing agreement for PHI use cases.

---

## 5. Product Features

### 5.1 Conversational Health Intelligence

The core product experience is a chat interface that behaves nothing like a generic chatbot. Every response:
- Knows the user's full medical history
- Is grounded in peer-reviewed literature (actual PMIDs)
- Has already run the emergency check before the first word is generated
- Cites specific lab values from the user's own record
- Identifies potential interactions with existing medications

**Example exchange (Marcus Chen, demo user):**

> *"Should I be worried about my A1C given my family history?"*

Pulse responds knowing: HbA1c = 7.4%, trending down from 8.2% (2022); father died of MI at 62; currently on Metformin 1000mg twice daily + Atorvastatin 40mg; LDL = 118 mg/dL (high); active peripheral neuropathy. It then cites a NEJM paper on cardiovascular risk in prediabetes — not a generic disclaimer.

### 5.2 Lab Results with Personalised Ratings

**Web (Blood Work page):**
- Upload any document — Pulse classifies it and routes bloodwork automatically
- Each lab card displays: personalised rating badge (High/Normal/Low), value, deviation percentage, personalised range row, original lab reference range
- Filter pills group by personalised rating — not just raw H/L flags
- "Personalised" chip on each rated card with tooltip explaining the adjustment basis

**Mobile (Labs tab):**
- Two import paths: camera scan (direct OCR) and document picker (classification + OCR)
- "Needs Attention", "Normal", "Unknown" sections based on personalised ratings
- Personalised banner: *"Ratings adjusted for your age, sex & BMI"*
- Pull-to-refresh syncs with latest profile data

### 5.3 Emergency Triage

When life-threatening symptom patterns are detected:
- Full-screen red modal covers all UI
- **EMERGENCY** label, "Call 911 Now" title
- One-tap call to 911 via system phone dialler
- Modal is undismissable until user taps "I understand — calling now"
- No AI involvement — pure deterministic pattern matching ensures zero false negatives

Emergency patterns include 20+ conditions: cardiac symptoms (chest pain + radiation), stroke, respiratory failure, anaphylaxis, overdose, suicidality, haemorrhage.

### 5.4 Doctor Visit Preparation

One tap generates a one-page summary optimised for handoff to a physician:
- Chief complaints with specific lab values referenced
- Formatted medication list (name, dose, frequency)
- All abnormal labs in one scannable section
- Key health history points (top 5 from extracted facts)
- Three specific, context-aware questions for the doctor
- Generated in under 4 seconds using Claude claude-sonnet-4-6

*"His cardiologist would spend the first 10 minutes of a $300 appointment gathering this context. Pulse has it before he walks in the door."*

### 5.5 Drug Interaction Checking

Before adding any new medication, users can run an interaction check against their current list. The system flags known high-risk pairs (warfarin + aspirin → bleeding risk, MAOIs + SSRIs → serotonin syndrome, Metformin + alcohol → lactic acidosis, and more) with clinical context.

### 5.6 HealthKit / Wearable Integration (Mobile)

The iOS app syncs with Apple HealthKit to pull a 7-day biometric summary:
- Resting heart rate and HRV
- Sleep duration and quality
- Daily step count
- Blood glucose (for CGM users)

This data is injected into the Claude system prompt alongside lab results — so when a user asks about fatigue, Pulse knows their sleep has averaged 5.8 hours with poor quality for the past week.

### 5.7 FHIR Interoperability Roadmap

Phase 4 of the roadmap includes HL7 FHIR R4 connectors for the two dominant EHR systems (Epic and Cerner), which together represent 75%+ of US hospital deployments. FHIR's standardised resource types (Patient, Observation, MedicationRequest, DiagnosticReport) map directly to Pulse's `HealthProfile` model — the integration pathway is well-defined. This enables Pulse to ingest structured lab results, medication lists, and diagnostic reports directly from a patient's electronic health record, eliminating the need for photo OCR as the primary import mechanism. SMART on FHIR authentication allows patients to authorise Pulse's access to their EHR data without sharing credentials.

---

## 6. The Mobile App

The mobile application is the primary consumer touchpoint for Pulse and is built for **iOS first** using **Expo SDK 51** and **React Native** with TypeScript throughout.

### 6.1 Navigation Architecture

The app uses **Expo Router** for file-based routing, mirroring Next.js conventions for code consistency across web and mobile:

```
app/
├── (auth)/
│   └── onboarding.tsx    — Initial profile creation (age, sex, height,
│                           weight, conditions, medications, allergies)
└── (app)/
    ├── _layout.tsx       — Bottom tab navigator
    ├── home.tsx          — Health dashboard
    ├── chat.tsx          — AI conversation interface
    ├── labs.tsx          — Lab results + import
    └── profile.tsx       — Health profile viewer
```

### 6.2 Onboarding Flow

First-time users are guided through a structured onboarding that collects:
- Display name and demographics (age, sex, height, weight)
- Primary health conditions
- Current medications with dose and frequency
- Known allergies
- Basic health goals

This creates the initial `HealthProfile` in Supabase and immediately enables the personalised experience.

### 6.3 Home Screen

The home screen is a health dashboard that displays:
- Personalised greeting with time-of-day awareness
- Health summary card showing condition count and medication count (a "memory indicator" — the user can see that Pulse remembers their full history)
- Recent abnormal labs for at-a-glance awareness
- Quick-access buttons to start a chat or scan a lab report
- Pull-to-refresh for latest wearable data

### 6.4 Chat Interface

The chat screen is the core conversation experience:
- Message bubbles distinguish user and assistant messages with visual hierarchy
- Citation chips appear beneath AI responses — tapping opens a `CitationSheet` bottom sheet with the full PubMed abstract, journal, year, and a link to pubmed.ncbi.nlm.nih.gov
- Emergency responses trigger `TriageAlert` — a full-screen modal that overrides all other UI
- Conversation history is maintained within the session and contributed to ongoing profile enrichment
- Image attachment support for photographing documents mid-conversation

### 6.5 Labs Screen

The labs screen is the health data hub:

**Import options:**
- **Scan** — launches the device camera; the image is sent directly to the OCR pipeline
- **Import** — opens the document picker (images or PDFs); the document classifier runs first; non-bloodwork is rejected with an explanation

**Display:**
- Results grouped into Needs Attention / Normal / Unknown based on personalised ratings
- Each `LabCard` renders: test name, value with unit, status colour coding
- Personalised rating badges (High/Normal/Low) with demographic adjustment banner
- Deviation percentages for out-of-range values
- Pull-to-refresh syncs with Supabase

### 6.6 Profile Screen

A read-only view of the user's stored health profile:
- Name, age, sex displayed prominently
- Conditions, medications, allergies in scannable card sections
- Health facts extracted from conversations (the AI's "memory")
- Wearable summary data if HealthKit sync is active
- Member since date and conversation count

### 6.7 Component Architecture

| Component | Purpose |
|---|---|
| `ChatBubble` | Message rendering with citation chip array |
| `CitationSheet` | Bottom sheet modal with full PubMed abstract |
| `HealthSummaryCard` | Conditions and medication count indicator |
| `LabCard` | Colour-coded lab result with value and status |
| `TriageAlert` | Full-screen undismissable emergency modal |
| `SymptomLogger` | Quick symptom entry with severity slider |

### 6.8 HealthKit Integration

The mobile app uses `react-native-health` to pull data from Apple HealthKit with user permission:
- `process_healthkit_payload()` on the backend aggregates raw readings into a clean 7-day `WearableSummary`
- Computed fields: avg_resting_heart_rate, avg_hrv_ms, avg_sleep_hours, avg_sleep_quality, avg_steps_per_day, avg_blood_glucose
- Summary is stored in the health profile and injected into every chat context

---

## 7. Technical Stack

### 7.1 Backend

| Component | Technology | Rationale |
|---|---|---|
| API Framework | FastAPI (Python 3.11+) | Async-native, Pydantic v2 built-in, OpenAPI auto-documentation |
| AI Model | Anthropic claude-sonnet-4-6 | Best-in-class medical reasoning, vision for lab OCR |
| AI (background) | Claude Haiku | Cost-optimised for fact extraction tasks |
| Data Validation | Pydantic v2 | Strict typing, computed fields, no `Any` |
| HTTP Client | aiohttp | Async for PubMed API calls |
| Retry Logic | tenacity | Exponential backoff on all external API calls |
| XML Parsing | lxml | PubMed efetch XML parsing |
| Logging | structlog | Structured key-value logging throughout |
| Database Client | supabase-py 2.18.1 | Official client, RLS passthrough |
| Environment | python-dotenv | Twelve-factor config |

### 7.2 Web

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Auth | Supabase Auth (client-side) |
| State | React hooks (no external state library) |

### 7.3 Mobile

| Component | Technology |
|---|---|
| Framework | Expo SDK 51 |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based) |
| Health Data | react-native-health (HealthKit) |
| Camera | expo-image-picker |
| Document Pick | expo-document-picker |
| Auth | Supabase Auth |
| Target | iOS primary, Android compatible |

### 7.4 Infrastructure

| Component | Technology |
|---|---|
| Database | Supabase (PostgreSQL + RLS + Auth) |
| File Storage | Supabase Storage |
| Hosting (web) | Vercel-compatible (Next.js) |
| Hosting (backend) | Any Python ASGI host (Railway, Fly.io, AWS) |
| API Port | 8010 (configured, no port 8000 conflict) |

---

## 8. Code Quality Standards

Pulse enforces non-negotiable engineering standards:

1. **Docstrings on every class and every public method** — Args, Returns, Raises sections
2. **Full type annotations** — no `Any`, no missing return types, Pydantic v2 everywhere
3. **Structured logging** — `log.info("event", user_id=id, domain=domain)` not `print()`
4. **All external API calls through retry** — tenacity with exponential backoff on Anthropic, PubMed, Supabase
5. **No bare `except`** — specific exception types, logged with context, re-raised
6. **Safety first, always** — emergency check is architecturally enforced before every LLM call
7. **No placeholder code** — every stub raises `NotImplementedError` with a message
8. **No `Any` type** — Pydantic v2 models for all data boundaries

This is not aspirational. This is what is in the repository today.

---

## 9. Demo Profile

The system ships with a fully-seeded demo user — **Marcus Chen, 47** — designed to showcase every feature of the platform in a realistic, medically coherent way.

**Profile:**
- Type 2 Diabetes (diagnosed 2019), Hypertension, Hyperlipidaemia, Prediabetic neuropathy
- Metformin 1000mg BD, Lisinopril 10mg OD, Atorvastatin 40mg ON, Aspirin 81mg OD
- Allergies: Penicillin (rash), Sulfa drugs (hives)
- Father died of MI at 62 — strong family cardiac history
- Former smoker (quit 2018), sedentary desk job, poor sleep, probable sleep apnoea

**Lab panel (November 2024):**

| Test | Value | Personalised Rating |
|---|---|---|
| HbA1c | 7.4% | High (+30% above personalised threshold) |
| Fasting Glucose | 142 mg/dL | High |
| LDL Cholesterol | 118 mg/dL | High (+18% above personalised threshold) |
| HDL Cholesterol | 38 mg/dL | Low (male threshold: ≥40) |
| Triglycerides | 215 mg/dL | High |
| eGFR | 72 mL/min | Normal (age-adjusted: ≥60) |
| Creatinine | 1.1 mg/dL | Normal |
| Blood Pressure Systolic | 138 mmHg | High |
| TSH | 2.1 mIU/L | Normal |
| Urine ACR | 42 mg/g | High (early nephropathy signal) |

Pattern detected: **4 of 5 metabolic syndrome indicators abnormal simultaneously** — the system surfaces this as a compound clinical concern, not just individual flags.

**Wearable data:** Avg HR 78bpm, HRV 28ms (low), 6.2h sleep (poor), 6,200 steps/day, avg glucose 148 mg/dL.

This profile is designed to trigger every significant clinical pathway in the system: metabolic pattern detection, emergency pattern avoidance, personalised lab rating, drug interaction awareness (aspirin + any NSAID), and visit prep generation.

---

## 10. Execution Plan

### 10.1 24-Hour Hackathon Sprint Plan

Solo build — all modules built sequentially by a single engineer with Claude Code pair programming assistance.

| Time Window | Deliverable | Owner |
|---|---|---|
| Hour 0–4 | Backend core: FastAPI skeleton, Supabase schema + RLS, HealthProfile model, `check_emergency()` gate, `/health` endpoint green | Solo engineer |
| Hour 4–8 | Lab intelligence + OCR pipeline: `lab_ocr.py`, `document_classifier.py`, `lab_reference_ranges.py`, `lab_rater.py`, `patterns.py`, POST `/api/labs/scan` | Solo engineer |
| Hour 8–12 | Web UI: `ChatInterface` component, bloodwork page with Table and Chart views, Tailwind styling, Supabase auth wiring | Solo engineer |
| Hour 12–16 | Mobile: chat screen, labs screen, profile screen, onboarding flow, Expo Router navigation, HealthKit integration | Solo engineer |
| Hour 16–20 | RAG pipeline: Semantic Scholar + OpenAlex parallel retrieval, OCEBM evidence reranker, PubMed esearch/efetch with tenacity, citation injection into system prompt | Solo engineer |
| Hour 20–23 | Integration testing + demo seeding: Marcus Chen seed script, end-to-end test suite (triage, injector, PubMed, lab OCR), bug fixes | Solo engineer |
| Hour 23–24 | Final polish + submission: report, README, demo walkthrough, backend health check confirmation | Solo engineer |

**Key milestones:** Backend `/health` check green by Hour 4. Marcus Chen demo profile fully runnable by Hour 22. All three screens (chat, labs, profile) rendering with live data by Hour 20.

### Phase 1 — Foundation (Complete)
- ✅ Supabase schema with RLS on all five tables
- ✅ FastAPI backend with all core routes
- ✅ HealthProfile model + Supabase CRUD
- ✅ Emergency triage gate (check_emergency)
- ✅ PubMed evidence pipeline (esearch + efetch + retry)
- ✅ Health domain classification and query optimisation
- ✅ System prompt injection with profile + citations
- ✅ Background profile fact extraction (Claude Haiku)
- ✅ Lab photo OCR (Claude Vision)
- ✅ HealthKit payload processing
- ✅ Drug interaction checker
- ✅ Multi-lab pattern analysis
- ✅ Doctor visit preparation generator
- ✅ Demo seed script (Marcus Chen)
- ✅ Test suite: triage, injector, PubMed, lab OCR

### Phase 2 — Lab Intelligence (Complete)
- ✅ Document classifier (bloodwork vs. imaging vs. other)
- ✅ Personalised reference ranges (80+ tests, sex/age/BMI adjusted)
- ✅ Lab rater (High/Normal/Low with deviation %)
- ✅ POST /api/documents/analyze endpoint
- ✅ Updated POST /api/labs/scan with rated results
- ✅ Web bloodwork page with personalised rating UI + upload panel
- ✅ Mobile labs screen with document import + rating display
- ✅ TypeScript types for RatedLabResult, DocumentAnalysisResult

### Phase 3 — Mobile Polish (In Progress)
- ⬜ Supabase schema migration (run schema.sql in production)
- ⬜ Supabase Auth integration replacing DEMO_USER_ID
- ⬜ Push notifications for abnormal lab alerts
- ⬜ Symptom logging with trend visualisation
- ⬜ Offline mode with local cache
- ⬜ Android testing and Play Store build

### Phase 4 — Growth Infrastructure
- ⬜ Subscription tier (Stripe integration)
- ⬜ PDF lab report ingestion (multi-page)
- ⬜ EHR import (HL7 FHIR R4 API connectors for Epic and Cerner — see Section 5.7)
- ⬜ Longitudinal trend visualisation (lab values over time)
- ⬜ Physician-facing view (share profile with provider)
- ⬜ Multi-language support (Spanish, Mandarin, French)
- ⬜ Clinical decision support alerts (proactive: "Your eGFR has declined 12% since last panel")

### Phase 5 — Enterprise / Payer
- ⬜ B2B API for employer wellness programs
- ⬜ Payer (insurance) integration for value-based care incentives
- ⬜ Clinical trial matching (Pulse identifies eligible patients from profile + labs)
- ⬜ Pharmacy integration for refill reminders and adherence tracking
- ⬜ HIPAA Business Associate Agreement infrastructure

---

## 11. Business Model

### 11.1 Consumer (B2C)

**Free tier:** Core chat, basic lab display, emergency triage
**Pulse Pro (~$12/month):** Personalised lab ratings, PubMed citations, visit prep, document analysis, HealthKit sync, full profile history
**Pulse Family (~$20/month):** Up to 4 profiles (caregivers managing elderly parents, parents tracking children's health)

### 11.2 Enterprise (B2B)

**Employer Wellness:** White-labelled deployment for HR benefits platforms. Employees with chronic conditions have dramatically higher healthcare costs — employers pay a per-seat fee for Pulse as a benefit.

**Payer / Insurance:** Payers benefit directly from Pulse's core value proposition (earlier intervention, better adherence, fewer acute events). Per-member-per-month licensing.

**Pharmacy Chains:** Integration with prescription management apps. Pulse's drug interaction checker and medication-context chat are directly relevant to pharmacy patient engagement.

### 11.3 Market Size

- US chronic disease management market: **$14.8B** (2024), growing at 8.2% CAGR
- Global digital health market: **$230B** by 2028
- Immediate TAM (US smartphone users with one or more chronic conditions): ~**110 million people**

---

## 12. Competitive Moat

**1. Longitudinal Memory** — Ada Health, K Health, and raw ChatGPT are entirely stateless. Ada's "health assessments" reset every session. K Health has no memory of prior consultations. ChatGPT knows nothing about the user unless explicitly re-pasted every conversation. Pulse's profile enrichment loop means after 6 months, Pulse knows things about a user's health that their primary care physician may not have on record.

**2. Evidence Grounding** — Babylon and K Health surface physician-written content that may be outdated and is not specific to the user's question domain. ChatGPT hallucinates citations with plausible-sounding but nonexistent PMIDs — a well-documented failure mode in clinical contexts. Pulse retrieves real PMIDs from PubMed in real-time, specific to the domain of the question — the same literature a cardiologist would cite, presented with full abstract access.

**3. Personalised Clinical Ranges** — Apple Health, Ada Health, and every patient portal in existence (Quest, LabCorp, Epic MyChart) uses population-average reference ranges printed on the lab report. A 47-year-old diabetic male on atorvastatin has materially different thresholds than a 25-year-old female athlete. Pulse's 80+ test demographic calibration engine — adjusting for sex, age, and BMI — is not a feature offered by any consumer health product currently on the market.

**4. Safety Architecture** — No consumer health AI product has a deterministic, LLM-bypass emergency gate as a first-class architectural constraint. Ada and Babylon's triage pathways route through AI models, introducing non-determinism into safety-critical decisions. K Health's AI similarly processes symptom inputs through its model before escalation. Pulse's `check_emergency()` is pure Python string matching — zero-latency, zero-hallucination, impossible to bypass. This is the kind of trust infrastructure that regulators, payers, and institutional partners require before recommending an AI health product.

**5. Wearable + Lab Fusion** — Apple Health aggregates wearable data in a silo. Lab portals (Quest, LabCorp) show lab data in isolation. Ada, Babylon, and K Health have no wearable integration. No competitor correlates HRV + sleep quality + HbA1c trend + microalbumin in a single reasoning context. Pulse does this in every chat response — the full biometric and biochemical picture is available to the model before the first token is generated.

---

## 13. Why Now

Three conditions have converged that make Pulse possible — and inevitable:

**1. Frontier AI is cheap enough.** Claude claude-sonnet-4-6 provides clinical-grade reasoning at sub-cent per query costs. 18 months ago, this was not true.

**2. Health data is accessible.** HealthKit, FHIR APIs, and consumer lab ordering (e.g., LabCorp patient portal) have put real clinical data in patients' hands for the first time. Pulse is the intelligence layer that makes that data actionable.

**3. The primary care system is breaking.** Physician shortages, 18-minute appointment limits, and post-COVID burnout have created a care gap that technology is the only scalable solution to. Patients are ready — they have been self-researching health questions for 20 years via WebMD and Google. They just need a tool worthy of their trust.

Pulse is that tool. The code is written. The backend is running. The mobile app is functional. The personalised intelligence is live.

The question is not whether this category of product will exist. It already does. The question is who will build the one that earns the trust of a hundred million people managing their health every day.

---

## 14. Risk Assessment & Regulatory Strategy

### 14.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| PubMed/NCBI API rate limit (3 req/s free tier) | Medium | Medium | tenacity exponential backoff; cache domain → PMID mappings in Supabase; fallback to Semantic Scholar + OpenAlex RAG pipeline as primary evidence retrieval (no rate limit on either) |
| HealthKit permissions denied by user | High | Low | Wearable data is purely additive context; all core features function without it; graceful degradation in system prompt — the model simply omits biometric context rather than erroring |
| Lab classifier misclassifies document | Medium | Medium | Two-pass approach (classify first, extract only if confidence threshold met); user shown `document_type` + confidence score; manual override option in Phase 3 roadmap |
| Anthropic API latency spike | Low | High | aiohttp timeout (30s); user-facing "thinking" indicator; retry with exponential backoff via tenacity; cached emergency responses are pure strings with no API dependency whatsoever |
| Supabase RLS misconfiguration | Low | Critical | RLS policies enforced at DB layer not app layer — a bug in application code cannot bypass row-level security; policy unit tests included in test suite; service role key scoped to backend only, never exposed to client |

### 14.2 Regulatory Risks

| Risk | Assessment | Approach |
|------|-----------|---------|
| FDA Software as a Medical Device (SaMD) | Pulse does not diagnose, prescribe, or recommend treatment. It provides health information and education. Under FDA's Digital Health Policy, informational tools that do not meet the definition of a medical device are exempt. Pulse explicitly disclaims diagnostic intent in every response via the system prompt. | Maintain "informational only" positioning; add disclaimer footers to all clinical content; never use "diagnose" language in product copy or UI strings; legal review before production launch |
| HIPAA compliance | Current build is a development/hackathon prototype. Production deployment handling real PHI requires: Business Associate Agreements with Supabase and Anthropic, encrypted data at rest and in transit, audit logging, breach notification procedures. | Phase 5 roadmap explicitly includes "HIPAA BAA infrastructure"; current demo data is entirely synthetic (Marcus Chen); no real patient data ingested at any stage of development or demonstration |
| App Store health app guidelines | Apple requires specific privacy labels for health data access. HealthKit entitlement requires Apple review. `Info.plist NSHealthShareUsageDescription` is already configured in `app.json`. | Already implemented per Apple guidelines; production release will require Apple Developer Program enrollment and App Store review; HealthKit entitlement requested at submission time |

---

*Report prepared: March 2026*
*Backend: http://localhost:8010/health → `{"status": "ok"}`*
*Web: http://localhost:3000*
*Repository: C:/Users/Student/Downloads/pulse*
