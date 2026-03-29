'use client';

/**
 * Blood work results page — displays lab results with personalised High / Normal / Low
 * ratings adjusted for the user's age, sex, and BMI.  Supports direct document upload
 * which classifies the file and routes bloodwork results here automatically.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../../lib/supabase';
import { fetchHealthProfile, analyzeDocument } from '../../lib/api';
import type { LabResult, LabStatus, LabRating, RatedLabResult, HealthProfile } from '../../lib/types';

/* ── Status / Rating config ─────────────────────────────────────────────── */

interface StatusConfig {
  label: string;
  color: string;
  dimColor: string;
  bg: string;
  border: string;
  glow: string;
  dot: string;
}

const STATUS_CONFIG: Record<LabStatus, StatusConfig> = {
  critical: {
    label: 'Critical',
    color: '#ff453a',
    dimColor: 'rgba(255,69,58,0.7)',
    bg: 'linear-gradient(135deg, rgba(255,45,85,0.18) 0%, rgba(220,38,38,0.1) 100%)',
    border: 'rgba(255,69,58,0.45)',
    glow: '0 0 20px rgba(255,45,85,0.35), 0 0 40px rgba(255,45,85,0.12)',
    dot: '#ff453a',
  },
  high: {
    label: 'High',
    color: '#ff9f0a',
    dimColor: 'rgba(255,159,10,0.7)',
    bg: 'linear-gradient(135deg, rgba(255,159,10,0.15) 0%, rgba(234,88,12,0.08) 100%)',
    border: 'rgba(255,159,10,0.4)',
    glow: '0 0 20px rgba(255,159,10,0.28), 0 0 40px rgba(255,159,10,0.1)',
    dot: '#ff9f0a',
  },
  low: {
    label: 'Low',
    color: '#0a84ff',
    dimColor: 'rgba(10,132,255,0.7)',
    bg: 'linear-gradient(135deg, rgba(10,132,255,0.15) 0%, rgba(59,130,246,0.08) 100%)',
    border: 'rgba(10,132,255,0.4)',
    glow: '0 0 20px rgba(10,132,255,0.28), 0 0 40px rgba(10,132,255,0.1)',
    dot: '#0a84ff',
  },
  normal: {
    label: 'Normal',
    color: '#30d158',
    dimColor: 'rgba(48,209,88,0.7)',
    bg: 'linear-gradient(135deg, rgba(48,209,88,0.12) 0%, rgba(22,163,74,0.06) 100%)',
    border: 'rgba(48,209,88,0.35)',
    glow: '0 0 20px rgba(48,209,88,0.22), 0 0 40px rgba(48,209,88,0.08)',
    dot: '#30d158',
  },
  unknown: {
    label: 'Unknown',
    color: '#8e8e93',
    dimColor: 'rgba(142,142,147,0.6)',
    bg: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
    border: 'rgba(255,255,255,0.12)',
    glow: 'none',
    dot: '#8e8e93',
  },
};

/** Maps the personalised LabRating to a visual config (reuses STATUS_CONFIG entries). */
const RATING_CONFIG: Record<LabRating, StatusConfig> = {
  High:    STATUS_CONFIG.high,
  Low:     STATUS_CONFIG.low,
  Normal:  STATUS_CONFIG.normal,
  Unknown: STATUS_CONFIG.unknown,
};

const STATUS_ORDER: LabStatus[] = ['critical', 'high', 'low', 'normal', 'unknown'];
const RATING_ORDER: LabRating[] = ['High', 'Low', 'Normal', 'Unknown'];

/* ── Helper ─────────────────────────────────────────────────────────────── */

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function rangeLabel(lab: LabResult): string {
  if (lab.reference_range_low != null && lab.reference_range_high != null) {
    return `${lab.reference_range_low} – ${lab.reference_range_high} ${lab.unit ?? ''}`.trim();
  }
  if (lab.reference_range_low != null) return `≥ ${lab.reference_range_low} ${lab.unit ?? ''}`.trim();
  if (lab.reference_range_high != null) return `≤ ${lab.reference_range_high} ${lab.unit ?? ''}`.trim();
  return '—';
}

function displayValue(lab: LabResult): string {
  if (lab.value != null) return `${lab.value}${lab.unit ? ' ' + lab.unit : ''}`;
  if (lab.value_text) return lab.value_text;
  return '—';
}

/* ── Components ─────────────────────────────────────────────────────────── */

interface LabCardProps {
  lab: LabResult;
  rated?: RatedLabResult;
}

function LabCard({ lab, rated }: LabCardProps): React.ReactElement {
  // Use personalised rating when available, fall back to original status
  const ratingCfg = rated ? RATING_CONFIG[rated.rating] : null;
  const cfg = ratingCfg ?? STATUS_CONFIG[lab.status];
  const badgeLabel = rated ? rated.rating : STATUS_CONFIG[lab.status].label;

  const personalizedRangeLabel =
    rated && (rated.personalized_range_low != null || rated.personalized_range_high != null)
      ? [
          rated.personalized_range_low != null ? `${rated.personalized_range_low}` : '—',
          rated.personalized_range_high != null ? `${rated.personalized_range_high}` : '—',
        ].join(' – ') + (lab.unit ? ` ${lab.unit}` : '')
      : null;

  const deviationLabel =
    rated && rated.deviation_pct != null && rated.deviation_pct !== 0
      ? `${rated.deviation_pct > 0 ? '+' : ''}${rated.deviation_pct.toFixed(1)}%`
      : null;

  return (
    <div
      className="rounded-2xl px-5 py-4 transition-all duration-200"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: `${cfg.glow}, 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm font-semibold text-white leading-snug">{lab.test_name}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Personalised rating badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              color: cfg.color,
              boxShadow: cfg.glow !== 'none' ? `0 0 10px ${cfg.dimColor}` : 'none',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: cfg.dot, boxShadow: `0 0 5px ${cfg.dot}` }}
            />
            {badgeLabel}
          </span>
          {/* Personalised indicator */}
          {rated && (
            <span
              className="text-xs rounded-md px-1.5 py-0.5 font-medium"
              style={{ color: 'rgba(56,189,248,0.8)', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}
              title="Rated against your personalised reference range"
            >
              personalised
            </span>
          )}
        </div>
      </div>

      {/* Value + deviation */}
      <div className="mb-3 flex items-end gap-2">
        <span
          className="text-3xl font-black tracking-tight"
          style={{ color: cfg.color, textShadow: cfg.glow !== 'none' ? `0 0 16px ${cfg.dimColor}` : 'none' }}
        >
          {displayValue(lab)}
        </span>
        {deviationLabel && (
          <span
            className="text-sm font-semibold mb-0.5"
            style={{ color: cfg.dimColor }}
          >
            {deviationLabel} from range
          </span>
        )}
      </div>

      {/* Personalised range row */}
      {personalizedRangeLabel && (
        <div className="mb-2 text-xs">
          <span className="uppercase tracking-wide" style={{ color: 'rgba(56,189,248,0.5)' }}>Your range </span>
          <span style={{ color: 'rgba(56,189,248,0.75)' }}>{personalizedRangeLabel}</span>
          {rated?.range_note && (
            <span style={{ color: 'rgba(255,255,255,0.3)' }}> · {rated.range_note}</span>
          )}
        </div>
      )}

      {/* Lab reference range + date */}
      <div className="flex items-center justify-between text-xs gap-2">
        <div>
          <span className="uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Lab ref </span>
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>{rangeLabel(lab)}</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>{formatDate(lab.date_collected)}</span>
      </div>
    </div>
  );
}

/* ── Upload panel ────────────────────────────────────────────────────────── */

interface UploadPanelProps {
  userId: string;
  onRatedResults: (results: RatedLabResult[], summary: string) => void;
}

function UploadPanel({ userId, onRatedResults }: UploadPanelProps): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    setLastSummary(null);
    setUploading(true);
    try {
      const result = await analyzeDocument(userId, file);
      if (!result.is_bloodwork) {
        setError(`This document looks like a ${result.document_type} — not bloodwork. Please upload a lab results report.`);
        return;
      }
      const summary = result.import_summary ?? `${result.total_count ?? 0} results imported.`;
      setLastSummary(summary);
      onRatedResults(result.rated_results ?? [], summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="rounded-2xl px-6 py-5 mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(14,165,233,0.04) 100%)',
        border: '1px dashed rgba(56,189,248,0.3)',
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { void handleFile(f); }
          e.target.value = '';
        }}
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white/80">Import bloodwork report</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Upload a lab results image or PDF — Pulse will detect bloodwork automatically and rate
            each value against your personalised normal ranges.
          </p>
          {lastSummary && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: '#30d158' }}>{lastSummary}</p>
          )}
          {error && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: '#ff9f0a' }}>{error}</p>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(3,105,161,0.6) 0%, rgba(14,165,233,0.4) 100%)',
            border: '1px solid rgba(56,189,248,0.4)',
            color: '#38bdf8',
            boxShadow: '0 0 16px rgba(56,189,248,0.15)',
          }}
        >
          {uploading ? 'Analysing…' : 'Upload document'}
        </button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

/**
 * Blood work results page.
 *
 * Fetches the user's lab results from the health profile and renders
 * them colour-coded by personalised rating (High / Normal / Low).
 * Supports direct document upload with automatic bloodwork classification.
 */
export default function BloodworkPage(): React.ReactElement {
  const router = useRouter();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [checking, setChecking] = useState(true);
  const [activeFilter, setActiveFilter] = useState<LabRating | 'all'>('all');
  /** Rated results imported via the upload panel this session. */
  const [uploadedRated, setUploadedRated] = useState<RatedLabResult[]>([]);

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      const user = await getCurrentUser();
      if (!user) { router.replace('/auth'); return; }
      setUserId(user.id);
      const p = await fetchHealthProfile(user.id);
      if (!p) { router.replace('/onboarding'); return; }
      setProfile(p);
    } catch {
      router.replace('/auth');
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  if (checking || !profile) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #071e3d, #04090f)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"
          style={{ boxShadow: '0 0 12px rgba(56,189,248,0.5)' }} />
      </div>
    );
  }

  const labs = profile.recent_labs ?? [];

  /**
   * Build a lookup map from test_name → RatedLabResult for the uploaded batch.
   * If a test appears in both the profile and the upload, the upload wins.
   */
  const ratedMap = new Map<string, RatedLabResult>(
    uploadedRated.map((r) => [r.test_name.toLowerCase(), r]),
  );

  /** Count per personalised rating (prefer uploadedRated, fall back to status) */
  const ratingCounts = RATING_ORDER.reduce<Record<LabRating, number>>((acc, r) => {
    acc[r] = 0;
    return acc;
  }, { High: 0, Normal: 0, Low: 0, Unknown: 0 });

  for (const lab of labs) {
    const rated = ratedMap.get(lab.test_name.toLowerCase());
    const key: LabRating = rated
      ? rated.rating
      : (lab.status === 'critical' ? 'High' : lab.status === 'unknown' ? 'Unknown' : lab.status.charAt(0).toUpperCase() + lab.status.slice(1)) as LabRating;
    ratingCounts[key] = (ratingCounts[key] ?? 0) + 1;
  }

  const filtered = activeFilter === 'all'
    ? [...labs].sort((a, b) => {
        const ra = ratedMap.get(a.test_name.toLowerCase())?.rating ?? 'Unknown';
        const rb = ratedMap.get(b.test_name.toLowerCase())?.rating ?? 'Unknown';
        return RATING_ORDER.indexOf(ra) - RATING_ORDER.indexOf(rb);
      })
    : labs.filter((l) => {
        const rated = ratedMap.get(l.test_name.toLowerCase());
        if (rated) return rated.rating === activeFilter;
        const fallback: LabRating = l.status === 'critical' ? 'High'
          : l.status === 'unknown' ? 'Unknown'
          : (l.status.charAt(0).toUpperCase() + l.status.slice(1)) as LabRating;
        return fallback === activeFilter;
      });

  return (
    <div
      className="min-h-screen"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #071e3d 0%, #04090f 70%)' }}
    >
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)' }} />
      <div className="pointer-events-none fixed bottom-[-60px] right-[-60px] w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(48,209,88,0.06) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">

        {/* Header nav */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl mr-2"
              style={{
                background: 'linear-gradient(135deg, #0369a1 0%, #0f4c75 100%)',
                boxShadow: '0 4px 16px rgba(3,105,161,0.5), 0 0 12px rgba(56,189,248,0.2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <polyline points="3,20 9,10 15,15 21,6 25,9"
                  stroke="white" strokeWidth="2.5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Tab: Chat */}
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                color: 'rgba(255,255,255,0.45)',
                border: '1px solid transparent',
                background: 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; }}
            >
              Chat
            </button>

            {/* Tab: Blood Work (active) */}
            <button
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{
                color: '#38bdf8',
                background: 'linear-gradient(135deg, rgba(3,105,161,0.2) 0%, rgba(14,165,233,0.1) 100%)',
                border: '1px solid rgba(56,189,248,0.3)',
                boxShadow: '0 0 16px rgba(56,189,248,0.15)',
              }}
            >
              Blood Work
            </button>
          </div>

          <button
            onClick={() => router.push('/')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            ← Back to chat
          </button>
        </div>

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Blood Work Results</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {labs.length} result{labs.length !== 1 ? 's' : ''} on file
            {uploadedRated.length > 0 && (
              <span style={{ color: 'rgba(56,189,248,0.7)' }}>
                {' '}· {uploadedRated.length} rated against your personalised ranges
              </span>
            )}
          </p>
        </div>

        {/* Upload panel */}
        {userId && (
          <UploadPanel
            userId={userId}
            onRatedResults={(results) => setUploadedRated(results)}
          />
        )}

        {/* Summary pills — grouped by personalised rating */}
        {labs.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => setActiveFilter('all')}
              className="flex flex-col items-center rounded-2xl px-5 py-3 transition-all duration-200 min-w-[72px]"
              style={activeFilter === 'all'
                ? {
                    background: 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(14,165,233,0.1) 100%)',
                    border: '1px solid rgba(56,189,248,0.4)',
                    boxShadow: '0 0 20px rgba(56,189,248,0.2)',
                  }
                : {
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
              }
            >
              <span className="text-2xl font-black" style={{ color: activeFilter === 'all' ? '#38bdf8' : 'rgba(255,255,255,0.5)' }}>
                {labs.length}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide mt-0.5"
                style={{ color: activeFilter === 'all' ? '#38bdf8' : 'rgba(255,255,255,0.3)' }}>
                All
              </span>
            </button>

            {RATING_ORDER.filter((r) => ratingCounts[r] > 0).map((r) => {
              const cfg = RATING_CONFIG[r];
              return (
                <button
                  key={r}
                  onClick={() => setActiveFilter(activeFilter === r ? 'all' : r)}
                  className="flex flex-col items-center rounded-2xl px-5 py-3 transition-all duration-200 min-w-[72px]"
                  style={activeFilter === r
                    ? { background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: `${cfg.glow}, 0 4px 16px rgba(0,0,0,0.4)` }
                    : { background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                  }
                >
                  <span className="text-2xl font-black" style={{ color: activeFilter === r ? cfg.color : 'rgba(255,255,255,0.5)' }}>
                    {ratingCounts[r]}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide mt-0.5"
                    style={{ color: activeFilter === r ? cfg.color : 'rgba(255,255,255,0.3)' }}>
                    {r}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Lab results grid */}
        {labs.length === 0 ? (
          <div
            className="rounded-2xl px-8 py-16 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(6,182,212,0.03) 100%)',
              border: '1px dashed rgba(56,189,248,0.2)',
              boxShadow: '0 0 32px rgba(56,189,248,0.06)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(3,105,161,0.3) 0%, rgba(14,165,233,0.15) 100%)',
                border: '1px solid rgba(56,189,248,0.25)',
                boxShadow: '0 0 20px rgba(56,189,248,0.15)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
              </svg>
            </div>
            <p className="text-base font-semibold text-white/70 mb-1">No lab results yet</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Upload a bloodwork report above — Pulse will classify it, extract the values,
              and rate each result against your personalised normal ranges.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-5 btn-primary px-5 py-2.5 text-sm rounded-xl"
            >
              Go to chat
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.35)' }}>
            No {activeFilter !== 'all' ? activeFilter.toLowerCase() : ''} results.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((lab, i) => (
              <LabCard
                key={lab.id ?? i}
                lab={lab}
                rated={ratedMap.get(lab.test_name.toLowerCase())}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        {labs.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            {RATING_ORDER.map((r) => {
              const cfg = RATING_CONFIG[r];
              return (
                <div key={r} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}` }} />
                  {r}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
