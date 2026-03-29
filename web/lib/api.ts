/**
 * Pulse API client for the Next.js web app.
 */

import type { AttachmentPayload, ChatResponse, DocumentAnalysisResult, HealthProfile } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

/**
 * Send a health question to the Pulse backend.
 *
 * @param userId - User ID for profile lookup
 * @param question - Health question text
 * @param conversationId - Optional existing conversation ID
 * @returns ChatResponse with answer, citations, triage level
 */
export async function sendChatMessage(
  userId: string,
  question: string,
  conversationId?: string,
  attachments?: AttachmentPayload[],
): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        question,
        conversation_id: conversationId ?? null,
        attachments: attachments ?? [],
      }),
    });
  } catch {
    throw new Error('Unable to reach Sana Health backend. Please ensure the server is running.');
  }
  if (!res.ok) {
    const detail = await res.json().then((d: { detail?: string }) => d.detail).catch(() => null);
    throw new Error(detail ?? `Chat failed: ${res.status}`);
  }
  return res.json() as Promise<ChatResponse>;
}

/** Metadata in the final SSE event from /api/chat/stream. */
export interface StreamMeta {
  citations: import('./types').Citation[];
  triage_level: string | null;
  health_domain: string;
  conversation_id: string;
  is_emergency: boolean;
}

/**
 * Stream a chat message via the SSE /api/chat/stream endpoint.
 *
 * @param userId - User ID for profile lookup
 * @param question - Health question text
 * @param conversationId - Optional existing conversation ID
 * @param attachments - Optional base64-encoded image/PDF attachments
 * @param onToken - Callback invoked with each streamed token
 * @param onMeta - Callback invoked once with final metadata
 */
export async function streamChatMessage(
  userId: string,
  question: string,
  conversationId: string | undefined,
  attachments: import('./types').AttachmentPayload[] | undefined,
  onToken: (token: string) => void,
  onMeta: (meta: StreamMeta) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        question,
        conversation_id: conversationId ?? null,
        attachments: attachments ?? [],
      }),
    });
  } catch {
    throw new Error('Unable to reach Sana Health backend. Please ensure the server is running.');
  }
  if (!res.ok) {
    const detail = await res.json().then((d: { detail?: string }) => d.detail).catch(() => null);
    throw new Error(detail ?? `Chat stream failed: ${res.status}`);
  }
  if (!res.body) throw new Error('Streaming not supported');

  const reader = res.body.getReader();
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
      } catch { /* ignore */ }
    }
  }
}

/**
 * Update (upsert) the user's health profile via PUT.
 *
 * @param userId - User ID
 * @param profile - Updated HealthProfile data
 * @returns Saved HealthProfile
 */
export async function updateHealthProfile(userId: string, profile: HealthProfile): Promise<HealthProfile> {
  const res = await fetch(`${API_BASE}/api/profile/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const detail = await res.json().then((d: { detail?: string }) => d.detail).catch(() => null);
    throw new Error(detail ?? `Profile update failed: ${res.status}`);
  }
  return res.json() as Promise<HealthProfile>;
}

/**
 * Fetch the user's health profile.
 *
 * @param userId - User ID
 * @returns HealthProfile or null if not found
 */
export async function fetchHealthProfile(userId: string): Promise<HealthProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/profile/${userId}`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json() as Promise<HealthProfile>;
  } catch {
    // Network error — backend may not be running; profile is non-fatal
    return null;
  }
}

/**
 * Upload a document for automatic classification and bloodwork extraction.
 *
 * If the document is classified as bloodwork, the response includes
 * `rated_results` with each lab rated as High / Normal / Low against
 * the user's personalized reference ranges (adjusted for age, sex, BMI).
 *
 * @param userId - Supabase auth user ID
 * @param file - File object selected by the user
 * @returns DocumentAnalysisResult — includes is_bloodwork and rated_results when applicable
 */
export async function analyzeDocument(
  userId: string,
  file: File,
): Promise<DocumentAnalysisResult> {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/documents/analyze`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error('Unable to reach Sana Health backend. Please ensure the server is running.');
  }
  if (!res.ok) {
    const detail = await res.json().then((d: { detail?: string }) => d.detail).catch(() => null);
    throw new Error(detail ?? `Document analysis failed: ${res.status}`);
  }
  return res.json() as Promise<DocumentAnalysisResult>;
}
