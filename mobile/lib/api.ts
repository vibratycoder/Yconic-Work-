/**
 * Pulse API client for the mobile app.
 * All requests go to the FastAPI backend.
 */

import { ChatResponse, DocumentAnalysisResult, HealthProfile, LabResult } from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Send a health question and receive a personalized, evidence-based response.
 *
 * @param userId - Authenticated Supabase user ID
 * @param question - User's health question
 * @param conversationId - Optional existing conversation ID for context
 * @returns ChatResponse with answer, citations, and triage level
 */
export async function sendChatMessage(
  userId: string,
  question: string,
  conversationId?: string,
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      question,
      conversation_id: conversationId ?? null,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat request failed: ${response.status} ${error}`);
  }
  return response.json() as Promise<ChatResponse>;
}

/**
 * Fetch the user's health profile from the backend.
 *
 * @param userId - Authenticated Supabase user ID
 * @returns HealthProfile or null if not found
 */
export async function fetchHealthProfile(userId: string): Promise<HealthProfile | null> {
  const response = await fetch(`${API_BASE}/api/profile/${userId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Profile fetch failed: ${response.status}`);
  return response.json() as Promise<HealthProfile>;
}

/**
 * Update (upsert) the user's health profile on the backend.
 *
 * @param userId - Authenticated Supabase user ID
 * @param profile - Full HealthProfile with updated fields
 * @returns Saved HealthProfile
 */
export async function updateHealthProfile(userId: string, profile: HealthProfile): Promise<HealthProfile> {
  const response = await fetch(`${API_BASE}/api/profile/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile update failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<HealthProfile>;
}

/**
 * Upload a lab report image for OCR extraction.
 *
 * @param userId - Authenticated Supabase user ID
 * @param imageUri - Local file URI of the lab report image
 * @param mimeType - MIME type of the image (default: image/jpeg)
 * @returns Extracted lab results and summary
 */
export async function uploadLabScan(
  userId: string,
  imageUri: string,
  mimeType: string = 'image/jpeg',
): Promise<{ extracted_results: LabResult[]; abnormal_count: number; total_count: number; import_summary: string }> {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('file', { uri: imageUri, type: mimeType, name: 'lab_report.jpg' } as unknown as Blob);

  const response = await fetch(`${API_BASE}/api/labs/scan`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Lab scan failed: ${response.status} ${error}`);
  }
  return response.json();
}

/**
 * Upload a document for automatic classification and bloodwork extraction.
 *
 * If the document is classified as bloodwork the response includes
 * `rated_results` with each lab rated as High / Normal / Low against
 * the user's personalised reference ranges (adjusted for age, sex, BMI).
 *
 * @param userId - Authenticated Supabase user ID
 * @param fileUri - Local file URI of the document
 * @param mimeType - MIME type of the file
 * @returns DocumentAnalysisResult — includes is_bloodwork and rated_results when applicable
 */
export async function analyzeDocument(
  userId: string,
  fileUri: string,
  mimeType: string = 'image/jpeg',
): Promise<DocumentAnalysisResult> {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('file', { uri: fileUri, type: mimeType, name: 'document' } as unknown as Blob);

  const response = await fetch(`${API_BASE}/api/documents/analyze`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Document analysis failed: ${response.status} ${error}`);
  }
  return response.json() as Promise<DocumentAnalysisResult>;
}

/** Metadata emitted in the final SSE event from /api/chat/stream. */
export interface StreamMeta {
  citations: import('./types').Citation[];
  triage_level: import('./types').TriageLevel;
  health_domain: string;
  conversation_id: string;
  is_emergency: boolean;
}

/**
 * Stream a chat message using the SSE /api/chat/stream endpoint.
 *
 * Calls onToken for each partial text token and onMeta once with the final
 * metadata (citations, triage level, conversation ID).
 *
 * @param userId - Authenticated Supabase user ID
 * @param question - User's health question
 * @param conversationId - Optional existing conversation ID
 * @param onToken - Callback invoked for each streamed token
 * @param onMeta - Callback invoked once with final metadata
 */
export async function streamChatMessage(
  userId: string,
  question: string,
  conversationId: string | undefined,
  onToken: (token: string) => void,
  onMeta: (meta: StreamMeta) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      question,
      conversation_id: conversationId ?? null,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat stream failed: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('Streaming not supported in this environment');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const event = JSON.parse(payload) as { token?: string; meta?: StreamMeta };
        if (event.token !== undefined) onToken(event.token);
        else if (event.meta !== undefined) onMeta(event.meta);
      } catch {
        // ignore malformed SSE line
      }
    }
  }
}

/**
 * Check a drug for interactions with the user's current medications.
 *
 * @param userId - Authenticated Supabase user ID
 * @param newDrug - Name of the drug to check
 * @returns Object with warnings list and echoed drug name
 */
export async function checkDrugInteractions(
  userId: string,
  newDrug: string,
): Promise<{ warnings: string[]; new_drug: string }> {
  const response = await fetch(`${API_BASE}/api/drug-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, new_drug: newDrug }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Drug check failed: ${response.status} ${error}`);
  }
  return response.json() as Promise<{ warnings: string[]; new_drug: string }>;
}

/**
 * Generate a doctor visit preparation summary.
 *
 * @param userId - Authenticated Supabase user ID
 * @returns Visit summary with medication list, abnormal labs, and doctor questions
 */
export async function generateVisitPrep(userId: string): Promise<object> {
  const response = await fetch(`${API_BASE}/api/visit-prep/${userId}`, {
    method: 'GET',
  });
  if (!response.ok) throw new Error(`Visit prep failed: ${response.status}`);
  return response.json();
}
