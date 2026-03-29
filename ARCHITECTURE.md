# Pulse — Architecture

## System overview
Two core systems power every response:
1. HEALTH MEMORY — persistent HealthProfile injected as system prompt context
2. EVIDENCE ENGINE — PubMed E-utilities fetches peer-reviewed citations per question

## Request flow
User question
  → check_emergency() [deterministic, no LLM]
  → load HealthProfile from Supabase
  → classify_health_domain(question)
  → get_citations_for_question(question, domain) [PubMed API]
  → build_health_system_prompt(profile, citations)
  → Anthropic claude-sonnet-4-6
  → return answer + citations
  → [background] update_profile_from_conversation()

## Backend modules
- health/injector.py: emergency check + system prompt assembly
- health/profile.py: Supabase CRUD for HealthProfile
- health/updater.py: background health fact extraction post-conversation
- evidence/pubmed.py: PubMed esearch + efetch + XML parsing
- evidence/query_builder.py: health domain classification + query optimization
- evidence/citation_formatter.py: citation formatting utilities
- intake/lab_ocr.py: Claude Vision lab result extraction
- intake/healthkit_sync.py: HealthKit payload processing
- features/triage.py: extended triage logic
- features/visit_prep.py: doctor visit summary generation

## Database (Supabase)
Tables: health_profiles, lab_results, conversations, symptom_logs, documents
All tables have RLS enabled — users access only their own data

## Mobile (Expo / React Native)
- iOS primary, HealthKit integration
- Screens: onboarding, home, chat, labs, profile
- Components: ChatBubble, LabCard, CitationSheet, TriageAlert

## Web (Next.js 14)
- Demo surface
- HealthProfileSidebar always visible during chat
- CitationCard with expandable abstracts
