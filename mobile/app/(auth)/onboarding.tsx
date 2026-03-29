/**
 * Onboarding screen — collects health profile during first run.
 *
 * Step 0: Name, age, sex, height, weight
 * Step 1: Primary conditions, allergies
 * Step 2: Current medications
 * Step 3: Lifestyle & habits (exercise, sleep, smoking, alcohol, health goals)
 * Step 4: Review and confirm
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { HealthProfile, Medication } from '../../lib/types';

/** Step index for the 5-step onboarding flow. */
type OnboardingStep = 0 | 1 | 2 | 3 | 4;

const STEP_TITLES: Record<OnboardingStep, string> = {
  0: 'Welcome to Sana Health',
  1: 'Your health background',
  2: 'Current medications',
  3: 'Lifestyle & habits',
  4: 'Almost done',
};

/**
 * Describes one exclusive-or-multi-select category shown on Step 3.
 *
 * @property label     - Display heading for this category group.
 * @property options   - The selectable pill values.
 * @property exclusive - When true only one option may be active at a time.
 */
interface FactCategory {
  label: string;
  options: string[];
  exclusive: boolean;
}

const FACT_CATEGORIES: FactCategory[] = [
  {
    label: 'Exercise frequency',
    options: [
      'Sedentary (little to no exercise)',
      'Light (1–2 days/week)',
      'Moderate (3–4 days/week)',
      'Active (5+ days/week)',
      'Very active (athlete / physical job)',
    ],
    exclusive: true,
  },
  {
    label: 'Average sleep',
    options: [
      'Less than 5 hours',
      '5–6 hours',
      '6–7 hours',
      '7–8 hours',
      '8+ hours',
    ],
    exclusive: true,
  },
  {
    label: 'Smoking status',
    options: [
      'Never smoked',
      'Former smoker (quit)',
      'Current smoker',
      'Vape / e-cigarette',
    ],
    exclusive: true,
  },
  {
    label: 'Alcohol use',
    options: [
      'None',
      'Occasionally (1–2x/month)',
      'Socially (1–2x/week)',
      'Regularly (3–5x/week)',
      'Daily',
    ],
    exclusive: true,
  },
  {
    label: 'Health goals',
    options: [
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
    ],
    exclusive: false,
  },
];

/**
 * Multi-step onboarding flow to capture the initial health profile.
 * All steps use a dark design that matches the Pulse web app.
 */
export default function OnboardingScreen(): React.ReactElement {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // ── Step 0 ─────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [sex, setSex] = useState<string>('');
  const [heightFt, setHeightFt] = useState<string>('');
  const [heightIn, setHeightIn] = useState<string>('');
  const [weightLbs, setWeightLbs] = useState<string>('');

  // ── Step 1 ─────────────────────────────────────────────────────────────
  const [conditions, setConditions] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');

  // ── Step 2 ─────────────────────────────────────────────────────────────
  const [medName, setMedName] = useState<string>('');
  const [medDose, setMedDose] = useState<string>('');
  const [medDoseUnit, setMedDoseUnit] = useState<string>('mg');
  const [medFrequencyTimes, setMedFrequencyTimes] = useState<string>('');
  const [medications, setMedications] = useState<Medication[]>([]);

  // ── Step 3 ─────────────────────────────────────────────────────────────
  const [selectedFacts, setSelectedFacts] = useState<string[]>([]);

  /**
   * Adds the currently-entered medication to the list and resets the form
   * fields. Does nothing if the medication name is empty.
   */
  const addMedication = (): void => {
    if (!medName.trim()) return;
    setMedications((prev) => [
      ...prev,
      {
        name: medName.trim(),
        dose: medDose.trim() ? `${medDose.trim()} ${medDoseUnit}` : '',
        frequency: medFrequencyTimes,
      },
    ]);
    setMedName('');
    setMedDose('');
    setMedDoseUnit('mg');
    setMedFrequencyTimes('');
  };

  /**
   * Advances to the next onboarding step.
   * Only valid to call when step < 4; the final step uses handleSubmit.
   */
  const handleNext = (): void => {
    if (step < 4) {
      setStep((step + 1) as OnboardingStep);
    }
  };

  /**
   * Toggles a fact-category pill.
   *
   * For exclusive categories every other option in the same category is
   * deselected before the tapped option is activated.  For the non-exclusive
   * "Health goals" category each pill toggles independently.
   *
   * @param category - The category that owns the tapped pill.
   * @param option   - The pill value that was tapped.
   */
  const toggleFact = (category: FactCategory, option: string): void => {
    setSelectedFacts((prev) => {
      if (category.exclusive) {
        // Remove every option belonging to this category, then add the new one
        // (unless it was already selected, in which case deselect it).
        const withoutCategory = prev.filter(
          (v) => !category.options.includes(v),
        );
        if (prev.includes(option)) {
          return withoutCategory;
        }
        return [...withoutCategory, option];
      }
      // Non-exclusive: simple toggle
      return prev.includes(option)
        ? prev.filter((v) => v !== option)
        : [...prev, option];
    });
  };

  /**
   * Validates the form, converts imperial measurements to metric, and POSTs
   * the completed health profile to the backend API before navigating home.
   */
  const handleSubmit = async (): Promise<void> => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    setLoading(true);
    try {
      // Convert ft/in → cm and lbs → kg for storage
      const hFt = parseFloat(heightFt);
      const hIn = parseFloat(heightIn || '0');
      const heightCm = !isNaN(hFt)
        ? Math.round(hFt * 30.48 + hIn * 2.54)
        : undefined;
      const wKg = !isNaN(parseFloat(weightLbs))
        ? Math.round(parseFloat(weightLbs) * 0.4536 * 10) / 10
        : undefined;

      const profile: Partial<HealthProfile> = {
        display_name: displayName.trim(),
        age: age ? parseInt(age, 10) : undefined,
        sex: sex || undefined,
        height_cm: heightCm,
        weight_kg: wKg,
        primary_conditions: conditions
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        allergies: allergies
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        current_medications: medications,
        recent_labs: [],
        health_facts: selectedFacts,
        conversation_count: 0,
      };

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8010'}/api/profile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...profile, user_id: 'placeholder' }),
        },
      );

      if (!response.ok) throw new Error('Failed to save profile');
      router.replace('/(app)/home');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Error', `Failed to save your profile: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator pill */}
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>Step {step + 1} of 5</Text>
        </View>

        <Text style={styles.title}>{STEP_TITLES[step]}</Text>

        {/* ── Step 0: Basic info ─────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Your name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="First name"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="e.g. 42"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Sex</Text>
            <View style={styles.selectionRow}>
              {(['male', 'female', 'other'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.selectionButton,
                    sex === s && styles.selectionButtonActive,
                  ]}
                  onPress={() => setSex(s)}
                >
                  <Text
                    style={[
                      styles.selectionButtonText,
                      sex === s && styles.selectionButtonTextActive,
                    ]}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Height</Text>
            <View style={styles.doseRow}>
              <TextInput
                style={[styles.input, styles.doseInput]}
                value={heightFt}
                onChangeText={setHeightFt}
                placeholder="ft"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, styles.doseInput]}
                value={heightIn}
                onChangeText={setHeightIn}
                placeholder="in"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={weightLbs}
              onChangeText={setWeightLbs}
              placeholder="e.g. 165"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
            />
          </View>
        )}

        {/* ── Step 1: Conditions & allergies ────────────────────────────── */}
        {step === 1 && (
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>
              Diagnosed conditions (comma-separated)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={conditions}
              onChangeText={setConditions}
              placeholder="e.g. hypertension, type 2 diabetes"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Allergies (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g. penicillin, sulfa"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>
        )}

        {/* ── Step 2: Medications ───────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Add medication</Text>
            <TextInput
              style={styles.input}
              value={medName}
              onChangeText={setMedName}
              placeholder="Name (e.g. Metformin)"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.fieldLabel}>Dose</Text>
            <View style={styles.doseRow}>
              <TextInput
                style={[styles.input, styles.doseInput]}
                value={medDose}
                onChangeText={setMedDose}
                placeholder="Amount (e.g. 500)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="decimal-pad"
              />
              <View style={styles.selectionRow}>
                {(['mg', 'g', 'mL'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.selectionButton,
                      medDoseUnit === u && styles.selectionButtonActive,
                    ]}
                    onPress={() => setMedDoseUnit(u)}
                  >
                    <Text
                      style={[
                        styles.selectionButtonText,
                        medDoseUnit === u && styles.selectionButtonTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.fieldLabel}>Times per day</Text>
            <View style={styles.pillWrap}>
              {(['1x', '2x', '3x', '4x', '5x', '6x', 'PRN'] as const).map(
                (f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.selectionButton,
                      medFrequencyTimes === f && styles.selectionButtonActive,
                    ]}
                    onPress={() =>
                      setMedFrequencyTimes(medFrequencyTimes === f ? '' : f)
                    }
                  >
                    <Text
                      style={[
                        styles.selectionButtonText,
                        medFrequencyTimes === f &&
                          styles.selectionButtonTextActive,
                      ]}
                    >
                      {f}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            <TouchableOpacity style={styles.addButton} onPress={addMedication}>
              <Text style={styles.addButtonText}>Add Medication</Text>
            </TouchableOpacity>

            {medications.map((m, i) => (
              <View key={i} style={styles.medicationItem}>
                <Text style={styles.medicationItemText}>
                  {m.name}
                  {m.dose ? `  ${m.dose}` : ''}
                  {m.frequency ? `  ${m.frequency}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Step 3: Lifestyle & habits ────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.fields}>
            {FACT_CATEGORIES.map((category) => (
              <View key={category.label} style={styles.factGroup}>
                <Text style={styles.fieldLabel}>{category.label}</Text>
                <View style={styles.pillWrap}>
                  {category.options.map((option) => {
                    const active = selectedFacts.includes(option);
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.selectionButton,
                          active && styles.selectionButtonActive,
                        ]}
                        onPress={() => toggleFact(category, option)}
                      >
                        <Text
                          style={[
                            styles.selectionButtonText,
                            active && styles.selectionButtonTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Step 4: Review ────────────────────────────────────────────── */}
        {step === 4 && (
          <View style={styles.fields}>
            <Text style={styles.reviewText}>Name: {displayName}</Text>
            {age ? <Text style={styles.reviewText}>Age: {age}</Text> : null}
            {sex ? <Text style={styles.reviewText}>Sex: {sex}</Text> : null}
            {heightFt ? (
              <Text style={styles.reviewText}>
                Height: {heightFt}′{heightIn || '0'}″
              </Text>
            ) : null}
            {weightLbs ? (
              <Text style={styles.reviewText}>Weight: {weightLbs} lbs</Text>
            ) : null}
            {conditions ? (
              <Text style={styles.reviewText}>Conditions: {conditions}</Text>
            ) : null}
            {allergies ? (
              <Text style={styles.reviewText}>Allergies: {allergies}</Text>
            ) : null}
            <Text style={styles.reviewText}>
              Medications: {medications.length}
            </Text>
            {selectedFacts.length > 0 ? (
              <Text style={styles.reviewText}>
                Lifestyle: {selectedFacts.length} facts selected
              </Text>
            ) : null}
          </View>
        )}

        {/* ── Primary action button ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={step === 4 ? handleSubmit : handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 4 ? 'Get Started' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /** Full-screen dark background. */
  container: { flex: 1, backgroundColor: '#04090f' },

  /** Scroll view inner padding. */
  content: { padding: 24, paddingTop: 48 },

  /** Step X of 5 pill indicator. */
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  stepPillText: { fontSize: 13, fontWeight: '600', color: '#38bdf8' },

  /** Screen heading. */
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 32 },

  /** Wrapper for all fields within a step. */
  fields: { marginBottom: 32 },

  /** Label above each input. */
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    marginTop: 16,
  },

  /** Standard single-line text input. */
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },

  /** Multi-line text area variant. */
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  /** Horizontal row used for sex / unit / frequency buttons. */
  selectionRow: { flexDirection: 'row', gap: 8 },

  /** Individual inactive selection pill / button. */
  selectionButton: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  /** Active state for a selection pill. */
  selectionButtonActive: {
    borderColor: 'rgba(56,189,248,0.5)',
    backgroundColor: 'rgba(56,189,248,0.15)',
  },

  /** Text inside an inactive selection pill. */
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  /** Text inside an active selection pill. */
  selectionButtonTextActive: { color: '#38bdf8' },

  /** Row layout for dose amount + unit buttons. */
  doseRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  /** Flex-fill input within a doseRow. */
  doseInput: { flex: 1 },

  /** Wrapping container for pill groups (frequency, fact options). */
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  /** Spacing between fact category groups on Step 3. */
  factGroup: { marginBottom: 8 },

  /** Ghost "Add Medication" secondary button. */
  addButton: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#38bdf8' },

  /** Dark card for each added medication. */
  medicationItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  medicationItemText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  /** Review step summary row. */
  reviewText: { fontSize: 16, color: 'rgba(255,255,255,0.7)', paddingVertical: 6 },

  /** Primary Continue / Get Started button. */
  nextButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },

  /** Disabled state for the primary button while loading. */
  nextButtonDisabled: { backgroundColor: 'rgba(14,165,233,0.4)' },

  nextButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
