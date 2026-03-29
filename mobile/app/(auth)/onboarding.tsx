/**
 * Onboarding screen — collects health profile during first run.
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

/** Step index for multi-step onboarding flow. */
type OnboardingStep = 0 | 1 | 2 | 3;

const STEP_TITLES: Record<OnboardingStep, string> = {
  0: 'Welcome to Pulse',
  1: 'Your health background',
  2: 'Current medications',
  3: 'Almost done',
};

/**
 * Multi-step onboarding flow to capture the initial health profile.
 *
 * Step 0: Name, age, sex
 * Step 1: Primary conditions, allergies
 * Step 2: Current medications
 * Step 3: Review and confirm
 */
export default function OnboardingScreen(): React.ReactElement {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medDoseUnit, setMedDoseUnit] = useState('mg');
  const [medFrequencyTimes, setMedFrequencyTimes] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);

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

  const handleNext = (): void => {
    if (step < 3) {
      setStep(((step + 1) as OnboardingStep));
    }
  };

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
      const heightCm = !isNaN(hFt) ? Math.round((hFt * 30.48) + (hIn * 2.54)) : undefined;
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
        health_facts: [],
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
    } catch (error) {
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepIndicator}>Step {step + 1} of 4</Text>
        <Text style={styles.title}>{STEP_TITLES[step]}</Text>

        {step === 0 && (
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Your name</Text>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName}
              placeholder="First name" placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge}
              placeholder="e.g. 42" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
            <Text style={styles.fieldLabel}>Sex</Text>
            <View style={styles.sexButtons}>
              {['male', 'female', 'other'].map((s) => (
                <TouchableOpacity key={s} style={[styles.sexButton, sex === s && styles.sexButtonActive]}
                  onPress={() => setSex(s)}>
                  <Text style={[styles.sexButtonText, sex === s && styles.sexButtonTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Height</Text>
            <View style={styles.doseRow}>
              <TextInput style={[styles.input, styles.doseInput]} value={heightFt}
                onChangeText={setHeightFt} placeholder="ft" placeholderTextColor="#9CA3AF"
                keyboardType="number-pad" />
              <TextInput style={[styles.input, styles.doseInput]} value={heightIn}
                onChangeText={setHeightIn} placeholder="in" placeholderTextColor="#9CA3AF"
                keyboardType="number-pad" />
            </View>
            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <TextInput style={styles.input} value={weightLbs} onChangeText={setWeightLbs}
              placeholder="e.g. 165" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
          </View>
        )}

        {step === 1 && (
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Diagnosed conditions (comma-separated)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={conditions}
              onChangeText={setConditions} placeholder="e.g. hypertension, type 2 diabetes"
              placeholderTextColor="#9CA3AF" multiline numberOfLines={3} />
            <Text style={styles.fieldLabel}>Allergies (comma-separated)</Text>
            <TextInput style={styles.input} value={allergies} onChangeText={setAllergies}
              placeholder="e.g. penicillin, sulfa" placeholderTextColor="#9CA3AF" />
          </View>
        )}

        {step === 2 && (
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Add medication</Text>
            <TextInput style={styles.input} value={medName} onChangeText={setMedName}
              placeholder="Name (e.g. Metformin)" placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>Dose</Text>
            <View style={styles.doseRow}>
              <TextInput style={[styles.input, styles.doseInput]} value={medDose} onChangeText={setMedDose}
                placeholder="Amount (e.g. 500)" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
              <View style={styles.unitButtons}>
                {['mg', 'g', 'mL'].map((u) => (
                  <TouchableOpacity key={u} style={[styles.unitButton, medDoseUnit === u && styles.unitButtonActive]}
                    onPress={() => setMedDoseUnit(u)}>
                    <Text style={[styles.unitButtonText, medDoseUnit === u && styles.unitButtonTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={styles.fieldLabel}>Times per day</Text>
            <View style={styles.freqButtons}>
              {['1x', '2x', '3x', '4x', '5x', '6x', 'PRN'].map((f) => (
                <TouchableOpacity key={f} style={[styles.freqButton, medFrequencyTimes === f && styles.freqButtonActive]}
                  onPress={() => setMedFrequencyTimes(medFrequencyTimes === f ? '' : f)}>
                  <Text style={[styles.freqButtonText, medFrequencyTimes === f && styles.freqButtonTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.addButton} onPress={addMedication}>
              <Text style={styles.addButtonText}>Add Medication</Text>
            </TouchableOpacity>
            {medications.map((m, i) => (
              <Text key={i} style={styles.medicationItem}>
                {m.name} {m.dose} {m.frequency}
              </Text>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.fields}>
            <Text style={styles.reviewText}>Name: {displayName}</Text>
            {age ? <Text style={styles.reviewText}>Age: {age}</Text> : null}
            {sex ? <Text style={styles.reviewText}>Sex: {sex}</Text> : null}
            {heightFt ? <Text style={styles.reviewText}>Height: {heightFt}′{heightIn || '0'}″</Text> : null}
            {weightLbs ? <Text style={styles.reviewText}>Weight: {weightLbs} lbs</Text> : null}
            {conditions ? <Text style={styles.reviewText}>Conditions: {conditions}</Text> : null}
            {allergies ? <Text style={styles.reviewText}>Allergies: {allergies}</Text> : null}
            <Text style={styles.reviewText}>Medications: {medications.length}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={step === 3 ? handleSubmit : handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>{step === 3 ? 'Get Started' : 'Continue'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, paddingTop: 48 },
  stepIndicator: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827', marginBottom: 32 },
  fields: { marginBottom: 32 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  sexButtons: { flexDirection: 'row', gap: 10 },
  sexButton: {
    flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  sexButtonActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  sexButtonText: { fontSize: 15, fontWeight: '500', color: '#6B7280' },
  sexButtonTextActive: { color: '#0EA5E9', fontWeight: '700' },
  doseRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  doseInput: { flex: 1 },
  unitButtons: { flexDirection: 'row', gap: 6 },
  unitButton: {
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  unitButtonActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  unitButtonText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  unitButtonTextActive: { color: '#0EA5E9' },
  freqButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  freqButton: {
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  freqButtonActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  freqButtonText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  freqButtonTextActive: { color: '#0EA5E9' },
  addButton: {
    backgroundColor: '#F0F9FF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#0EA5E9' },
  medicationItem: { fontSize: 14, color: '#374151', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reviewText: { fontSize: 16, color: '#374151', paddingVertical: 6 },
  nextButton: {
    backgroundColor: '#0EA5E9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  nextButtonDisabled: { backgroundColor: '#BAE6FD' },
  nextButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
