/**
 * Profile screen — displays and allows inline editing of the health profile.
 *
 * Tapping "Edit" switches each section into edit mode.
 * Demographics (name, age, sex, height, weight), conditions, medications,
 * and allergies can all be updated and saved back to the Pulse backend.
 */

import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { HealthProfile, Medication } from '../../lib/types';
import { fetchHealthProfile, updateHealthProfile } from '../../lib/api';

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Health profile screen with inline editing for all profile fields.
 *
 * Pull to refresh to reload from the backend.
 * Tap "Edit" on any section to enter edit mode, then "Save" to persist.
 */
export default function ProfileScreen(): React.ReactElement {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state mirrors
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      const p = await fetchHealthProfile(DEMO_USER_ID);
      setProfile(p);
    } catch {
      // Non-fatal — profile display degrades gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const enterEdit = useCallback((): void => {
    if (!profile) return;
    const h = cmToFtIn(profile.height_cm);
    setDisplayName(profile.display_name ?? '');
    setAge(profile.age != null ? String(profile.age) : '');
    setSex(profile.sex ?? '');
    setHeightFt(h.ft);
    setHeightIn(h.inches);
    setWeightLbs(kgToLbs(profile.weight_kg));
    setConditions(profile.primary_conditions.join(', '));
    setAllergies(profile.allergies.join(', '));
    setMedications([...profile.current_medications]);
    setEditing(true);
  }, [profile]);

  const addMedication = useCallback((): void => {
    if (!newMedName.trim()) return;
    setMedications((prev) => [
      ...prev,
      { name: newMedName.trim(), dose: newMedDose.trim(), frequency: newMedFreq.trim() },
    ]);
    setNewMedName('');
    setNewMedDose('');
    setNewMedFreq('');
  }, [newMedName, newMedDose, newMedFreq]);

  const removeMedication = useCallback((index: number): void => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateHealthProfile(DEMO_USER_ID, {
        ...profile,
        display_name: displayName.trim(),
        age: age ? parseInt(age, 10) : null,
        sex: sex || null,
        height_cm: ftInToCm(heightFt, heightIn),
        weight_kg: lbsToKg(weightLbs),
        primary_conditions: conditions.split(',').map((c) => c.trim()).filter(Boolean),
        allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
        current_medications: medications,
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [profile, displayName, age, sex, heightFt, heightIn, weightLbs, conditions, allergies, medications]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>No profile found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadProfile(); }}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {editing
              ? <TextInput
                  style={[styles.input, styles.nameInput]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor="#9CA3AF"
                />
              : <Text style={styles.title}>{profile.display_name || 'My Profile'}</Text>
            }
            <Text style={styles.memberSince}>
              {profile.conversation_count} conversation{profile.conversation_count !== 1 ? 's' : ''} with Pulse
            </Text>
          </View>
          {!editing
            ? <TouchableOpacity style={styles.editButton} onPress={enterEdit}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            : <View style={styles.saveRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditing(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={() => void handleSave()}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.saveButtonText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
          }
        </View>

        {/* Demographics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BASICS</Text>
          {editing ? (
            <View style={styles.demoGrid}>
              <View style={styles.demoField}>
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="42"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.demoField}>
                <Text style={styles.fieldLabel}>Sex</Text>
                <View style={styles.sexRow}>
                  {['male', 'female', 'other'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sexChip, sex === s && styles.sexChipActive]}
                      onPress={() => setSex(sex === s ? '' : s)}
                    >
                      <Text style={[styles.sexChipText, sex === s && styles.sexChipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.demoField}>
                <Text style={styles.fieldLabel}>Height</Text>
                <View style={styles.heightRow}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    value={heightFt}
                    onChangeText={setHeightFt}
                    placeholder="ft"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    value={heightIn}
                    onChangeText={setHeightIn}
                    placeholder="in"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.demoField}>
                <Text style={styles.fieldLabel}>Weight (lbs)</Text>
                <TextInput
                  style={styles.input}
                  value={weightLbs}
                  onChangeText={setWeightLbs}
                  placeholder="165"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          ) : (
            <View style={styles.demoGrid}>
              {profile.age != null && <DemoStat label="Age" value={`${profile.age} yrs`} />}
              {profile.sex && <DemoStat label="Sex" value={profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)} />}
              {profile.height_cm != null && (
                <DemoStat
                  label="Height"
                  value={`${cmToFtIn(profile.height_cm).ft}′${cmToFtIn(profile.height_cm).inches || '0'}″`}
                />
              )}
              {profile.weight_kg != null && (
                <DemoStat label="Weight" value={`${kgToLbs(profile.weight_kg)} lbs`} />
              )}
              {!profile.age && !profile.sex && !profile.height_cm && !profile.weight_kg && (
                <Text style={styles.emptyHint}>Tap Edit to add your basics</Text>
              )}
            </View>
          )}
        </View>

        {/* Conditions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONDITIONS</Text>
          {editing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={conditions}
              onChangeText={setConditions}
              placeholder="e.g. Type 2 Diabetes, Hypertension"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          ) : (
            profile.primary_conditions.length > 0
              ? profile.primary_conditions.map((c, i) => (
                  <Text key={i} style={styles.item}>{c}</Text>
                ))
              : <Text style={styles.emptyHint}>No conditions recorded</Text>
          )}
        </View>

        {/* Medications */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MEDICATIONS</Text>
          {medications.map((m, i) => (
            <View key={i} style={styles.medRow}>
              <View style={styles.medInfo}>
                <Text style={styles.medName}>{m.name}</Text>
                {(m.dose || m.frequency) && (
                  <Text style={styles.medMeta}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</Text>
                )}
              </View>
              {editing && (
                <TouchableOpacity onPress={() => removeMedication(i)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {editing && (
            <View style={styles.addMedBox}>
              <Text style={styles.fieldLabel}>Add medication</Text>
              <TextInput
                style={styles.input}
                value={newMedName}
                onChangeText={setNewMedName}
                placeholder="Name (e.g. Metformin)"
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.heightRow}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={newMedDose}
                  onChangeText={setNewMedDose}
                  placeholder="Dose (e.g. 500mg)"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={newMedFreq}
                  onChangeText={setNewMedFreq}
                  placeholder="Freq (e.g. 2x/day)"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <TouchableOpacity
                style={styles.addMedButton}
                onPress={addMedication}
                disabled={!newMedName.trim()}
              >
                <Text style={styles.addMedButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
          {!editing && medications.length === 0 && (
            <Text style={styles.emptyHint}>No medications recorded</Text>
          )}
        </View>

        {/* Allergies */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ALLERGIES</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g. Penicillin, Sulfa drugs"
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            profile.allergies.length > 0
              ? profile.allergies.map((a, i) => (
                  <Text key={i} style={styles.item}>{a}</Text>
                ))
              : <Text style={styles.emptyHint}>No allergies recorded</Text>
          )}
        </View>

        {/* Health facts (read-only display — managed via web or AI conversation) */}
        {profile.health_facts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>HEALTH FACTS</Text>
            {profile.health_facts.slice(-10).map((fact, i) => (
              <Text key={i} style={styles.item}>{fact}</Text>
            ))}
          </View>
        )}

        {/* Wearable summary (read-only — synced via HealthKit) */}
        {profile.wearable_summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>WEARABLE DATA (7-day avg)</Text>
            {profile.wearable_summary.avg_resting_heart_rate != null && (
              <Text style={styles.item}>Heart rate: {profile.wearable_summary.avg_resting_heart_rate.toFixed(0)} bpm</Text>
            )}
            {profile.wearable_summary.avg_sleep_hours != null && (
              <Text style={styles.item}>
                Sleep: {profile.wearable_summary.avg_sleep_hours.toFixed(1)} hrs ({profile.wearable_summary.avg_sleep_quality ?? 'unknown'})
              </Text>
            )}
            {profile.wearable_summary.avg_hrv_ms != null && (
              <Text style={styles.item}>HRV: {profile.wearable_summary.avg_hrv_ms.toFixed(0)} ms</Text>
            )}
            {profile.wearable_summary.avg_steps_per_day != null && (
              <Text style={styles.item}>Steps/day: {profile.wearable_summary.avg_steps_per_day.toLocaleString()}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface DemoStatProps {
  label: string;
  value: string;
}

function DemoStat({ label, value }: DemoStatProps): React.ReactElement {
  return (
    <View style={styles.demoStat}>
      <Text style={styles.demoStatLabel}>{label}</Text>
      <Text style={styles.demoStatValue}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 2 },
  memberSince: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  nameInput: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  editButton: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  editButtonText: { fontSize: 14, fontWeight: '700', color: '#0EA5E9' },
  saveRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cancelButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  saveButton: { backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 60, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#BAE6FD' },
  saveButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, marginBottom: 12 },
  item: { fontSize: 15, color: '#374151', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  emptyHint: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  emptyText: { textAlign: 'center', marginTop: 80, fontSize: 16, color: '#6B7280' },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  demoStat: { backgroundColor: '#F0F9FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 80 },
  demoStatLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 2 },
  demoStatValue: { fontSize: 16, fontWeight: '700', color: '#0EA5E9' },
  demoField: { width: '100%', marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  sexRow: { flexDirection: 'row', gap: 8 },
  sexChip: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  sexChipActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  sexChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  sexChipTextActive: { color: '#0EA5E9' },
  heightRow: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  medRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  medInfo: { flex: 1 },
  medName: { fontSize: 15, color: '#111827', fontWeight: '600' },
  medMeta: { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  removeText: { fontSize: 13, color: '#EF4444', fontWeight: '600', paddingLeft: 12 },
  addMedBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  addMedButton: { backgroundColor: '#F0F9FF', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  addMedButtonText: { fontSize: 14, fontWeight: '700', color: '#0EA5E9' },
});
