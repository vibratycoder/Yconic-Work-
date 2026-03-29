# Changelog

## [0.1.0] - 2026-03-28

### Added
- Supabase schema: health_profiles, lab_results, conversations, symptom_logs, documents with RLS
- FastAPI backend skeleton with health check endpoint
- Core data models: HealthProfile, LabResult, Medication, WearableSummary
- Emergency triage system (check_emergency) — safety gate before all LLM calls
- PubMed evidence pipeline: esearch + efetch + XML parsing
- Health domain classification and query optimization
- Health profile injection system prompt builder
- Lab photo OCR via Claude Vision
- HealthKit payload processing and wearable summary computation
- Background health fact extraction after conversations
- Doctor visit preparation summary generator
- Drug interaction checker
- Lab result pattern analysis
- Demo seed script with Marcus Chen profile
- Test suite: triage, injector, pubmed, lab OCR
