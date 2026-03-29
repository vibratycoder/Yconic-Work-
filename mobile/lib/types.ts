/**
 * Shared TypeScript types for the Pulse mobile app.
 */

/** Clinical status of a lab result relative to reference range. */
export type LabStatus = 'normal' | 'low' | 'high' | 'critical' | 'unknown';

/** Personalised three-tier rating adjusted for user demographics. */
export type LabRating = 'High' | 'Normal' | 'Low' | 'Unknown';

/** How a lab result was imported. */
export type LabSource = 'photo_ocr' | 'healthkit' | 'manual' | 'pdf';

/** Single medication with dose and frequency. */
export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  prescribing_condition?: string;
}

/** Single lab test result. */
export interface LabResult {
  id?: string;
  test_name: string;
  loinc_code?: string;
  value?: number;
  value_text?: string;
  unit?: string;
  reference_range_low?: number;
  reference_range_high?: number;
  status: LabStatus;
  date_collected?: string;
  lab_source: LabSource;
}

/** Weekly wearable biometric summary. */
export interface WearableSummary {
  avg_resting_heart_rate?: number;
  avg_hrv_ms?: number;
  avg_sleep_hours?: number;
  avg_sleep_quality?: string;
  avg_steps_per_day?: number;
  avg_blood_glucose?: number;
  week_starting?: string;
}

/** User's complete health profile. */
export interface HealthProfile {
  user_id: string;
  display_name: string;
  age?: number;
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  primary_conditions: string[];
  current_medications: Medication[];
  allergies: string[];
  recent_labs: LabResult[];
  health_facts: string[];
  wearable_summary?: WearableSummary;
  conversation_count: number;
}

/** Academic citation for evidence grounding (Google Scholar or PubMed). */
export interface Citation {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  pubmed_url: string;
  display_summary: string;
  source?: 'pubmed' | 'google_scholar';
}

/** Triage urgency level. */
export type TriageLevel = 'emergency' | 'urgent' | 'routine' | null;

/** Single chat message. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  triage_level?: TriageLevel;
  created_at: Date;
}

/** A lab result enriched with a personalised High / Normal / Low rating. */
export interface RatedLabResult {
  test_name: string;
  value?: number;
  value_text?: string;
  unit?: string;
  /** Personalised three-tier rating adjusted for user demographics. */
  rating: LabRating;
  personalized_range_low?: number;
  personalized_range_high?: number;
  original_status: LabStatus;
  /** Percentage outside the normal range (positive = high, negative = low, 0 = normal). */
  deviation_pct?: number;
  range_note?: string;
  date_collected?: string;
  lab_source: string;
}

export type DocumentType = 'bloodwork' | 'imaging' | 'prescription' | 'clinical_notes' | 'other';

/** Response from POST /api/documents/analyze. */
export interface DocumentAnalysisResult {
  is_bloodwork: boolean;
  document_type: DocumentType;
  confidence: number;
  detected_panels: string[];
  rated_results?: RatedLabResult[];
  abnormal_count?: number;
  total_count?: number;
  import_summary?: string;
}

/** API response from POST /api/chat. */
export interface ChatResponse {
  conversation_id: string;
  answer: string;
  citations: Citation[];
  health_domain: string;
  triage_level: TriageLevel;
}
