/**
 * Modal for editing the user's health profile fields shown in the sidebar:
 * conditions, medications, and allergies.
 */

'use client';

import { useState, useCallback } from 'react';
import type { HealthProfile, Medication } from '../lib/types';
import { updateHealthProfile } from '../lib/api';
import { FACT_CATEGORIES, ALL_BASELINE_FACTS } from '../lib/health-facts';
import { COMMON_CONDITIONS, COMMON_ALLERGIES } from '../lib/health-options';


type Tab = 'demographics' | 'conditions' | 'medications' | 'allergies' | 'learned';

interface MedDraft {
  name: string;
  dose: string;
  dose_unit: string;
  frequency: string;
}

const INITIAL_MED_DRAFT: MedDraft = { name: '', dose: '', dose_unit: 'mg', frequency: '' };

interface EditProfileModalProps {
  /** Current profile to pre-populate the form. */
  profile: HealthProfile;
  /** User ID for the PUT request. */
  userId: string;
  /** Called after a successful save. */
  onSaved: () => void;
  /** Called when the modal should close without saving. */
  onClose: () => void;
}

/**
 * Full-screen modal overlay for editing the health profile sidebar fields.
 *
 * Three tabs: Conditions, Medications, Allergies.
 * Saves via PUT /api/profile/{userId} and calls onSaved on success.
 */
function cmToFtIn(cm: number | null | undefined): { ft: string; inches: string } {
  if (!cm) return { ft: '', inches: '' };
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { ft: String(ft), inches: inches > 0 ? String(inches) : '' };
}

function kgToLbs(kg: number | null | undefined): string {
  if (!kg) return '';
  return String(Math.round(kg * 2.2046));
}

function ftInToCm(ft: string, inches: string): number | null {
  const f = parseFloat(ft);
  if (isNaN(f)) return null;
  return Math.round((f * 30.48) + (parseFloat(inches || '0') * 2.54));
}

function lbsToKg(lbs: string): number | null {
  const v = parseFloat(lbs);
  if (isNaN(v)) return null;
  return Math.round(v * 0.4536 * 10) / 10;
}

export function EditProfileModal({
  profile,
  userId,
  onSaved,
  onClose,
}: EditProfileModalProps): React.ReactElement {
  const [tab, setTab] = useState<Tab>('demographics');
  const [conditions, setConditions] = useState<string[]>(profile.primary_conditions);
  const [medications, setMedications] = useState<Medication[]>(profile.current_medications);
  const [allergies, setAllergies] = useState<string[]>(profile.allergies);

  const [medDraft, setMedDraft] = useState<MedDraft>(INITIAL_MED_DRAFT);
  const [customCondition, setCustomCondition] = useState('');
  const [customAllergy, setCustomAllergy] = useState('');

  const [healthFacts, setHealthFacts] = useState<string[]>(profile.health_facts);
  const [customFact, setCustomFact] = useState('');

  // Demographics
  const [displayName, setDisplayName] = useState<string>(profile.display_name ?? '');
  const initHeight = cmToFtIn(profile.height_cm);
  const [age, setAge] = useState<string>(profile.age != null ? String(profile.age) : '');
  const [sex, setSex] = useState<string>(profile.sex ?? '');
  const [heightFt, setHeightFt] = useState<string>(initHeight.ft);
  const [heightIn, setHeightIn] = useState<string>(initHeight.inches);
  const [weightLbs, setWeightLbs] = useState<string>(kgToLbs(profile.weight_kg));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCondition = useCallback((c: string): void => {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }, []);

  const addCustomCondition = useCallback((): void => {
    const val = customCondition.trim();
    if (!val || conditions.includes(val)) return;
    setConditions((prev) => [...prev, val]);
    setCustomCondition('');
  }, [customCondition, conditions]);

  const toggleAllergy = useCallback((a: string): void => {
    setAllergies((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }, []);

  const addCustomAllergy = useCallback((): void => {
    const val = customAllergy.trim();
    if (!val || allergies.includes(val)) return;
    setAllergies((prev) => [...prev, val]);
    setCustomAllergy('');
  }, [customAllergy, allergies]);

  const addMedication = useCallback((): void => {
    if (!medDraft.name.trim()) return;
    const med: Medication = {
      name: medDraft.name.trim(),
      dose: medDraft.dose.trim() ? `${medDraft.dose.trim()} ${medDraft.dose_unit}` : '',
      frequency: medDraft.frequency,
    };
    setMedications((prev) => [...prev, med]);
    setMedDraft(INITIAL_MED_DRAFT);
  }, [medDraft]);

  const removeMedication = useCallback((index: number): void => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeHealthFact = useCallback((index: number): void => {
    setHealthFacts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleFact = useCallback((f: string): void => {
    const group = FACT_CATEGORIES.find((c) => c.exclusive && c.options.includes(f));
    setHealthFacts((prev) => {
      if (prev.includes(f)) return prev.filter((x) => x !== f);
      // For exclusive groups, remove any other selection from the same group first.
      const withoutGroup = group ? prev.filter((x) => !group.options.includes(x)) : prev;
      return [...withoutGroup, f];
    });
  }, []);

  const addCustomFact = useCallback((): void => {
    const val = customFact.trim();
    if (!val || healthFacts.includes(val)) return;
    setHealthFacts((prev) => [...prev, val]);
    setCustomFact('');
  }, [customFact, healthFacts]);

  const handleSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      // Send only editable fields — backend ProfileUpdate model does not
      // include recent_labs, wearable_summary, or member_since.
      await updateHealthProfile(userId, {
        user_id: profile.user_id,
        display_name: displayName.trim() || profile.display_name,
        age: age ? parseInt(age, 10) : null,
        sex: sex || null,
        height_cm: ftInToCm(heightFt, heightIn),
        weight_kg: lbsToKg(weightLbs),
        primary_conditions: conditions,
        current_medications: medications,
        allergies,
        health_facts: healthFacts,
        conversation_count: profile.conversation_count,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [userId, profile, displayName, age, sex, heightFt, heightIn, weightLbs, conditions, medications, allergies, healthFacts, onSaved]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'demographics', label: 'Basics' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'medications', label: 'Medications' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'learned', label: 'Learned' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#1e3a5f', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-bold text-white">Edit Health Profile</h2>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className="flex-1 py-3 text-sm font-semibold transition-colors"
              style={tab === t.id
                ? { color: '#38bdf8', borderBottom: '2px solid #38bdf8' }
                : { color: 'rgba(255,255,255,0.4)' }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {tab === 'demographics' && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Used to personalise lab reference ranges and clinical context.
              </p>
              {/* Display name */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {/* Age */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Age</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  placeholder="e.g. 42"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {/* Sex */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Biological sex</label>
                <div className="flex gap-2">
                  {['male', 'female', 'other'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSex(sex === s ? '' : s)}
                      className="flex-1 rounded-xl py-2 text-sm font-semibold transition-colors capitalize"
                      style={sex === s
                        ? { backgroundColor: '#0f4c75', color: '#fff', border: '1px solid #38bdf8' }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Height */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Height</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      placeholder="ft"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <span className="absolute right-3 top-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>ft</span>
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      placeholder="in"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <span className="absolute right-3 top-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>in</span>
                  </div>
                </div>
              </div>
              {/* Weight */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Weight</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 165"
                    value={weightLbs}
                    onChange={(e) => setWeightLbs(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <span className="absolute right-3 top-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>lbs</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'conditions' && (
            <>
              <div className="flex flex-wrap gap-2">
                {COMMON_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCondition(c)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={conditions.includes(c)
                      ? { backgroundColor: '#0f4c75', color: '#fff', border: '1px solid #38bdf8' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {/* Custom entries not in the common list */}
              {conditions.filter((c) => !COMMON_CONDITIONS.includes(c)).map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium mr-1"
                  style={{ backgroundColor: '#0f4c75', color: '#fff', border: '1px solid #38bdf8' }}
                >
                  {c}
                  <button onClick={() => toggleCondition(c)} style={{ color: 'rgba(255,255,255,0.6)' }}>✕</button>
                </span>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom condition..."
                  value={customCondition}
                  onChange={(e) => setCustomCondition(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomCondition(); }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button
                  onClick={addCustomCondition}
                  disabled={!customCondition.trim()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-30"
                  style={{ backgroundColor: '#0f4c75' }}
                >
                  Add
                </button>
              </div>
            </>
          )}

          {tab === 'medications' && (
            <>
              {medications.length > 0 && (
                <div className="space-y-2 mb-1">
                  {medications.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div>
                        <span className="text-sm font-medium text-white">{m.name}</span>
                        {(m.dose || m.frequency) && (
                          <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {[m.dose, m.frequency].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeMedication(i)}
                        className="text-xs px-2 py-0.5 rounded-lg"
                        style={{ color: '#fca5a5' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ border: '1px dashed rgba(56,189,248,0.25)', backgroundColor: 'rgba(56,189,248,0.05)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#38bdf8' }}>Add medication</p>
                <input
                  type="text"
                  placeholder="Medication name (e.g. Metformin)"
                  value={medDraft.name}
                  onChange={(e) => setMedDraft((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Amount (e.g. 500)"
                    value={medDraft.dose}
                    onChange={(e) => setMedDraft((p) => ({ ...p, dose: e.target.value }))}
                    className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <select
                    value={medDraft.dose_unit}
                    onChange={(e) => setMedDraft((p) => ({ ...p, dose_unit: e.target.value }))}
                    className="w-20 rounded-xl px-2 py-2 text-sm text-white focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="mL">mL</option>
                  </select>
                </div>
                <select
                  value={medDraft.frequency}
                  onChange={(e) => setMedDraft((p) => ({ ...p, frequency: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="">Times per day...</option>
                  <option value="1x per day">1x per day</option>
                  <option value="2x per day">2x per day</option>
                  <option value="3x per day">3x per day</option>
                  <option value="4x per day">4x per day</option>
                  <option value="As needed">As needed</option>
                </select>
                <button
                  onClick={addMedication}
                  disabled={!medDraft.name.trim()}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#0f4c75' }}
                >
                  Add Medication
                </button>
              </div>
            </>
          )}

          {tab === 'allergies' && (
            <>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleAllergy(a)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={allergies.includes(a)
                      ? { backgroundColor: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {allergies.filter((a) => !COMMON_ALLERGIES.includes(a)).map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium mr-1"
                  style={{ backgroundColor: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}
                >
                  {a}
                  <button onClick={() => toggleAllergy(a)} style={{ color: 'rgba(255,255,255,0.6)' }}>✕</button>
                </span>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom allergy..."
                  value={customAllergy}
                  onChange={(e) => setCustomAllergy(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomAllergy(); }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button
                  onClick={addCustomAllergy}
                  disabled={!customAllergy.trim()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-30"
                  style={{ backgroundColor: '#0f4c75' }}
                >
                  Add
                </button>
              </div>
            </>
          )}
          {tab === 'learned' && (
            <div className="space-y-5">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Select facts that apply to you. These are used to personalise every health response.
              </p>

              {/* Categorised baseline presets — same options as sign-up questionnaire */}
              {FACT_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: '#38bdf8' }}>
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cat.options.map((f) => (
                      <button
                        key={f}
                        onClick={() => toggleFact(f)}
                        className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                        style={healthFacts.includes(f)
                          ? { backgroundColor: '#0f4c75', color: '#fff', border: '1px solid #38bdf8' }
                          : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Facts learned from conversations (not in any preset category) */}
              {healthFacts.filter((f) => !ALL_BASELINE_FACTS.includes(f)).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Learned from conversations
                  </p>
                  <div className="space-y-2">
                    {healthFacts.filter((f) => !ALL_BASELINE_FACTS.includes(f)).map((fact) => (
                      <div
                        key={fact}
                        className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <span className="flex-1 text-sm text-white leading-relaxed">{fact}</span>
                        <button
                          onClick={() => removeHealthFact(healthFacts.indexOf(fact))}
                          className="text-xs px-2 py-0.5 rounded-lg flex-shrink-0"
                          style={{ color: '#fca5a5' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add custom fact */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Add custom
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Follows a low-FODMAP diet"
                    value={customFact}
                    onChange={(e) => setCustomFact(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCustomFact(); }}
                    className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button
                    onClick={addCustomFact}
                    disabled={!customFact.trim()}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-30"
                    style={{ backgroundColor: '#0f4c75' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {error && <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>}
          {!error && <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#0f4c75' }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
