/**
 * Profile screen — full dark-themed health profile editor matching the web
 * EditProfileModal design.
 *
 * Five tab sections: Demographics, Conditions, Medications, Allergies, Lifestyle.
 * The Lifestyle tab exposes the FACT_CATEGORIES toggle-pill UI so users can
 * update their health_facts directly on mobile.
 *
 * A read-only wearable summary card is rendered below the tabbed editor.
 *
 * Pull-to-refresh reloads from the Pulse backend.
 * Tapping "Edit" on any section enters edit mode; "Save" persists via the API.
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

// ── Constants ──────────────────────────────────────────────────────────────

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

/** Available profile-editor tabs, matching the web EditProfileModal order. */
type TabId = 'demographics' | 'conditions' | 'medications' | 'allergies' | 'lifestyle';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'demographics', label: 'Demographics' },
  { id: 'conditions',   label: 'Conditions'   },
  { id: 'medications',  label: 'Medications'  },
  { id: 'allergies',    label: 'Allergies'    },
  { id: 'lifestyle',    label: 'Lifestyle'    },
];

/** Health-fact category definition for the Lifestyle toggle-pill UI. */
interface FactCategory {
  /** Unique identifier used to namespace options in health_facts. */
  id: string;
  /** Human-readable section heading. */
  label: string;
  /** When true only one option per category may be selected at a time. */
  exclusive: boolean;
  /** Selectable option strings. */
  options: string[];
}

const FACT_CATEGORIES: FactCategory[] = [
  {
    id: 'exercise',
    label: 'Exercise frequency',
    exclusive: true,
    options: [
      'Sedentary (little to no exercise)',
      'Light (1–2 days/week)',
      'Moderate (3–4 days/week)',
      'Active (5+ days/week)',
      'Very active (athlete / physical job)',
    ],
  },
  {
    id: 'sleep',
    label: 'Average sleep',
    exclusive: true,
    options: ['Less than 5 hours', '5–6 hours', '6–7 hours', '7–8 hours', '8+ hours'],
  },
  {
    id: 'smoking',
    label: 'Smoking status',
    exclusive: true,
    options: [
      'Never smoked',
      'Former smoker (quit)',
      'Current smoker',
      'Vape / e-cigarette',
    ],
  },
  {
    id: 'alcohol',
    label: 'Alcohol use',
    exclusive: true,
    options: [
      'None',
      'Occasionally (1–2x/month)',
      'Socially (1–2x/week)',
      'Regularly (3–5x/week)',
      'Daily',
    ],
  },
  {
    id: 'goals',
    label: 'Health goals',
    exclusive: false,
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
  },
];

// ── Conversion helpers ─────────────────────────────────────────────────────

/**
 * Converts a height in centimetres to feet and fractional inches strings.
 *
 * @param cm - Height in centimetres, or null/undefined when not recorded.
 * @returns Object with `ft` and `inches` string fields (empty strings when input
 *          is falsy).
 */
function cmToFtIn(cm: number | null | undefined): { ft: string; inches: string } {
  if (!cm) return { ft: '', inches: '' };
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { ft: String(ft), inches: inches > 0 ? String(inches) : '' };
}

/**
 * Converts a weight in kilograms to a rounded pounds string.
 *
 * @param kg - Weight in kilograms, or null/undefined when not recorded.
 * @returns Pounds as a string, or an empty string when input is falsy.
 */
function kgToLbs(kg: number | null | undefined): string {
  if (!kg) return '';
  return String(Math.round(kg * 2.2046));
}

/**
 * Converts feet + inches strings to centimetres.
 *
 * @param ft     - Feet component as a string.
 * @param inches - Inches component as a string (may be empty).
 * @returns Rounded centimetres, or null when the feet value is not parseable.
 */
function ftInToCm(ft: string, inches: string): number | null {
  const f = parseFloat(ft);
  if (isNaN(f)) return null;
  return Math.round(f * 30.48 + parseFloat(inches || '0') * 2.54);
}

/**
 * Converts a pounds string to kilograms rounded to one decimal place.
 *
 * @param lbs - Weight in pounds as a string.
 * @returns Kilograms, or null when the input is not parseable.
 */
function lbsToKg(lbs: string): number | null {
  const v = parseFloat(lbs);
  if (isNaN(v)) return null;
  return Math.round(v * 0.4536 * 10) / 10;
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface DemoStatProps {
  /** Short label rendered above the value. */
  label: string;
  /** Formatted value string. */
  value: string;
}

/**
 * Read-only demographics stat bubble used in the Demographics tab view mode.
 */
function DemoStat({ label, value }: DemoStatProps): React.ReactElement {
  return (
    <View style={styles.demoStat}>
      <Text style={styles.demoStatLabel}>{label}</Text>
      <Text style={styles.demoStatValue}>{value}</Text>
    </View>
  );
}

interface TogglePillProps {
  /** Display text for the pill. */
  label: string;
  /** Whether this pill is currently selected/active. */
  active: boolean;
  /** Called when the user taps the pill. */
  onPress: () => void;
}

/**
 * Selectable pill used in the Lifestyle fact-category toggle groups.
 */
function TogglePill({ label, active, onPress }: TogglePillProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.togglePill, active && styles.togglePillActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.togglePillText, active && styles.togglePillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * Health profile screen with tabbed inline editing matching the web
 * EditProfileModal design.
 *
 * - Pull to refresh reloads profile from backend.
 * - Each tab has its own Edit/Save/Cancel controls.
 * - Lifestyle tab uses toggle pills to manage health_facts.
 * - Wearable summary is rendered below the tabs as a read-only card.
 */
export default function ProfileScreen(): React.ReactElement {
  // ── Remote data ────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Tab state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('demographics');

  // ── Edit / save state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // ── Demographics edit mirrors ──────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [age,         setAge]         = useState('');
  const [sex,         setSex]         = useState('');
  const [heightFt,    setHeightFt]    = useState('');
  const [heightIn,    setHeightIn]    = useState('');
  const [weightLbs,   setWeightLbs]   = useState('');

  // ── Conditions / allergies edit mirrors ───────────────────────────────
  const [conditions, setConditions] = useState('');
  const [allergies,  setAllergies]  = useState('');

  // ── Medications edit mirror ────────────────────────────────────────────
  const [medications,  setMedications]  = useState<Medication[]>([]);
  const [newMedName,   setNewMedName]   = useState('');
  const [newMedDose,   setNewMedDose]   = useState('');
  const [newMedFreq,   setNewMedFreq]   = useState('');

  // ── Lifestyle / health_facts edit mirror ──────────────────────────────
  const [selectedFacts, setSelectedFacts] = useState<string[]>([]);

  // ── Data loading ───────────────────────────────────────────────────────

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      const p = await fetchHealthProfile(DEMO_USER_ID);
      setProfile(p);
    } catch (err: unknown) {
      // Non-fatal — degrade gracefully; error is logged by the API layer.
      void err;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // ── Edit mode helpers ──────────────────────────────────────────────────

  /**
   * Seeds all edit-state mirrors from the current profile and enters edit mode.
   * No-op when no profile is loaded.
   */
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
    setSelectedFacts([...(profile.health_facts ?? [])]);
    setEditing(true);
  }, [profile]);

  /** Discards all pending edits and exits edit mode. */
  const handleCancel = useCallback((): void => {
    setEditing(false);
  }, []);

  /**
   * Persists the current tab's edit state to the backend.
   *
   * Constructs a partial update object that only includes the fields relevant
   * to the active tab so unrelated fields are never accidentally overwritten.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!profile) return;
    setSaving(true);
    try {
      let patch: Partial<HealthProfile> = {};

      if (activeTab === 'demographics') {
        patch = {
          display_name: displayName.trim(),
          age:          age ? parseInt(age, 10) : null,
          sex:          sex || null,
          height_cm:    ftInToCm(heightFt, heightIn),
          weight_kg:    lbsToKg(weightLbs),
        };
      } else if (activeTab === 'conditions') {
        patch = {
          primary_conditions: conditions
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        };
      } else if (activeTab === 'medications') {
        patch = { current_medications: medications };
      } else if (activeTab === 'allergies') {
        patch = {
          allergies: allergies
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
        };
      } else {
        // lifestyle
        patch = { health_facts: selectedFacts };
      }

      const updated = await updateHealthProfile(DEMO_USER_ID, { ...profile, ...patch });
      setProfile(updated);
      setEditing(false);
    } catch (err: unknown) {
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    profile,
    activeTab,
    displayName, age, sex, heightFt, heightIn, weightLbs,
    conditions,
    medications,
    allergies,
    selectedFacts,
  ]);

  // ── Medication helpers ─────────────────────────────────────────────────

  /**
   * Appends the new-medication form fields as a Medication entry, then clears
   * the form. No-op when the name field is blank.
   */
  const addMedication = useCallback((): void => {
    if (!newMedName.trim()) return;
    setMedications((prev) => [
      ...prev,
      {
        name:      newMedName.trim(),
        dose:      newMedDose.trim(),
        frequency: newMedFreq.trim(),
      },
    ]);
    setNewMedName('');
    setNewMedDose('');
    setNewMedFreq('');
  }, [newMedName, newMedDose, newMedFreq]);

  /**
   * Removes the medication at the given index from the edit-state mirror.
   *
   * @param index - Zero-based index into the medications array.
   */
  const removeMedication = useCallback((index: number): void => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Lifestyle toggle helper ────────────────────────────────────────────

  /**
   * Toggles a health-fact option within a fact category.
   *
   * For exclusive categories, selecting a new option deselects all other
   * options belonging to the same category.  For non-exclusive categories the
   * option is simply toggled on or off.
   *
   * @param category - The fact category containing the option.
   * @param option   - The specific option string being toggled.
   */
  const toggleFact = useCallback(
    (category: FactCategory, option: string): void => {
      setSelectedFacts((prev) => {
        const isActive = prev.includes(option);

        if (category.exclusive) {
          // Remove every option belonging to this category first.
          const withoutCategory = prev.filter(
            (f) => !category.options.includes(f),
          );
          // If the tapped option was already active, just deselect it; otherwise select it.
          return isActive ? withoutCategory : [...withoutCategory, option];
        }

        // Non-exclusive: plain toggle.
        return isActive
          ? prev.filter((f) => f !== option)
          : [...prev, option];
      });
    },
    [],
  );

  // ── Tab switch handler ─────────────────────────────────────────────────

  /**
   * Switches the active tab.  If currently editing, the pending edits are
   * discarded and the user is notified via an alert before switching.
   *
   * @param tabId - The tab to switch to.
   */
  const switchTab = useCallback(
    (tabId: TabId): void => {
      if (editing && tabId !== activeTab) {
        Alert.alert(
          'Discard changes?',
          'You have unsaved edits on this tab.  Switching will discard them.',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Switch',
              style: 'destructive',
              onPress: () => {
                setEditing(false);
                setActiveTab(tabId);
              },
            },
          ],
        );
        return;
      }
      setActiveTab(tabId);
    },
    [editing, activeTab],
  );

  // ── Render guards ──────────────────────────────────────────────────────

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

  // ── Tab content renderers ──────────────────────────────────────────────

  /** Renders the Demographics tab in view or edit mode. */
  function renderDemographics(): React.ReactElement {
    if (editing) {
      return (
        <View>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.editInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />

          <Text style={styles.fieldLabel}>Age</Text>
          <TextInput
            style={styles.editInput}
            value={age}
            onChangeText={setAge}
            placeholder="42"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Sex</Text>
          <View style={styles.chipRow}>
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

          <Text style={styles.fieldLabel}>Height (ft / in)</Text>
          <View style={styles.rowInputs}>
            <TextInput
              style={[styles.editInput, styles.halfInput]}
              value={heightFt}
              onChangeText={setHeightFt}
              placeholder="ft"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.editInput, styles.halfInput]}
              value={heightIn}
              onChangeText={setHeightIn}
              placeholder="in"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
            />
          </View>

          <Text style={styles.fieldLabel}>Weight (lbs)</Text>
          <TextInput
            style={styles.editInput}
            value={weightLbs}
            onChangeText={setWeightLbs}
            placeholder="165"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="decimal-pad"
          />
        </View>
      );
    }

    const hasAny =
      profile.age != null ||
      !!profile.sex ||
      profile.height_cm != null ||
      profile.weight_kg != null;

    if (!hasAny) {
      return <Text style={styles.emptyHint}>Tap Edit to add your basics</Text>;
    }

    return (
      <View style={styles.statGrid}>
        {profile.age != null && (
          <DemoStat label="Age" value={`${profile.age} yrs`} />
        )}
        {profile.sex && (
          <DemoStat
            label="Sex"
            value={profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)}
          />
        )}
        {profile.height_cm != null && (
          <DemoStat
            label="Height"
            value={`${cmToFtIn(profile.height_cm).ft}′${cmToFtIn(profile.height_cm).inches || '0'}″`}
          />
        )}
        {profile.weight_kg != null && (
          <DemoStat label="Weight" value={`${kgToLbs(profile.weight_kg)} lbs`} />
        )}
      </View>
    );
  }

  /** Renders the Conditions tab in view or edit mode. */
  function renderConditions(): React.ReactElement {
    if (editing) {
      return (
        <>
          <Text style={styles.fieldLabel}>
            Conditions (comma-separated)
          </Text>
          <TextInput
            style={[styles.editInput, styles.textArea]}
            value={conditions}
            onChangeText={setConditions}
            placeholder="e.g. Type 2 Diabetes, Hypertension"
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
          />
        </>
      );
    }

    if (profile.primary_conditions.length === 0) {
      return <Text style={styles.emptyHint}>No conditions recorded</Text>;
    }

    return (
      <>
        {profile.primary_conditions.map((c, i) => (
          <Text key={i} style={styles.listItem}>{c}</Text>
        ))}
      </>
    );
  }

  /** Renders the Medications tab in view or edit mode. */
  function renderMedications(): React.ReactElement {
    const items = editing ? medications : profile.current_medications;

    return (
      <>
        {items.length === 0 && !editing && (
          <Text style={styles.emptyHint}>No medications recorded</Text>
        )}
        {items.map((m, i) => (
          <View key={i} style={styles.medRow}>
            <View style={styles.medInfo}>
              <Text style={styles.medName}>{m.name}</Text>
              {(m.dose || m.frequency) && (
                <Text style={styles.medMeta}>
                  {[m.dose, m.frequency].filter(Boolean).join(' · ')}
                </Text>
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
            <Text style={styles.sectionHeader}>ADD MEDICATION</Text>
            <TextInput
              style={styles.editInput}
              value={newMedName}
              onChangeText={setNewMedName}
              placeholder="Name (e.g. Metformin)"
              placeholderTextColor="rgba(255,255,255,0.25)"
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.editInput, styles.halfInput]}
                value={newMedDose}
                onChangeText={setNewMedDose}
                placeholder="Dose (e.g. 500mg)"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
              <TextInput
                style={[styles.editInput, styles.halfInput]}
                value={newMedFreq}
                onChangeText={setNewMedFreq}
                placeholder="Freq (e.g. 2x/day)"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.actionButton,
                !newMedName.trim() && styles.actionButtonDisabled,
              ]}
              onPress={addMedication}
              disabled={!newMedName.trim()}
            >
              <Text style={styles.actionButtonText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  }

  /** Renders the Allergies tab in view or edit mode. */
  function renderAllergies(): React.ReactElement {
    if (editing) {
      return (
        <>
          <Text style={styles.fieldLabel}>Allergies (comma-separated)</Text>
          <TextInput
            style={[styles.editInput, styles.textArea]}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g. Penicillin, Sulfa drugs"
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
          />
        </>
      );
    }

    if (profile.allergies.length === 0) {
      return <Text style={styles.emptyHint}>No allergies recorded</Text>;
    }

    return (
      <>
        {profile.allergies.map((a, i) => (
          <Text key={i} style={styles.listItem}>{a}</Text>
        ))}
      </>
    );
  }

  /**
   * Renders the Lifestyle tab containing FACT_CATEGORIES toggle-pill groups.
   *
   * In view mode the currently selected facts are displayed as read-only pills.
   * In edit mode all options are shown and can be toggled.
   */
  function renderLifestyle(): React.ReactElement {
    if (editing) {
      return (
        <>
          {FACT_CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.factCategory}>
              <Text style={styles.sectionHeader}>{cat.label.toUpperCase()}</Text>
              <View style={styles.pillWrap}>
                {cat.options.map((opt) => (
                  <TogglePill
                    key={opt}
                    label={opt}
                    active={selectedFacts.includes(opt)}
                    onPress={() => toggleFact(cat, opt)}
                  />
                ))}
              </View>
            </View>
          ))}
        </>
      );
    }

    // View mode — show selected facts grouped by category.
    const hasAnyFacts = (profile.health_facts ?? []).length > 0;
    if (!hasAnyFacts) {
      return <Text style={styles.emptyHint}>No lifestyle facts recorded</Text>;
    }

    return (
      <>
        {FACT_CATEGORIES.map((cat) => {
          const selected = (profile.health_facts ?? []).filter((f) =>
            cat.options.includes(f),
          );
          if (selected.length === 0) return null;
          return (
            <View key={cat.id} style={styles.factCategory}>
              <Text style={styles.sectionHeader}>{cat.label.toUpperCase()}</Text>
              <View style={styles.pillWrap}>
                {selected.map((opt) => (
                  <View key={opt} style={styles.togglePillActive}>
                    <Text style={styles.togglePillTextActive}>{opt}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </>
    );
  }

  /** Returns the body content for the currently active tab. */
  function renderTabContent(): React.ReactElement {
    switch (activeTab) {
      case 'demographics': return renderDemographics();
      case 'conditions':   return renderConditions();
      case 'medications':  return renderMedications();
      case 'allergies':    return renderAllergies();
      case 'lifestyle':    return renderLifestyle();
    }
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadProfile();
            }}
            tintColor="#0EA5E9"
          />
        }
      >
        {/* ── Page header ─────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>
              {profile.display_name || 'My Profile'}
            </Text>
            <Text style={styles.pageSub}>
              {profile.conversation_count}{' '}
              conversation{profile.conversation_count !== 1 ? 's' : ''} with Sona Health
            </Text>
          </View>
        </View>

        {/* ── Tab pills ───────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
          keyboardShouldPersistTaps="handled"
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, activeTab === tab.id && styles.tabPillActive]}
              onPress={() => switchTab(tab.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === tab.id && styles.tabPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Tab content card ─────────────────────────────────────────── */}
        <View style={styles.card}>
          {/* Card header row with section title + Edit/Save/Cancel */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionHeader}>
              {TABS.find((t) => t.id === activeTab)?.label.toUpperCase()}
            </Text>

            {!editing ? (
              <TouchableOpacity style={styles.editButton} onPress={enterEdit}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.saveRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#0EA5E9" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tab-specific body */}
          {renderTabContent()}
        </View>

        {/* ── Wearable summary (read-only) ─────────────────────────────── */}
        {profile.wearable_summary && (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>WEARABLE DATA — 7-day avg</Text>

            {profile.wearable_summary.avg_resting_heart_rate != null && (
              <View style={styles.wearableRow}>
                <Text style={styles.wearableLabel}>Resting heart rate</Text>
                <Text style={styles.wearableValue}>
                  {profile.wearable_summary.avg_resting_heart_rate.toFixed(0)} bpm
                </Text>
              </View>
            )}

            {profile.wearable_summary.avg_sleep_hours != null && (
              <View style={styles.wearableRow}>
                <Text style={styles.wearableLabel}>Avg sleep</Text>
                <Text style={styles.wearableValue}>
                  {profile.wearable_summary.avg_sleep_hours.toFixed(1)} hrs
                  {profile.wearable_summary.avg_sleep_quality
                    ? ` · ${profile.wearable_summary.avg_sleep_quality}`
                    : ''}
                </Text>
              </View>
            )}

            {profile.wearable_summary.avg_hrv_ms != null && (
              <View style={styles.wearableRow}>
                <Text style={styles.wearableLabel}>HRV</Text>
                <Text style={styles.wearableValue}>
                  {profile.wearable_summary.avg_hrv_ms.toFixed(0)} ms
                </Text>
              </View>
            )}

            {profile.wearable_summary.avg_steps_per_day != null && (
              <View style={styles.wearableRow}>
                <Text style={styles.wearableLabel}>Steps / day</Text>
                <Text style={styles.wearableValue}>
                  {profile.wearable_summary.avg_steps_per_day.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout
  container: {
    flex: 1,
    backgroundColor: '#04090f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#04090f',
  },
  content: {
    padding: 20,
    paddingBottom: 56,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },

  // ── Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageHeaderLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  pageSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },

  // ── Tab bar
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabPillActive: {
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  tabPillTextActive: {
    color: '#38bdf8',
  },

  // ── Content card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── Edit / Save / Cancel controls
  editButton: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  saveRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  saveButton: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
  },

  // ── Text inputs (edit mode)
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    marginTop: 12,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },

  // ── Sex chips (Demographics edit)
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sexChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sexChipActive: {
    borderColor: 'rgba(56,189,248,0.4)',
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  sexChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  sexChipTextActive: {
    color: '#38bdf8',
  },

  // ── Demographics stat grid (view mode)
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  demoStat: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
  },
  demoStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  demoStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },

  // ── List items (Conditions / Allergies view mode)
  listItem: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  emptyHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  // ── Medications
  medRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  medMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff453a',
    paddingLeft: 12,
  },
  addMedBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionButton: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
  },

  // ── Lifestyle toggle pills
  factCategory: {
    marginBottom: 18,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  togglePillActive: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderColor: 'rgba(56,189,248,0.4)',
  },
  togglePillText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  togglePillTextActive: {
    fontSize: 13,
    color: '#38bdf8',
  },

  // ── Wearable summary card
  wearableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  wearableLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  wearableValue: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
});
