/**
 * Profile screen — displays and allows editing of the health profile.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { HealthProfile } from '../../lib/types';
import { fetchHealthProfile } from '../../lib/api';

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

/**
 * Health profile screen showing all stored health context.
 *
 * Displays conditions, medications, allergies, health facts,
 * and wearable summary in a readable card layout.
 */
export default function ProfileScreen(): React.ReactElement {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      setProfile(await fetchHealthProfile(DEMO_USER_ID));
    } catch (error) {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProfile(); }} />}
      >
        <Text style={styles.title}>{profile.display_name}</Text>
        {profile.age && profile.sex && (
          <Text style={styles.demographics}>{profile.age} years old · {profile.sex}</Text>
        )}
        <Text style={styles.memberSince}>Member · {profile.conversation_count} conversations</Text>

        <ProfileSection title="Conditions" items={profile.primary_conditions} />
        <ProfileSection title="Medications" items={profile.current_medications.map((m) => `${m.name} ${m.dose} ${m.frequency}`)} />
        <ProfileSection title="Allergies" items={profile.allergies} />
        <ProfileSection title="Health Facts (from conversations)" items={profile.health_facts.slice(-10)} />

        {profile.wearable_summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Wearable Data (7-day avg)</Text>
            {profile.wearable_summary.avg_resting_heart_rate !== undefined && (
              <Text style={styles.wearableItem}>Heart rate: {profile.wearable_summary.avg_resting_heart_rate.toFixed(0)} bpm</Text>
            )}
            {profile.wearable_summary.avg_sleep_hours !== undefined && (
              <Text style={styles.wearableItem}>Sleep: {profile.wearable_summary.avg_sleep_hours.toFixed(1)} hrs ({profile.wearable_summary.avg_sleep_quality ?? 'unknown'})</Text>
            )}
            {profile.wearable_summary.avg_hrv_ms !== undefined && (
              <Text style={styles.wearableItem}>HRV: {profile.wearable_summary.avg_hrv_ms.toFixed(0)} ms</Text>
            )}
            {profile.wearable_summary.avg_steps_per_day !== undefined && (
              <Text style={styles.wearableItem}>Steps/day: {profile.wearable_summary.avg_steps_per_day.toLocaleString()}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ProfileSectionProps {
  title: string;
  items: string[];
}

function ProfileSection({ title, items }: ProfileSectionProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.item}>{item}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827', marginBottom: 4 },
  demographics: { fontSize: 16, color: '#6B7280', marginBottom: 2 },
  memberSince: { fontSize: 14, color: '#9CA3AF', marginBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 10 },
  item: { fontSize: 15, color: '#374151', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  wearableItem: { fontSize: 15, color: '#374151', paddingVertical: 3 },
  emptyText: { textAlign: 'center', marginTop: 80, fontSize: 16, color: '#6B7280' },
});
