/**
 * Shared TypeScript types for the Pulse web app.
 */

export type LabStatus = 'normal' | 'low' | 'high' | 'critical' | 'unknown';
export type LabRating = 'High' | 'Normal' | 'Low' | 'Unknown';
export type LabSource = 'photo_ocr' | 'healthkit' | 'manual' | 'pdf';
export type TriageLevel = 'emergency' | 'urgent' | 'routine' | null;

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  prescribing_condition?: string;
}

export interface LabResult {
  id?: string;
  test_name: string;
  value?: number;
  value_text?: string;
  unit?: string;
  reference_range_low?: number;
  reference_range_high?: number;
  status: LabStatus;
  date_collected?: string;
  lab_source: LabSource;
}

/** A lab result enriched with a personalized High / Normal / Low rating. */
export interface RatedLabResult {
  test_name: string;
  value?: number;
  value_text?: string;
  unit?: string;
  /** Personalized three-tier rating adjusted for user demographics. */
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

export interface WearableSummary {
  avg_resting_heart_rate?: number;
  avg_hrv_ms?: number;
  avg_sleep_hours?: number;
  avg_sleep_quality?: string;
  avg_steps_per_day?: number;
  week_starting?: string;
}

export interface HealthProfile {
  user_id: string;
  display_name: string;
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  primary_conditions: string[];
  current_medications: Medication[];
  allergies: string[];
  recent_labs: LabResult[];
  health_facts: string[];
  wearable_summary?: WearableSummary;
  conversation_count: number;
}

export interface Citation {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  pubmed_url: string;
  display_summary: string;
}

/** A file attached to a chat message before sending. */
export interface AttachmentFile {
  id: string;
  file: File;
  /** Object URL for image previews (revoke after use). */
  previewUrl: string;
  mediaType: string;
}

/** Base64-encoded image payload sent to the backend. */
export interface AttachmentPayload {
  media_type: string;
  data: string; // base64
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Preview URLs of images attached to this message (for display). */
  attachmentPreviews?: string[];
  citations?: Citation[];
  triage_level?: TriageLevel;
  created_at: Date;
}

export interface ChatResponse {
  conversation_id: string;
  answer: string;
  citations: Citation[];
  health_domain: string;
  triage_level: TriageLevel;
}
