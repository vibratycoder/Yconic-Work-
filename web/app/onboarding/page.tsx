'use client';

/**
 * Health profile onboarding — collects the data that powers the sidebar
 * and personalises every Pulse response. Shown once after sign-up.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../../lib/supabase';
import { COMMON_CONDITIONS, COMMON_ALLERGIES } from '../../lib/health-options';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface MedicationEntry {
  name: string;
  dose: string;
  frequency: string;
}

interface OnboardingData {
  age: string;
  sex: string;
  height_ft: string;
  height_in: string;
  weight_lbs: string;
  conditions: string[];
  custom_condition: string;
  medications: MedicationEntry[];
  med_name: string;
  med_dose: string;
  med_dose_unit: string;
  med_frequency_times: string;
  allergies: string[];
  custom_allergy: string;
  exercise_frequency: string;
  avg_sleep_hours: string;
  smoking_status: string;
  alcohol_use: string;
  health_goals: string[];
}

const INITIAL_DATA: OnboardingData = {
  age: '', sex: '',
  height_ft: '', height_in: '', weight_lbs: '',
  conditions: [], custom_condition: '',
  medications: [], med_name: '', med_dose: '', med_dose_unit: 'mg', med_frequency_times: '',
  allergies: [], custom_allergy: '',
  exercise_frequency: '', avg_sleep_hours: '',
  smoking_status: '', alcohol_use: '',
  health_goals: [],
};

/* ── Static option lists ────────────────────────────────────────────────── */

/* COMMON_CONDITIONS and COMMON_ALLERGIES imported from lib/health-options */

const EXERCISE_OPTIONS = [
  'Sedentary (little to no exercise)',
  'Light (1–2 days/week)',
  'Moderate (3–4 days/week)',
  'Active (5+ days/week)',
  'Very active (athlete / physical job)',
];

const SLEEP_OPTIONS = ['Less than 5 hours', '5–6 hours', '6–7 hours', '7–8 hours', '8+ hours'];

const SMOKING_OPTIONS = ['Never smoked', 'Former smoker (quit)', 'Current smoker', 'Vape / e-cigarette'];

const ALCOHOL_OPTIONS = [
  'None', 'Occasionally (1–2x/month)', 'Socially (1–2x/week)',
  'Regularly (3–5x/week)', 'Daily',
];

const HEALTH_GOALS = [
  'Understand my lab results',
  'Manage a chronic condition better',
  'Prepare for doctor visits',
  'Track medications and side effects',
  'Improve sleep quality',
  'Lose weight / improve fitness',
  'Reduce stress and anxiety',
  'Monitor heart health',
  'Control blood sugar',
  'Improve diet and nutrition',
];

const STEPS = [
  { id: 1, title: 'Your basics', subtitle: 'Helps Sana Health personalise every response' },
  { id: 2, title: 'Medical conditions', subtitle: 'Select all that apply' },
  { id: 3, title: 'Current medications', subtitle: 'Include dose and frequency' },
  { id: 4, title: 'Allergies', subtitle: 'Drug and food allergies' },
  { id: 5, title: 'Lifestyle & goals', subtitle: 'Adds context to your health picture' },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */

function toHeightCm(ft: string, inches: string): number | null {
  const f = parseFloat(ft);
  const i = parseFloat(inches || '0');
  if (isNaN(f)) return null;
  return Math.round((f * 30.48) + (i * 2.54));
}

function toWeightKg(lbs: string): number | null {
  const v = parseFloat(lbs);
  if (isNaN(v)) return null;
  return Math.round(v * 0.4536 * 10) / 10;
}

/**
 * Map onboarding questionnaire answers to exact FACT_CATEGORIES fact strings
 * so they are picked up by the categorised sidebar grouping.
 */
function buildHealthFacts(data: OnboardingData): string[] {
  const facts: string[] = [];

  // Exercise
  const exerciseMap: Record<string, string> = {
    'Sedentary (little to no exercise)': 'Mostly sedentary lifestyle',
    'Light (1–2 days/week)': 'Walks daily',
    'Moderate (3–4 days/week)': 'Exercises regularly (3+ times/week)',
    'Active (5+ days/week)': 'Exercises regularly (3+ times/week)',
    'Very active (athlete / physical job)': 'Very active (athlete / physical job)',
  };
  if (data.exercise_frequency && exerciseMap[data.exercise_frequency]) {
    facts.push(exerciseMap[data.exercise_frequency]);
  }

  // Sleep
  const sleepMap: Record<string, string> = {
    'Less than 5 hours': 'Gets less than 6 hours of sleep per night',
    '5–6 hours': 'Gets less than 6 hours of sleep per night',
    '6–7 hours': 'Gets less than 6 hours of sleep per night',
    '7–8 hours': 'Gets 7–9 hours of sleep per night',
    '8+ hours': 'Gets 8+ hours of sleep per night',
  };
  if (data.avg_sleep_hours && sleepMap[data.avg_sleep_hours]) {
    facts.push(sleepMap[data.avg_sleep_hours]);
  }

  // Smoking
  const smokingMap: Record<string, string> = {
    'Never smoked': 'Non-smoker',
    'Former smoker (quit)': 'Former smoker (quit)',
    'Current smoker': 'Current smoker',
    'Vape / e-cigarette': 'Uses vape / e-cigarette',
  };
  if (data.smoking_status && smokingMap[data.smoking_status]) {
    facts.push(smokingMap[data.smoking_status]);
  }

  // Alcohol
  const alcoholMap: Record<string, string> = {
    'None': 'Does not drink alcohol',
    'Occasionally (1–2x/month)': 'Drinks alcohol occasionally',
    'Socially (1–2x/week)': 'Drinks alcohol occasionally',
    'Regularly (3–5x/week)': 'Drinks alcohol regularly (3–5×/week)',
    'Daily': 'Drinks alcohol regularly (3–5×/week)',
  };
  if (data.alcohol_use && alcoholMap[data.alcohol_use]) {
    facts.push(alcoholMap[data.alcohol_use]);
  }

  // Health goals stay as a free-form learned fact
  if (data.health_goals.length > 0) {
    facts.push(`Health goals: ${data.health_goals.join(', ')}`);
  }

  return facts;
}

/* ── Main component ─────────────────────────────────────────────────────── */

/**
 * Multi-step health profile onboarding.
 *
 * Collects conditions, medications, allergies, and lifestyle data.
 * Saves to Pulse backend on completion so the sidebar populates immediately.
 * Users may skip any step — partial profiles still improve responses.
 */
export default function OnboardingPage(): React.ReactElement {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) { router.replace('/auth'); return; }
      setUserId(user.id);
      setDisplayName(
        (user.user_metadata?.display_name as string | undefined) ?? user.email ?? 'there',
      );
    }).catch(() => router.replace('/auth'));
  }, [router]);

  const update = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]): void => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleItem = useCallback((key: 'conditions' | 'allergies' | 'health_goals', item: string): void => {
    setData((prev) => {
      const list = prev[key] as string[];
      return { ...prev, [key]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] };
    });
  }, []);

  const addMedication = useCallback((): void => {
    if (!data.med_name.trim()) return;
    setData((prev) => ({
      ...prev,
      medications: [...prev.medications, {
        name: prev.med_name.trim(),
        dose: prev.med_dose.trim() ? `${prev.med_dose.trim()} ${prev.med_dose_unit}` : '',
        frequency: prev.med_frequency_times,
      }],
      med_name: '', med_dose: '', med_dose_unit: 'mg', med_frequency_times: '',
    }));
  }, [data.med_name, data.med_dose, data.med_dose_unit, data.med_frequency_times]);

  const removeMedication = useCallback((index: number): void => {
    setData((prev) => ({ ...prev, medications: prev.medications.filter((_, i) => i !== index) }));
  }, []);

  const addCustomCondition = useCallback((): void => {
    const val = data.custom_condition.trim();
    if (!val || data.conditions.includes(val)) return;
    setData((prev) => ({ ...prev, conditions: [...prev.conditions, val], custom_condition: '' }));
  }, [data.custom_condition, data.conditions]);

  const addCustomAllergy = useCallback((): void => {
    const val = data.custom_allergy.trim();
    if (!val || data.allergies.includes(val)) return;
    setData((prev) => ({ ...prev, allergies: [...prev.allergies, val], custom_allergy: '' }));
  }, [data.custom_allergy, data.allergies]);

  const handleFinish = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';
      const payload = {
        user_id: userId,
        display_name: displayName,
        age: data.age ? parseInt(data.age, 10) : null,
        sex: data.sex || null,
        height_cm: toHeightCm(data.height_ft, data.height_in),
        weight_kg: toWeightKg(data.weight_lbs),
        primary_conditions: data.conditions,
        current_medications: data.medications,
        allergies: data.allergies,
        health_facts: buildHealthFacts(data),
        recent_labs: [],
        conversation_count: 0,
      };
      const res = await fetch(`${apiUrl}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Profile save failed: ${res.status}`);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [userId, displayName, data, router]);

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 50%, #071526 0%, #04090f 100%)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#38bdf8', borderTopColor: 'transparent', boxShadow: '0 0 12px rgba(56,189,248,0.5)' }} />
      </div>
    );
  }

  const progress = (step / STEPS.length) * 100;
  const currentStep = STEPS[step - 1];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 30% 20%, #071e3d 0%, #04090f 60%)' }}>
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute top-[-120px] left-[-120px] w-[480px] h-[480px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute bottom-[-80px] right-[-80px] w-[360px] h-[360px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)' }} />
      <div className="w-full max-w-xl relative z-10">

        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
            style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0f4c75 100%)', boxShadow: '0 8px 32px rgba(3,105,161,0.6), 0 0 0 1px rgba(56,189,248,0.2), 0 0 20px rgba(56,189,248,0.25)' }}
          >
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <polyline points="3,20 9,10 15,15 21,6 25,9"
                stroke="white" strokeWidth="2.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Welcome, <span className="font-semibold text-white">{displayName.split(' ')[0]}</span>. Let's build your health profile.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #0d2440 0%, #071526 60%, #050e1c 100%)', border: '1px solid rgba(56,189,248,0.18)', boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

          {/* Progress bar */}
          <div className="h-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0369a1 0%, #38bdf8 100%)', boxShadow: '0 0 12px rgba(56,189,248,0.7), 0 0 4px rgba(56,189,248,0.9)' }}
            />
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#38bdf8' }}>
                Step {step} of {STEPS.length}
              </p>
              <h2 className="text-xl font-bold text-white mt-0.5">{currentStep.title}</h2>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{currentStep.subtitle}</p>
            </div>
            <div className="flex gap-1.5">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className="h-2 w-2 rounded-full transition-colors"
                  style={{
                    background: s.id <= step ? 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)' : 'rgba(255,255,255,0.1)',
                    boxShadow: s.id === step ? '0 0 8px rgba(56,189,248,0.8), 0 0 2px rgba(56,189,248,1)' : 'none',
                    opacity: s.id < step ? 0.6 : 1,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="px-6 pb-6 pt-2">
            {error && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ background: 'linear-gradient(135deg, rgba(185,28,28,0.25) 0%, rgba(239,68,68,0.15) 100%)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', boxShadow: '0 0 8px rgba(239,68,68,0.15)' }}
              >
                {error}
              </div>
            )}

            {step === 1 && <StepBasics data={data} update={update} />}
            {step === 2 && <StepConditions data={data} toggle={toggleItem} update={update} addCustom={addCustomCondition} />}
            {step === 3 && <StepMedications data={data} update={update} add={addMedication} remove={removeMedication} />}
            {step === 4 && <StepAllergies data={data} toggle={toggleItem} update={update} addCustom={addCustomAllergy} />}
            {step === 5 && <StepLifestyle data={data} update={update} toggle={toggleItem} />}

            {/* Navigation */}
            <div className="flex items-center gap-3 mt-6">
              {step > 1 && (
                <button
                  className="flex-1 rounded-xl py-3 text-sm font-semibold transition-colors"
                  style={{ border: '1px solid rgba(56,189,248,0.15)', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.03)' }}
                  onClick={() => setStep((s) => s - 1)}
                  disabled={saving}
                >
                  Back
                </button>
              )}
              {step < STEPS.length ? (
                <button
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-all duration-200"
                  style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)', boxShadow: '0 4px 20px rgba(3,105,161,0.5), 0 0 0 1px rgba(56,189,248,0.2), 0 0 16px rgba(56,189,248,0.2)' }}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)', boxShadow: '0 4px 20px rgba(3,105,161,0.5), 0 0 0 1px rgba(56,189,248,0.2), 0 0 16px rgba(56,189,248,0.2)' }}
                  onClick={() => void handleFinish()}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Complete Setup'}
                </button>
              )}
            </div>

            {step < STEPS.length && (
              <button
                className="w-full text-center text-xs mt-3 py-1 transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onClick={() => setStep((s) => s + 1)}
              >
                Skip this step
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          You can update your profile anytime from the sidebar.
        </p>
      </div>
    </div>
  );
}

/* ── Step 1: Basics ─────────────────────────────────────────────────────── */

interface StepBasicsProps {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

function StepBasics({ data, update }: StepBasicsProps): React.ReactElement {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Age</label>
          <input type="number" min="1" max="120" placeholder="e.g. 42"
            value={data.age} onChange={(e) => update('age', e.target.value)}
            className="field-input" />
        </div>
        <div>
          <label className="field-label">Biological sex</label>
          <select value={data.sex} onChange={(e) => update('sex', e.target.value)} className="field-input">
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Height</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <input type="number" min="3" max="8" placeholder="5"
              value={data.height_ft} onChange={(e) => update('height_ft', e.target.value)}
              className="field-input pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>ft</span>
          </div>
          <div className="relative">
            <input type="number" min="0" max="11" placeholder="10"
              value={data.height_in} onChange={(e) => update('height_in', e.target.value)}
              className="field-input pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>in</span>
          </div>
        </div>
      </div>
      <div>
        <label className="field-label">Weight</label>
        <div className="relative">
          <input type="number" min="50" max="700" placeholder="185"
            value={data.weight_lbs} onChange={(e) => update('weight_lbs', e.target.value)}
            className="field-input pr-12" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>lbs</span>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Conditions ─────────────────────────────────────────────────── */

interface StepConditionsProps {
  data: OnboardingData;
  toggle: (key: 'conditions' | 'allergies' | 'health_goals', item: string) => void;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  addCustom: () => void;
}

function StepConditions({ data, toggle, update, addCustom }: StepConditionsProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {COMMON_CONDITIONS.map((c) => (
          <DarkCheckChip key={c} label={c} checked={data.conditions.includes(c)} onClick={() => toggle('conditions', c)} />
        ))}
      </div>
      {data.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.conditions.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: 'linear-gradient(135deg, rgba(3,105,161,0.25) 0%, rgba(14,165,233,0.15) 100%)', border: '1px solid rgba(56,189,248,0.4)', color: '#7dd3fc', boxShadow: '0 0 8px rgba(56,189,248,0.15)' }}>
              {c}
              <button onClick={() => toggle('conditions', c)} className="font-bold hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" placeholder="Add another condition..."
          value={data.custom_condition}
          onChange={(e) => update('custom_condition', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          className="field-input flex-1" />
        <button onClick={addCustom}
          className="rounded-xl px-4 text-sm font-semibold transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, rgba(3,105,161,0.3) 0%, rgba(14,165,233,0.2) 100%)', border: '1px solid rgba(56,189,248,0.35)', color: '#7dd3fc', boxShadow: '0 0 12px rgba(56,189,248,0.15)' }}>
          Add
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Medications ────────────────────────────────────────────────── */

interface StepMedicationsProps {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  add: () => void;
  remove: (index: number) => void;
}

function StepMedications({ data, update, add, remove }: StepMedicationsProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {data.medications.length > 0 && (
        <div className="space-y-2">
          {data.medications.map((m, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(6,182,212,0.04) 100%)', border: '1px solid rgba(56,189,248,0.15)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div>
                <span className="text-sm font-semibold text-white">{m.name}</span>
                {m.dose && <span className="text-sm ml-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{m.dose}</span>}
                {m.frequency && <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>· {m.frequency}</span>}
              </div>
              <button onClick={() => remove(i)} className="font-bold text-lg leading-none transition-colors"
                style={{ color: 'rgba(255,255,255,0.25)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fca5a5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-xl p-4 space-y-3"
        style={{ border: '1px dashed rgba(56,189,248,0.35)', background: 'linear-gradient(135deg, rgba(3,105,161,0.12) 0%, rgba(14,165,233,0.06) 100%)', boxShadow: '0 0 24px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#38bdf8' }}>Add medication</p>
        <input type="text" placeholder="Medication name (e.g. Metformin)"
          value={data.med_name} onChange={(e) => update('med_name', e.target.value)}
          className="field-input" />
        <div className="flex gap-2">
          <input type="text" placeholder="Amount (e.g. 500)"
            value={data.med_dose} onChange={(e) => update('med_dose', e.target.value)}
            className="field-input flex-1" />
          <select
            value={data.med_dose_unit}
            onChange={(e) => update('med_dose_unit', e.target.value)}
            className="field-input w-24"
          >
            <option value="mg">mg</option>
            <option value="g">g</option>
            <option value="mL">mL</option>
          </select>
        </div>
        <select
          value={data.med_frequency_times}
          onChange={(e) => update('med_frequency_times', e.target.value)}
          className="field-input w-full"
        >
          <option value="">Times per day...</option>
          <option value="1x per day">1x per day</option>
          <option value="2x per day">2x per day</option>
          <option value="3x per day">3x per day</option>
          <option value="4x per day">4x per day</option>
          <option value="5x per day">5x per day</option>
          <option value="6x per day">6x per day</option>
          <option value="As needed">As needed</option>
        </select>
        <button onClick={add} disabled={!data.med_name.trim()}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)', boxShadow: '0 4px 16px rgba(3,105,161,0.45), 0 0 12px rgba(56,189,248,0.2)' }}>
          Add Medication
        </button>
      </div>
      {data.medications.length === 0 && (
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>No medications added yet. Skip if none.</p>
      )}
    </div>
  );
}

/* ── Step 4: Allergies ──────────────────────────────────────────────────── */

interface StepAllergiesProps {
  data: OnboardingData;
  toggle: (key: 'conditions' | 'allergies' | 'health_goals', item: string) => void;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  addCustom: () => void;
}

function StepAllergies({ data, toggle, update, addCustom }: StepAllergiesProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {COMMON_ALLERGIES.map((a) => (
          <DarkCheckChip key={a} label={a} checked={data.allergies.includes(a)}
            onClick={() => toggle('allergies', a)} accent="red" />
        ))}
      </div>
      {data.allergies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.allergies.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: 'linear-gradient(135deg, rgba(185,28,28,0.25) 0%, rgba(239,68,68,0.15) 100%)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', boxShadow: '0 0 8px rgba(239,68,68,0.15)' }}>
              {a}
              <button onClick={() => toggle('allergies', a)} className="font-bold hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" placeholder="Add another allergy..."
          value={data.custom_allergy}
          onChange={(e) => update('custom_allergy', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          className="field-input flex-1" />
        <button onClick={addCustom}
          className="rounded-xl px-4 text-sm font-semibold transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, rgba(185,28,28,0.3) 0%, rgba(239,68,68,0.2) 100%)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', boxShadow: '0 0 12px rgba(239,68,68,0.15)' }}>
          Add
        </button>
      </div>
    </div>
  );
}

/* ── Step 5: Lifestyle & Goals ──────────────────────────────────────────── */

interface StepLifestyleProps {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggle: (key: 'conditions' | 'allergies' | 'health_goals', item: string) => void;
}

function StepLifestyle({ data, update, toggle }: StepLifestyleProps): React.ReactElement {
  return (
    <div className="space-y-5">
      <DarkSelectGroup label="Exercise frequency" options={EXERCISE_OPTIONS}
        value={data.exercise_frequency} onChange={(v) => update('exercise_frequency', v)} />
      <DarkSelectGroup label="Average nightly sleep" options={SLEEP_OPTIONS}
        value={data.avg_sleep_hours} onChange={(v) => update('avg_sleep_hours', v)} />
      <DarkSelectGroup label="Smoking / tobacco" options={SMOKING_OPTIONS}
        value={data.smoking_status} onChange={(v) => update('smoking_status', v)} />
      <DarkSelectGroup label="Alcohol use" options={ALCOHOL_OPTIONS}
        value={data.alcohol_use} onChange={(v) => update('alcohol_use', v)} />
      <div>
        <label className="field-label mb-2 block">What do you want Sana Health to help you with?</label>
        <div className="grid grid-cols-1 gap-2">
          {HEALTH_GOALS.map((g) => (
            <DarkCheckChip key={g} label={g} checked={data.health_goals.includes(g)}
              onClick={() => toggle('health_goals', g)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Shared UI primitives ───────────────────────────────────────────────── */

interface DarkCheckChipProps {
  label: string;
  checked: boolean;
  onClick: () => void;
  accent?: 'blue' | 'red';
}

function DarkCheckChip({ label, checked, onClick, accent = 'blue' }: DarkCheckChipProps): React.ReactElement {
  const isRed = accent === 'red';
  const checkedStyle = isRed
    ? {
        border: '1px solid rgba(239,68,68,0.45)',
        background: 'linear-gradient(135deg, rgba(185,28,28,0.25) 0%, rgba(239,68,68,0.15) 100%)',
        color: '#fca5a5',
        boxShadow: '0 0 16px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
      }
    : {
        border: '1px solid rgba(56,189,248,0.45)',
        background: 'linear-gradient(135deg, rgba(3,105,161,0.25) 0%, rgba(14,165,233,0.15) 100%)',
        color: '#7dd3fc',
        boxShadow: '0 0 16px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
      };
  const uncheckedStyle = {
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
    color: 'rgba(255,255,255,0.5)',
    boxShadow: 'none',
  };
  const checkBg = isRed
    ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
    : 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 w-full"
      style={checked ? checkedStyle : uncheckedStyle}
    >
      <span
        className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-xs transition-all duration-150"
        style={checked
          ? { background: checkBg, border: 'none', color: 'white', boxShadow: isRed ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(56,189,248,0.5)' }
          : { border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }
        }
      >
        {checked && '✓'}
      </span>
      <span className="leading-snug">{label}</span>
    </button>
  );
}

interface DarkSelectGroupProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

function DarkSelectGroup({ label, options, value, onChange }: DarkSelectGroupProps): React.ReactElement {
  return (
    <div>
      <label className="field-label mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o === value ? '' : o)}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
            style={value === o
              ? { border: '1px solid rgba(56,189,248,0.5)', background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)', color: 'white', boxShadow: '0 0 14px rgba(56,189,248,0.35), 0 2px 8px rgba(3,105,161,0.4)' }
              : { border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', color: 'rgba(255,255,255,0.5)' }
            }
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
