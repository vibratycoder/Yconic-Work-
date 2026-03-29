/**
 * Home screen — health summary, quick symptom log, recent labs overview.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { HealthProfile } from '../../lib/types';
import { fetchHealthProfile } from '../../lib/api';
import { HealthSummaryCard } from '../../components/HealthSummaryCard';
import { LabCard } from '../../components/LabCard';

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

/**
 * Main home screen showing health overview and quick-access actions.
 *
 * Loads the user's HealthProfile on mount and displays:
 * - Memory indicator card (conditions + meds count)
 * - Recent abnormal labs
 * - Quick-access buttons for chat and lab scan
 */
export default function HomeScreen(): React.ReactElement {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchHealthProfile(DEMO_USER_ID);
      setProfile(data);
    } catch (error) {
      // Profile not found — prompt onboarding
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  const abnormalLabs = profile?.recent_labs.filter(
    (l) => l.status === 'high' || l.status === 'low' || l.status === 'critical',
  ) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Good {getTimeOfDay()}, {profile?.display_name ?? 'there'}
          </Text>
        </View>

        {profile && <HealthSummaryCard profile={profile} />}

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.askButton} onPress={() => router.push('/(app)/chat')}>
            <Text style={styles.askButtonText}>Ask Sona Health a question</Text>
            <Text style={styles.askButtonSub}>Evidence-based answers using your health data</Text>
          </TouchableOpacity>
        </View>

        {abnormalLabs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abnormal Labs</Text>
            {abnormalLabs.slice(0, 3).map((lab, i) => (
              <LabCard key={lab.test_name + i} lab={lab} />
            ))}
            {abnormalLabs.length > 3 && (
              <TouchableOpacity onPress={() => router.push('/(app)/labs')}>
                <Text style={styles.seeAll}>See all {abnormalLabs.length} abnormal results</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  greeting: { fontSize: 26, fontWeight: '800', color: '#111827' },
  quickActions: { paddingHorizontal: 16, marginBottom: 24 },
  askButton: {
    backgroundColor: '#0EA5E9', borderRadius: 16, padding: 20,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  askButtonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  askButtonSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  seeAll: { fontSize: 14, color: '#0EA5E9', fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
});
