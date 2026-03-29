/**
 * Always-visible health profile sidebar for the web chat interface.
 *
 * Updates instantly when the parent component calls setProfile() after
 * an EditProfileModal save — no separate fetch needed.
 */

'use client';

import { useState, useEffect } from 'react';
import type { HealthProfile } from '../lib/types';
import { FACT_CATEGORIES } from '../lib/health-facts';

interface HealthProfileSidebarProps {
  profile: HealthProfile | null;
}

const SIDEBAR_BG   = 'linear-gradient(160deg, #0a1628, #050e1c)';
const SIDEBAR_BORDER = '1px solid rgba(56,189,248,0.12)';
const CARD_BG      = 'linear-gradient(160deg, #0d2440, #071526, #050e1c)';
const CARD_BORDER  = '1px solid rgba(56,189,248,0.18)';
const CARD_SHADOW  = '0 4px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06)';
const STAT_BG      = 'rgba(56,189,248,0.08)';
const TEXT_SEC     = 'rgba(186,230,253,0.6)';
const TEXT_MUTED   = 'rgba(186,230,253,0.35)';

/** Convert height_cm to a display string like 5′11″. */
function formatHeight(cm: number | null | undefined): string | null {
  if (!cm) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}′${inches}″`;
}

/** Convert weight_kg to lbs display string. */
function formatWeight(kg: number | null | undefined): string | null {
  if (!kg) return null;
  return `${Math.round(kg * 2.2046)} lbs`;
}

/**
 * Group health_facts into their questionnaire categories.
 * Facts not matching any known category go into "Learned" bucket.
 */
function groupFacts(facts: string[]): { cat: string; items: string[] }[] {
  const buckets = new Map<string, string[]>();
  const learned: string[] = [];

  for (const fact of facts) {
    let matched = false;
    for (const cat of FACT_CATEGORIES) {
      if (cat.options.includes(fact)) {
        if (!buckets.has(cat.label)) buckets.set(cat.label, []);
        buckets.get(cat.label)!.push(fact);
        matched = true;
        break;
      }
    }
    if (!matched) learned.push(fact);
  }

  const result: { cat: string; items: string[] }[] = Array.from(buckets.entries()).map(([cat, items]) => ({ cat, items }));
  if (learned.length > 0) result.push({ cat: 'Learned', items: learned });
  return result;
}

export function HealthProfileSidebar({ profile }: HealthProfileSidebarProps): React.ReactElement {
  if (!profile) {
    return (
      <aside className="w-72 flex-shrink-0 p-4" style={{ background: SIDEBAR_BG, borderRight: SIDEBAR_BORDER }}>
        <p className="text-sm" style={{ color: TEXT_MUTED }}>Loading health profile...</p>
      </aside>
    );
  }

  const abnormalLabs = profile.recent_labs.filter(
    (l) => l.status === 'high' || l.status === 'low' || l.status === 'critical',
  );
  const normalLabs = profile.recent_labs.filter((l) => l.status === 'normal');
  const heightStr = formatHeight(profile.height_cm);
  const weightStr = formatWeight(profile.weight_kg);
  const factGroups = groupFacts(profile.health_facts);

  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto p-4" style={{ background: SIDEBAR_BG, borderRight: SIDEBAR_BORDER }}>

      {/* Profile header card */}
      <div className="mb-4 rounded-xl p-4 text-white" style={{ background: CARD_BG, border: CARD_BORDER, boxShadow: CARD_SHADOW }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#38bdf8', textShadow: '0 0 10px rgba(125,211,252,0.35)' }}>
          Sana Health knows your health
        </p>
        <p className="mt-1 text-xl font-bold">{profile.display_name}</p>

        {/* Age + sex */}
        {(profile.age || profile.sex) && (
          <p className="text-sm mt-0.5" style={{ color: TEXT_SEC }}>
            {[profile.age ? `${profile.age} y/o` : null, profile.sex].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Height + weight */}
        {(heightStr || weightStr) && (
          <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
            {[heightStr, weightStr].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-3 flex gap-3 text-center text-xs">
          <div className="flex-1 rounded-lg py-1.5" style={{ backgroundColor: STAT_BG, border: '1px solid rgba(56,189,248,0.12)' }}>
            <div className="text-lg font-bold text-white">{profile.primary_conditions.length}</div>
            <div style={{ color: TEXT_SEC }}>conditions</div>
          </div>
          <div className="flex-1 rounded-lg py-1.5" style={{ backgroundColor: STAT_BG, border: '1px solid rgba(56,189,248,0.12)' }}>
            <div className="text-lg font-bold text-white">{profile.current_medications.length}</div>
            <div style={{ color: TEXT_SEC }}>meds</div>
          </div>
          <div
            className="flex-1 rounded-lg py-1.5"
            style={{
              backgroundColor: abnormalLabs.length > 0 ? 'rgba(251,146,60,0.25)' : STAT_BG,
              border: abnormalLabs.length > 0 ? '1px solid rgba(251,146,60,0.4)' : '1px solid rgba(56,189,248,0.12)',
            }}
          >
            <div className="text-lg font-bold text-white">{abnormalLabs.length}</div>
            <div style={{ color: TEXT_SEC }}>abnormal</div>
          </div>
        </div>
      </div>

      <BmiCalculator heightCm={profile.height_cm} weightKg={profile.weight_kg} />

      {profile.primary_conditions.length > 0 && (
        <SidebarSection title="Conditions">
          {profile.primary_conditions.map((c) => (
            <span key={c} className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mr-1 mb-1"
              style={{ background: 'rgba(56,189,248,0.08)', color: 'rgba(186,230,253,0.85)', border: '1px solid rgba(56,189,248,0.18)' }}>
              {c}
            </span>
          ))}
        </SidebarSection>
      )}

      {profile.current_medications.length > 0 && (
        <SidebarSection title="Medications">
          {profile.current_medications.map((m) => (
            <div key={m.name} className="mb-1 text-sm" style={{ color: TEXT_SEC }}>
              <span className="font-medium text-white">{m.name}</span>{' '}
              <span style={{ color: TEXT_MUTED }}>{m.dose} · {m.frequency}</span>
            </div>
          ))}
        </SidebarSection>
      )}

      {profile.allergies.length > 0 && (
        <SidebarSection title="Allergies">
          {profile.allergies.map((a) => (
            <span key={a} className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mr-1 mb-1"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
              {a}
            </span>
          ))}
        </SidebarSection>
      )}

      {abnormalLabs.length > 0 && (
        <SidebarSection title="Abnormal Labs">
          {abnormalLabs.map((l) => (
            <div key={l.test_name} className="mb-1.5 flex items-center justify-between">
              <span className="text-sm" style={{ color: TEXT_SEC }}>{l.test_name}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={
                  l.status === 'critical' ? { backgroundColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }
                  : l.status === 'high'   ? { backgroundColor: 'rgba(251,146,60,0.2)', color: '#fdba74' }
                  :                         { backgroundColor: 'rgba(56,189,248,0.15)', color: '#7dd3fc' }
                }>
                {l.value !== undefined ? `${l.value} ${l.unit ?? ''}`.trim() : l.value_text ?? '—'}
              </span>
            </div>
          ))}
        </SidebarSection>
      )}

      {normalLabs.length > 0 && (
        <SidebarSection title="Normal Labs">
          {normalLabs.slice(0, 5).map((l) => (
            <div key={l.test_name} className="mb-1 flex items-center justify-between">
              <span className="text-sm" style={{ color: TEXT_MUTED }}>{l.test_name}</span>
              <span className="text-xs" style={{ color: 'rgba(186,230,253,0.3)' }}>
                {l.value !== undefined ? `${l.value} ${l.unit ?? ''}`.trim() : l.value_text ?? '—'}
              </span>
            </div>
          ))}
        </SidebarSection>
      )}

      {profile.wearable_summary && (
        <SidebarSection title="Wearable (7-day avg)">
          {profile.wearable_summary.avg_resting_heart_rate !== undefined && (
            <WearableRow label="Heart rate" value={`${profile.wearable_summary.avg_resting_heart_rate.toFixed(0)} bpm`} />
          )}
          {profile.wearable_summary.avg_sleep_hours !== undefined && (
            <WearableRow label="Sleep" value={`${profile.wearable_summary.avg_sleep_hours.toFixed(1)} hrs`} />
          )}
          {profile.wearable_summary.avg_hrv_ms !== undefined && (
            <WearableRow label="HRV" value={`${profile.wearable_summary.avg_hrv_ms.toFixed(0)} ms`} />
          )}
          {profile.wearable_summary.avg_steps_per_day !== undefined && (
            <WearableRow label="Steps" value={profile.wearable_summary.avg_steps_per_day.toLocaleString()} />
          )}
        </SidebarSection>
      )}

      {/* Lifestyle facts grouped by category */}
      {factGroups.map(({ cat, items }) => (
        <SidebarSection key={cat} title={cat}>
          {items.map((fact, i) => (
            <p key={i} className="mb-1 text-xs leading-relaxed" style={{ color: TEXT_MUTED }}>{fact}</p>
          ))}
        </SidebarSection>
      ))}
    </aside>
  );
}

/* ── BMI Calculator ──────────────────────────────────────────────────────── */

interface BmiCalculatorProps {
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#38bdf8' };
  if (bmi < 25)   return { label: 'Normal',       color: '#4ade80' };
  if (bmi < 30)   return { label: 'Overweight',   color: '#fb923c' };
  return             { label: 'Obese',            color: '#f87171' };
}

/**
 * Interactive BMI calculator.
 * Pre-fills from the user's health profile; allows manual override.
 * Accepts height in ft + in and weight in lbs for display convenience,
 * then converts to metric for the BMI formula.
 */
function BmiCalculator({ heightCm, weightKg }: BmiCalculatorProps): React.ReactElement {
  // Convert profile values to imperial display units
  const profileFt    = heightCm ? Math.floor((heightCm / 2.54) / 12) : '';
  const profileIn    = heightCm ? Math.round(((heightCm / 2.54) % 12)) : '';
  const profileLbs   = weightKg ? Math.round(weightKg * 2.2046) : '';

  const [ft,  setFt]  = useState<string>(String(profileFt));
  const [ins, setIns] = useState<string>(String(profileIn));
  const [lbs, setLbs] = useState<string>(String(profileLbs));

  // Re-sync local state when the profile values change (e.g. after Edit Profile save)
  useEffect(() => { setFt(String(profileFt)); },  [profileFt]);
  useEffect(() => { setIns(String(profileIn)); },  [profileIn]);
  useEffect(() => { setLbs(String(profileLbs)); }, [profileLbs]);

  const heightM = ((Number(ft) * 12) + Number(ins)) * 0.0254;
  const weightK = Number(lbs) * 0.453592;
  const bmi     = heightM > 0 && weightK > 0 ? weightK / (heightM ** 2) : null;
  const cat     = bmi !== null ? bmiCategory(bmi) : null;

  // Segment positions on a 0–40 BMI scale for the indicator bar
  const segments = [
    { label: 'Under', end: 18.5, color: '#38bdf8' },
    { label: 'Normal', end: 25,  color: '#4ade80' },
    { label: 'Over',  end: 30,   color: '#fb923c' },
    { label: 'Obese', end: 40,   color: '#f87171' },
  ];
  const markerPct = bmi !== null ? Math.min(100, (Math.min(bmi, 40) / 40) * 100) : null;

  const fieldStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: 8,
    color: 'white',
    fontSize: 13,
    padding: '5px 8px',
    width: '100%',
    outline: 'none',
  };

  return (
    <SidebarSection title="BMI Calculator">
      {/* Input row */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>ft</p>
          <input type="number" min={0} max={8} value={ft}
            onChange={(e) => setFt(e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>in</p>
          <input type="number" min={0} max={11} value={ins}
            onChange={(e) => setIns(e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>lbs</p>
          <input type="number" min={0} value={lbs}
            onChange={(e) => setLbs(e.target.value)} style={fieldStyle} />
        </div>
      </div>

      {/* Result */}
      {bmi !== null && cat !== null ? (
        <>
          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-black" style={{ color: cat.color, textShadow: `0 0 16px ${cat.color}80` }}>
              {bmi.toFixed(1)}
            </span>
            <span className="text-sm font-semibold mb-0.5" style={{ color: cat.color }}>{cat.label}</span>
          </div>

          {/* Gradient bar with marker */}
          <div className="relative h-2 rounded-full overflow-visible mb-1"
            style={{ background: 'linear-gradient(90deg, #38bdf8 0%, #4ade80 46%, #fb923c 75%, #f87171 100%)' }}>
            {markerPct !== null && (
              <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
                style={{ left: `calc(${markerPct}% - 5px)`, background: cat.color,
                  boxShadow: `0 0 6px ${cat.color}` }} />
            )}
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-xs mt-1" style={{ color: TEXT_MUTED }}>
            <span>18.5</span><span>25</span><span>30</span><span>40</span>
          </div>
        </>
      ) : (
        <p className="text-xs" style={{ color: TEXT_MUTED }}>Enter height and weight above.</p>
      )}
    </SidebarSection>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: '#38bdf8', textShadow: '0 0 8px rgba(56,189,248,0.3)', opacity: 0.7 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function WearableRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm" style={{ color: TEXT_SEC }}>{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
