'use client';

/**
 * Blood work results page — displays lab results with personalised High / Normal / Low
 * ratings adjusted for the user's age, sex, and BMI.  Supports direct document upload
 * which classifies the file and routes bloodwork results here automatically.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../../lib/supabase';
import { fetchHealthProfile } from '../../lib/api';
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

/* ── Chart components ───────────────────────────────────────────────────── */

/** Horizontal bullet chart for a single lab result. */
function BulletChart({ lab, rated }: { lab: LabResult; rated?: RatedLabResult }): React.ReactElement {
  const value = lab.value ?? rated?.value;
  const rangeLow = rated?.personalized_range_low ?? lab.reference_range_low;
  const rangeHigh = rated?.personalized_range_high ?? lab.reference_range_high;

  const cfg = rated ? RATING_CONFIG[rated.rating] : STATUS_CONFIG[lab.status];

  if (value == null || (rangeLow == null && rangeHigh == null)) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {lab.value_text ?? rated?.value_text ?? '—'}
        </span>
      </div>
    );
  }

  const lo = rangeLow ?? value * 0.7;
  const hi = rangeHigh ?? value * 1.3;
  const margin = (hi - lo) * 0.6;
  const scaleMin = Math.max(0, lo - margin);
  const scaleMax = hi + margin;
  const scaleRange = scaleMax - scaleMin || 1;

  const clamp = (v: number): number => Math.max(0, Math.min(1, (v - scaleMin) / scaleRange));
  const valuePct = clamp(value) * 100;
  const normalLeft = clamp(lo) * 100;
  const normalWidth = (clamp(hi) - clamp(lo)) * 100;

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1 h-3 rounded-full overflow-visible" style={{ background: 'rgba(255,255,255,0.07)' }}>
        {/* Normal range zone */}
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{
            left: `${normalLeft}%`,
            width: `${normalWidth}%`,
            background: 'rgba(48,209,88,0.2)',
            border: '1px solid rgba(48,209,88,0.35)',
            borderRadius: 3,
          }}
        />
        {/* Value marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2"
          style={{
            left: `calc(${valuePct}% - 6px)`,
            backgroundColor: cfg.dot,
            borderColor: 'rgba(10,15,25,0.8)',
            boxShadow: `0 0 6px ${cfg.dot}, 0 0 12px ${cfg.dimColor}`,
            zIndex: 2,
          }}
        />
      </div>
      <span className="text-xs font-bold w-20 text-right flex-shrink-0" style={{ color: cfg.color }}>
        {value}{lab.unit ? ` ${lab.unit}` : ''}
      </span>
    </div>
  );
}

/** Distribution donut/ring chart. */
function DistributionRing({ counts, total }: { counts: Record<LabRating, number>; total: number }): React.ReactElement {
  if (total === 0) return <></>;
  const radius = 36;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const ratings: LabRating[] = ['High', 'Low', 'Normal', 'Unknown'];
  const colors: Record<LabRating, string> = {
    High: '#ff9f0a', Low: '#0a84ff', Normal: '#30d158', Unknown: '#8e8e93',
  };

  let offset = 0;
  const segments = ratings.map((r) => {
    const pct = counts[r] / total;
    const len = pct * circumference;
    const seg = { rating: r, pct, len, offset, color: colors[r] };
    offset += len;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {segments.filter((s) => s.len > 0).map((s) => (
          <circle
            key={s.rating}
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.len} ${circumference - s.len}`}
            strokeDashoffset={circumference / 4 - s.offset}
            strokeLinecap="butt"
            style={{ filter: `drop-shadow(0 0 4px ${s.color})` }}
          />
        ))}
        <text x="48" y="44" textAnchor="middle" fill="white" fontSize="16" fontWeight="800">{total}</text>
        <text x="48" y="57" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="600">TESTS</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {ratings.filter((r) => counts[r] > 0).map((r) => (
          <div key={r} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[r], boxShadow: `0 0 4px ${colors[r]}` }} />
            <span className="text-xs font-semibold" style={{ color: colors[r] }}>{counts[r]}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chart view — one bullet chart row per lab result. */
interface LabChartProps {
  labs: LabResult[];
  ratedMap: Map<string, RatedLabResult>;
}

function LabChart({ labs, ratedMap }: LabChartProps): React.ReactElement {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(56,189,248,0.15)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
    >
      {/* Column header */}
      <div
        className="grid text-xs font-semibold uppercase tracking-wider px-4 py-3"
        style={{
          gridTemplateColumns: '2fr 3fr 1fr',
          background: 'linear-gradient(135deg, rgba(3,105,161,0.3) 0%, rgba(14,165,233,0.15) 100%)',
          borderBottom: '1px solid rgba(56,189,248,0.18)',
          color: 'rgba(56,189,248,0.7)',
        }}
      >
        <span>Test</span>
        <span>Range</span>
        <span className="text-right">Status</span>
      </div>

      {labs.map((lab, i) => {
        const rated = ratedMap.get(lab.test_name.toLowerCase());
        const cfg = rated ? RATING_CONFIG[rated.rating] : STATUS_CONFIG[lab.status];
        const badgeLabel = rated ? rated.rating : STATUS_CONFIG[lab.status].label;

        return (
          <div
            key={lab.id ?? i}
            className="grid items-center px-4 py-3"
            style={{
              gridTemplateColumns: '2fr 3fr 1fr',
              background: i % 2 === 0
                ? 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)'
                : 'transparent',
              borderBottom: i < labs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <div className="pr-3">
              <span className="text-sm font-medium text-white/85 block truncate">{lab.test_name}</span>
              {lab.date_collected && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatDate(lab.date_collected)}</span>
              )}
            </div>

            <div className="pr-4">
              <BulletChart lab={lab} rated={rated} />
              <div className="flex justify-between mt-0.5 px-0.5">
                {(rated?.personalized_range_low ?? lab.reference_range_low) != null && (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {rated?.personalized_range_low ?? lab.reference_range_low}
                  </span>
                )}
                {(rated?.personalized_range_high ?? lab.reference_range_high) != null && (
                  <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {rated?.personalized_range_high ?? lab.reference_range_high}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  color: cfg.color,
                  boxShadow: cfg.glow !== 'none' ? `0 0 8px ${cfg.dimColor}` : 'none',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}` }} />
                {badgeLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Components ─────────────────────────────────────────────────────────── */

interface LabTableProps {
  labs: LabResult[];
  ratedMap: Map<string, RatedLabResult>;
}

function LabTable({ labs, ratedMap }: LabTableProps): React.ReactElement {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(56,189,248,0.15)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
    >
      {/* Table header */}
      <div
        className="grid text-xs font-semibold uppercase tracking-wider px-4 py-3"
        style={{
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
          background: 'linear-gradient(135deg, rgba(3,105,161,0.3) 0%, rgba(14,165,233,0.15) 100%)',
          borderBottom: '1px solid rgba(56,189,248,0.18)',
          color: 'rgba(56,189,248,0.7)',
        }}
      >
        <span>Test</span>
        <span>Result</span>
        <span>Status</span>
        <span>Your Range</span>
        <span>Lab Ref</span>
        <span className="text-right">Date</span>
      </div>

      {/* Rows */}
      {labs.map((lab, i) => {
        const rated = ratedMap.get(lab.test_name.toLowerCase());
        const ratingCfg = rated ? RATING_CONFIG[rated.rating] : null;
        const cfg = ratingCfg ?? STATUS_CONFIG[lab.status];
        const badgeLabel = rated ? rated.rating : STATUS_CONFIG[lab.status].label;

        const deviationLabel =
          rated && rated.deviation_pct != null && rated.deviation_pct !== 0
            ? `${rated.deviation_pct > 0 ? '+' : ''}${rated.deviation_pct.toFixed(1)}%`
            : null;

        const personalizedRange =
          rated && (rated.personalized_range_low != null || rated.personalized_range_high != null)
            ? [
                rated.personalized_range_low != null ? `${rated.personalized_range_low}` : '—',
                rated.personalized_range_high != null ? `${rated.personalized_range_high}` : '—',
              ].join(' – ') + (lab.unit ? ` ${lab.unit}` : '')
            : '—';

        return (
          <div
            key={lab.id ?? i}
            className="grid items-center px-4 py-3 transition-colors duration-150"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
              background: i % 2 === 0
                ? 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)'
                : 'transparent',
              borderBottom: i < labs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `linear-gradient(135deg, ${cfg.bg.replace('linear-gradient(135deg,', '').slice(0, -1)}`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)' : 'transparent'; }}
          >
            {/* Test name */}
            <span className="text-sm font-medium text-white/85 truncate pr-2">{lab.test_name}</span>

            {/* Result + deviation */}
            <div className="flex flex-col">
              <span className="text-sm font-bold" style={{ color: cfg.color }}>
                {displayValue(lab)}
              </span>
              {deviationLabel && (
                <span className="text-xs" style={{ color: cfg.dimColor }}>{deviationLabel}</span>
              )}
            </div>

            {/* Rating badge */}
            <div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  color: cfg.color,
                  boxShadow: cfg.glow !== 'none' ? `0 0 8px ${cfg.dimColor}` : 'none',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}` }} />
                {badgeLabel}
              </span>
            </div>

            {/* Personalised range */}
            <span className="text-xs" style={{ color: rated ? 'rgba(56,189,248,0.7)' : 'rgba(255,255,255,0.3)' }}>
              {personalizedRange}
            </span>

            {/* Lab reference range */}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {rangeLabel(lab)}
            </span>

            {/* Date */}
            <span className="text-xs text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {formatDate(lab.date_collected)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Simulated demo data ────────────────────────────────────────────────── */

/**
 * Reference blood work for a healthy 20-year-old male.
 * Used when no real lab data is on file.
 */
const DEMO_DATE = '2026-03-15';
const SIMULATED_LABS: LabResult[] = [
  // ── Complete Blood Count ──────────────────────────────────────────────
  { test_name: 'WBC',               value: 7.2,  unit: 'K/µL',          reference_range_low: 4.5,       reference_range_high: 11.0, status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'RBC',               value: 5.1,  unit: 'M/µL',          reference_range_low: 4.7,       reference_range_high: 6.1,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Hemoglobin',        value: 15.2, unit: 'g/dL',          reference_range_low: 13.5,      reference_range_high: 17.5, status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Hematocrit',        value: 44,   unit: '%',             reference_range_low: 41,        reference_range_high: 53,   status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Platelets',         value: 240,  unit: 'K/µL',          reference_range_low: 150,       reference_range_high: 400,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  // ── Comprehensive Metabolic Panel ─────────────────────────────────────
  { test_name: 'Glucose (Fasting)', value: 88,   unit: 'mg/dL',         reference_range_low: 70,        reference_range_high: 100,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Creatinine',        value: 0.9,  unit: 'mg/dL',         reference_range_low: 0.7,       reference_range_high: 1.3,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'eGFR',              value: 112,  unit: 'mL/min/1.73m²', reference_range_low: 60,        reference_range_high: undefined, status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Sodium',            value: 140,  unit: 'mEq/L',         reference_range_low: 136,       reference_range_high: 145,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Potassium',         value: 4.1,  unit: 'mEq/L',         reference_range_low: 3.5,       reference_range_high: 5.0,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'ALT',               value: 22,   unit: 'U/L',           reference_range_low: 7,         reference_range_high: 56,   status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'AST',               value: 18,   unit: 'U/L',           reference_range_low: 10,        reference_range_high: 40,   status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  // ── Lipid Panel ───────────────────────────────────────────────────────
  { test_name: 'Total Cholesterol', value: 172,  unit: 'mg/dL',         reference_range_low: undefined, reference_range_high: 200,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'LDL Cholesterol',   value: 108,  unit: 'mg/dL',         reference_range_low: undefined, reference_range_high: 100,  status: 'high',   lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'HDL Cholesterol',   value: 52,   unit: 'mg/dL',         reference_range_low: 40,        reference_range_high: undefined, status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Triglycerides',     value: 88,   unit: 'mg/dL',         reference_range_low: undefined, reference_range_high: 150,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  // ── Thyroid & Metabolic ───────────────────────────────────────────────
  { test_name: 'TSH',               value: 2.4,  unit: 'mIU/L',         reference_range_low: 0.4,       reference_range_high: 4.0,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'HbA1c',             value: 5.2,  unit: '%',             reference_range_low: undefined, reference_range_high: 5.7,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Vitamin D (25-OH)', value: 22,   unit: 'ng/mL',         reference_range_low: 30,        reference_range_high: 100,  status: 'low',    lab_source: 'manual', date_collected: DEMO_DATE },
  { test_name: 'Iron',              value: 95,   unit: 'µg/dL',         reference_range_low: 60,        reference_range_high: 170,  status: 'normal', lab_source: 'manual', date_collected: DEMO_DATE },
];

/* ── Page ───────────────────────────────────────────────────────────────── */

/**
 * Blood work results page.
 *
 * Fetches the user's lab results from the health profile and renders
 * them colour-coded by personalised rating (High / Normal / Low).
 */
export default function BloodworkPage(): React.ReactElement {
  const router = useRouter();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeFilter, setActiveFilter] = useState<LabRating | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      const user = await getCurrentUser();
      if (!user) { router.replace('/auth'); return; }
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

  const profileLabs = profile.recent_labs ?? [];
  const isDemo = profileLabs.length === 0;
  const labs: LabResult[] = isDemo ? SIMULATED_LABS : profileLabs;

  const ratedMap = new Map<string, RatedLabResult>();

  /** Count per personalised rating. */
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
            <button
              onClick={() => router.push('/health-tracker')}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid transparent', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; }}
            >
              Bio Tracker
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">Blood Work Results</h1>
            {isDemo && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(255,159,10,0.12)',
                  border: '1px solid rgba(255,159,10,0.3)',
                  color: '#ff9f0a',
                }}
              >
                Demo
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isDemo
              ? 'Simulated reference panel · 20-year-old male · Mar 15, 2026'
              : `${labs.length} result${labs.length !== 1 ? 's' : ''} on file`}
          </p>
        </div>

        {/* Summary pills + view toggle */}
        {labs.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-8 items-end justify-between">
          <div className="flex flex-wrap gap-3">
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
          {/* View toggle */}
          <div
            className="flex rounded-xl p-0.5 gap-0.5 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {(['table', 'chart'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200"
                style={viewMode === mode
                  ? {
                      background: 'linear-gradient(135deg, rgba(3,105,161,0.5) 0%, rgba(14,165,233,0.3) 100%)',
                      color: '#38bdf8',
                      boxShadow: '0 0 12px rgba(56,189,248,0.2)',
                    }
                  : { color: 'rgba(255,255,255,0.35)', background: 'transparent' }
                }
              >
                {mode === 'table' ? (
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="1" width="10" height="10" rx="1" />
                      <line x1="1" y1="4" x2="11" y2="4" />
                      <line x1="1" y1="7" x2="11" y2="7" />
                      <line x1="4" y1="4" x2="4" y2="11" />
                    </svg>
                    Table
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="8" width="2" height="3" rx="0.5" />
                      <rect x="5" y="5" width="2" height="6" rx="0.5" />
                      <rect x="9" y="2" width="2" height="9" rx="0.5" />
                    </svg>
                    Chart
                  </span>
                )}
              </button>
            ))}
          </div>
          </div>
        )}

        {/* Chart distribution summary (chart mode only) */}
        {labs.length > 0 && viewMode === 'chart' && (
          <div
            className="rounded-2xl px-6 py-4 mb-6 flex items-center gap-6"
            style={{
              background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(14,165,233,0.03) 100%)',
              border: '1px solid rgba(56,189,248,0.12)',
            }}
          >
            <DistributionRing counts={ratingCounts} total={labs.length} />
            <div>
              <p className="text-sm font-bold text-white/70">Lab Summary</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Markers positioned relative to your personalised normal range
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(48,209,88,0.7)' }}>
                Green zone = normal range · Dot = your result
              </p>
            </div>
          </div>
        )}

        {/* Lab results table / chart */}
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
              Upload a bloodwork report above — Sona Health will classify it, extract the values,
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
        ) : viewMode === 'chart' ? (
          <LabChart labs={filtered} ratedMap={ratedMap} />
        ) : (
          <LabTable labs={filtered} ratedMap={ratedMap} />
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
