/**
 * Main chat interface for the Pulse web demo.
 * Shows health profile sidebar always visible alongside the conversation.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AttachmentFile, AttachmentPayload, ChatMessage, HealthProfile } from '../lib/types';
import { streamChatMessage, fetchHealthProfile } from '../lib/api';
import { signOut } from '../lib/supabase';
import { CitationCard } from './CitationCard';
import { HealthProfileSidebar } from './HealthProfileSidebar';
import { EditProfileModal } from './EditProfileModal';

interface ChatInterfaceProps {
  /** Authenticated Supabase user ID. */
  userId: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB — Anthropic image limit
const MAX_PDF_BYTES   = 32 * 1024 * 1024;  // 32 MB — Anthropic document limit
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_FILE_TYPES  = [...ACCEPTED_IMAGE_TYPES, 'application/pdf'];

/** Read a File as a base64-encoded string (without the data-URL prefix). */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Full-page chat interface with persistent health profile sidebar.
 *
 * Supports text messages and image/photo attachments.
 * Uses the dark indigo (#1a1a3e) AI Advice scene palette.
 */
export function ChatInterface({ userId }: ChatInterfaceProps): React.ReactElement {
  const router = useRouter();
  const DRAFT_KEY = `pulse_draft_${userId}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [input, setInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`pulse_draft_${userId}`) ?? '';
  });
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async (): Promise<void> => {
    const p = await fetchHealthProfile(userId);
    setProfile(p);
  }, [userId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, input); }, [DRAFT_KEY, input]);

  /** Add files from an input change event, validating type and size. */
  const handleFilesSelected = useCallback((files: FileList | null): void => {
    if (!files) return;
    setAttachError(null);
    const next: AttachmentFile[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        setAttachError(`"${file.name}" is not supported. Use JPEG, PNG, GIF, WebP, or PDF.`);
        continue;
      }
      const limit = file.type === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
      const limitLabel = file.type === 'application/pdf' ? '32 MB' : '5 MB';
      if (file.size > limit) {
        setAttachError(`"${file.name}" exceeds the ${limitLabel} limit.`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: file.type === 'application/pdf' ? '' : URL.createObjectURL(file),
        mediaType: file.type,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const removeAttachment = useCallback((id: string): void => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;

    // Build display previews for the outgoing message
    const previewUrls = attachments.map((a) => a.previewUrl);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text || `[${attachments.length} image${attachments.length > 1 ? 's' : ''} attached]`,
      attachmentPreviews: previewUrls.length > 0 ? previewUrls : undefined,
      created_at: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    localStorage.removeItem(DRAFT_KEY);
    setAttachError(null);

    // Encode images to base64
    let payloads: AttachmentPayload[] = [];
    try {
      payloads = await Promise.all(
        attachments.map(async (a) => ({
          media_type: a.mediaType,
          data: await fileToBase64(a.file),
        })),
      );
    } catch {
      // encoding failure is non-fatal — send text only
    }
    setAttachments([]);
    setLoading(true);

    // Placeholder message — fills in token-by-token via SSE
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      created_at: new Date(),
    }]);

    try {
      await streamChatMessage(
        userId,
        text,
        conversationId,
        payloads,
        (token) => {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m,
          ));
        },
        (meta) => {
          setConversationId(meta.conversation_id);
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId
              ? { ...m, citations: meta.citations, triage_level: meta.triage_level as ChatMessage['triage_level'] }
              : m,
          ));
          void loadProfile();
        },
      );
    } catch (err) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: err instanceof Error ? err.message : 'Unable to reach Sana Health. Please ensure the backend is running.' }
          : m,
      ));
    } finally {
      setLoading(false);
    }
  }, [input, attachments, loading, conversationId, loadProfile, userId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  /** Wipe message history and reset the conversation. */
  const handleClearChat = useCallback((): void => {

    setMessages([]);
    setConversationId(undefined);
    localStorage.removeItem(DRAFT_KEY);
  }, [DRAFT_KEY]);

  return (
    <div className="flex h-screen" style={{ background: 'radial-gradient(ellipse at center, #071e3d, #04090f)' }}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />

      {editProfileOpen && profile && (
        <EditProfileModal
          profile={profile}
          userId={userId}
          onSaved={() => { void loadProfile(); setEditProfileOpen(false); }}
          onClose={() => setEditProfileOpen(false)}
        />
      )}

      <HealthProfileSidebar profile={profile} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ background: 'transparent', borderBottom: '1px solid rgba(56,189,248,0.1)' }}
        >
          {/* Nav tabs */}
          <div className="flex items-center gap-1">
            <button
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{
                color: '#38bdf8',
                background: 'linear-gradient(135deg, rgba(3,105,161,0.2) 0%, rgba(14,165,233,0.1) 100%)',
                border: '1px solid rgba(56,189,248,0.3)',
                boxShadow: '0 0 16px rgba(56,189,248,0.15)',
              }}
            >
              Chat
            </button>
            <button
              onClick={() => router.push('/bloodwork')}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid transparent', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              Blood Work
            </button>
            <button
              onClick={() => router.push('/health-tracker')}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid transparent', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              Bio Tracker
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(239,68,68,0.7)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; }}
            >
              Clear chat
            </button>
            <button
              onClick={() => setEditProfileOpen(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              Edit profile
            </button>
            <button
              onClick={() => { void signOut().then(() => router.replace('/auth')); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="mt-16 text-center">
              <p className="text-xl font-semibold text-white/80">Ask anything about your health</p>
              <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Try: "What does my LDL of 158 mean?" or attach a photo of your lab results
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={msg.role === 'user' ? 'max-w-sm' : 'max-w-2xl'}>
                {/* Image attachments */}
                {msg.attachmentPreviews && msg.attachmentPreviews.length > 0 && (
                  <div className={`flex gap-2 mb-2 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.attachmentPreviews.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`attachment ${i + 1}`}
                        className="h-32 w-32 rounded-xl object-cover"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    ))}
                  </div>
                )}
                <div
                  className="rounded-2xl px-4 py-3"
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, rgba(3,105,161,0.12), rgba(14,165,233,0.06))', color: '#fff', borderRadius: '18px 18px 4px 18px', border: '1px solid rgba(56,189,248,0.15)', boxShadow: '0 0 24px rgba(56,189,248,0.08)' }
                    : { background: 'linear-gradient(135deg, rgba(3,105,161,0.25), rgba(14,165,233,0.15))', color: '#e2e8f0', border: '1px solid rgba(56,189,248,0.18)', borderRadius: '18px 18px 18px 4px', boxShadow: '0 0 16px rgba(56,189,248,0.2)' }
                  }
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-1">
                    {msg.citations.map((citation, i) => (
                      <CitationCard key={citation.pmid} citation={citation} index={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3" style={{ background: 'linear-gradient(135deg, rgba(3,105,161,0.25), rgba(14,165,233,0.15))', border: '1px solid rgba(56,189,248,0.18)', boxShadow: '0 0 16px rgba(56,189,248,0.2)' }}>
                <div className="flex gap-1.5 items-center">
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className="h-2 w-2 rounded-full animate-bounce"
                      style={{ backgroundColor: '#38bdf8', animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className="px-6 py-4 flex-shrink-0 relative"
          style={{ borderTop: '1px solid rgba(56,189,248,0.1)', background: 'linear-gradient(160deg, rgba(13,36,64,0.9), rgba(5,14,28,0.95))', backdropFilter: 'blur(12px)' }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag-and-drop overlay */}
          {isDragging && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-t-xl pointer-events-none"
              style={{ background: 'linear-gradient(160deg, rgba(13,36,64,0.92), rgba(5,14,28,0.88))', border: '2px dashed rgba(56,189,248,0.6)', backdropFilter: 'blur(8px)', boxShadow: 'inset 0 0 40px rgba(56,189,248,0.05)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: '#38bdf8' }}>Drop images here</p>
              <p className="text-xs" style={{ color: 'rgba(56,189,248,0.7)' }}>JPEG · PNG · WebP · GIF (5 MB) · PDF (32 MB)</p>
            </div>
          )}
          {/* Attachment error */}
          {attachError && (
            <div className="mb-3 rounded-xl px-3 py-2 text-xs"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              {attachError}
            </div>
          )}

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {attachments.map((a) => (
                <div key={a.id} className="relative group">
                  {a.mediaType === 'application/pdf' ? (
                    /* PDF tile */
                    <div
                      className="h-16 w-36 rounded-xl flex items-center gap-2 px-3"
                      style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#fca5a5', maxWidth: '80px' }}>{a.file.name}</p>
                        <p className="text-xs" style={{ color: 'rgba(252,165,165,0.6)' }}>{(a.file.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                  ) : (
                    /* Image tile */
                    <>
                      <img
                        src={a.previewUrl}
                        alt={a.file.name}
                        className="h-16 w-16 rounded-xl object-cover"
                        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 rounded-b-xl px-1 py-0.5 text-center"
                        style={{ backgroundColor: 'rgba(0,0,0,0.55)', fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                        {(a.file.size / 1024).toFixed(0)} KB
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: '#ef4444', color: 'white' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 items-end">
            {/* Camera button */}
            <button
              title="Take a photo"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.07), rgba(6,182,212,0.03))', border: '1px solid rgba(56,189,248,0.18)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(14,165,233,0.08))'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(56,189,248,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(14,165,233,0.07), rgba(6,182,212,0.03))'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.18)'; e.currentTarget.style.boxShadow = ''; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>

            {/* File / gallery button */}
            <button
              title="Attach image"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.07), rgba(6,182,212,0.03))', border: '1px solid rgba(56,189,248,0.18)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(14,165,233,0.08))'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(56,189,248,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(14,165,233,0.07), rgba(6,182,212,0.03))'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.18)'; e.currentTarget.style.boxShadow = ''; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>

            <textarea
              className="flex-1 resize-none rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors"
              style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.07), rgba(6,182,212,0.03))',
                border: '1px solid rgba(56,189,248,0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your labs, symptoms, medications, or attach a photo…"
              rows={2}
              maxLength={1000}
            />
            <button
              className="btn-primary flex-shrink-0 px-5 py-3 text-sm"
              onClick={() => void handleSend()}
              disabled={(!input.trim() && attachments.length === 0) || loading}
            >
              Send
            </button>
          </div>

          <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Enter to send · Shift+Enter for new line · Images up to 5 MB · PDFs up to 32 MB · Sana Health is not a substitute for professional medical advice
          </p>
        </div>
      </div>
    </div>
  );
}
