/**
 * Bio Tracker screen — health metrics from Apple Health (iOS) with simulated
 * fallback data for Android, Expo Go, or when permission is denied.
 *
 * Displays six metric cards in a 2-column grid:
 *   Heart Rate · Steps · Calories · Sleep · Weight · Blood Oxygen
 *
 * Apple Health integration requires an EAS dev/production build. In Expo Go
 * the screen shows demo data with a "Demo data" badge.
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
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── Simulated fallback metrics ────────────────────────────────────────────────

interface TrackerMetrics {
  heartRate: number | null;
  steps: number | null;
  calories: number | null;
  sleepHours: number | null;
  weightKg: number | null;
  bloodOxygen: number | null;
  isDemo: boolean;
}

const DEMO_METRICS: TrackerMetrics = {
  heartRate: 68,
  steps: 7240,
  calories: 412,
  sleepHours: 7.2,
  weightKg: 75.5,
  bloodOxygen: 98,
  isDemo: true,
};

// ── HealthKit loader (iOS + custom build only) ────────────────────────────────

/**
 * Attempt to load live metrics from Apple HealthKit.
 * Returns null if HealthKit is unavailable (Expo Go, Android, permission denied).
 */
async function loadHealthKitMetrics(): Promise<TrackerMetrics | null> {
  if (Platform.OS !== 'ios') return null;

  // Require inside function so the module error is caught here, not at module init
  let HK: {
    initHealthKit: (opts: object, cb: (err: string | null) => void) => void;
    getLatestHeartRateSample: (opts: object, cb: (e: string | null, r: { value?: number } | null) => void) => void;
    getStepCount: (opts: object, cb: (e: string | null, r: { value?: number } | null) => void) => void;
    getActiveEnergyBurned: (opts: object, cb: (e: string | null, r: Array<{ value?: number }> | null) => void) => void;
    getSleepSamples: (opts: object, cb: (e: string | null, r: Array<{ startDate: string; endDate: string }> | null) => void) => void;
    getLatestWeight: (opts: object, cb: (e: string | null, r: { value?: number } | null) => void) => void;
    getOxygenSaturation: (opts: object, cb: (e: string | null, r: Array<{ value: number; startDate: string }> | null) => void) => void;
    Constants: { Permissions: Record<string, string> };
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    HK = require('react-native-health') as typeof HK;
    if (!HK?.initHealthKit) return null;
  } catch {
    return null;
  }

  const P = HK.Constants.Permissions;
  const permissions = {
    permissions: {
      read: [P['HeartRate'], P['Steps'], P['ActiveEnergyBurned'], P['SleepAnalysis'], P['Weight'], P['OxygenSaturation']].filter(Boolean),
      write: [],
    },
  };

  const granted = await new Promise<boolean>((resolve) => {
    HK.initHealthKit(permissions, (err) => resolve(!err));
  });
  if (!granted) return null;

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();

  const [hr, steps, cal, sleep, weight, spo2] = await Promise.allSettled([
    new Promise<number | null>((res) =>
      HK.getLatestHeartRateSample({ unit: 'bpm' }, (e, r) => res(!e && r ? Math.round(r.value ?? 0) : null)),
    ),
    new Promise<number | null>((res) =>
      HK.getStepCount({ date: startOfDay }, (e, r) => res(!e && r ? Math.round(r.value ?? 0) : null)),
    ),
    new Promise<number | null>((res) =>
      HK.getActiveEnergyBurned({ startDate: startOfDay }, (e, r) => {
        if (e || !r || r.length === 0) return res(null);
        res(Math.round(r.reduce((sum, s) => sum + (s.value ?? 0), 0)));
      }),
    ),
    new Promise<number | null>((res) =>
      HK.getSleepSamples({ startDate: startOfDay }, (e, r) => {
        if (e || !r || r.length === 0) return res(null);
        const ms = r.reduce((sum, s) => sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()), 0);
        res(parseFloat((ms / 3600000).toFixed(1)));
      }),
    ),
    new Promise<number | null>((res) =>
      HK.getLatestWeight({ unit: 'gram' }, (e, r) => res(!e && r ? parseFloat(((r.value ?? 0) / 1000).toFixed(1)) : null)),
    ),
    new Promise<number | null>((res) =>
      HK.getOxygenSaturation({ unit: 'percent' }, (e, r) => {
        if (e || !r || r.length === 0) return res(null);
        res(Math.round(r[0].value));
      }),
    ),
  ]);

  return {
    heartRate:   hr.status === 'fulfilled' ? hr.value : null,
    steps:       steps.status === 'fulfilled' ? steps.value : null,
    calories:    cal.status === 'fulfilled' ? cal.value : null,
    sleepHours:  sleep.status === 'fulfilled' ? sleep.value : null,
    weightKg:    weight.status === 'fulfilled' ? weight.value : null,
    bloodOxygen: spo2.status === 'fulfilled' ? spo2.value : null,
    isDemo:      false,
  };
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  color: string;
  detail?: string;
}

/**
 * Single metric display card with icon, value, and unit label.
 */
function MetricCard({ icon, label, value, unit, color, detail }: MetricCardProps): React.ReactElement {
  return (
    <View style={[styles.card, { borderColor: `${color}22` }]}>
      <View style={[styles.cardIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as 'heart'} size={20} color={color} />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardUnit}>{unit}</Text>
      {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
    </View>
  );
}

// ── Steps ring ────────────────────────────────────────────────────────────────

/**
 * Circular progress ring showing steps count vs 10 000 daily goal.
 * Implemented with View borders (no SVG dependency required).
 */
function StepsRing({ steps }: { steps: number }): React.ReactElement {
  const goal = 10000;
  const pct = Math.min(steps / goal, 1);
  const label = steps >= goal ? 'Goal reached!' : `${Math.round(pct * 100)}% of goal`;
  return (
    <View style={styles.stepsRingWrap}>
      <View style={styles.stepsRing}>
        <Text style={styles.stepsRingValue}>{steps.toLocaleString()}</Text>
        <Text style={styles.stepsRingUnit}>steps</Text>
      </View>
      <Text style={styles.stepsGoal}>{label}</Text>
      <Text style={styles.stepsTarget}>Goal: 10,000 / day</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

/**
 * Bio Tracker screen.
 *
 * Attempts to load live HealthKit data on iOS (requires EAS dev build).
 * Falls back gracefully to demo data on Android or in Expo Go.
 */
export default function TrackerScreen(): React.ReactElement {
  const [metrics, setMetrics] = useState<TrackerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = useCallback(async (): Promise<void> => {
    const live = await loadHealthKitMetrics();
    setMetrics(live ?? DEMO_METRICS);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void loadMetrics(); }, [loadMetrics]);

  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    void loadMetrics();
  }, [loadMetrics]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  const m = metrics ?? DEMO_METRICS;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* Page header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bio Tracker</Text>
          <Text style={styles.subtitle}>Today's health metrics</Text>
          {m.isDemo && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>Demo data</Text>
            </View>
          )}
        </View>

        {/* Steps ring — prominent feature card */}
        {m.steps !== null && (
          <View style={styles.stepsCard}>
            <StepsRing steps={m.steps} />
          </View>
        )}

        {/* 2-column metric grid */}
        <View style={styles.grid}>
          {m.heartRate !== null && (
            <MetricCard icon="heart" label="Heart Rate"
              value={String(Math.round(m.heartRate))} unit="bpm" color="#ff6b81" detail="Resting" />
          )}
          {m.calories !== null && (
            <MetricCard icon="flame" label="Calories"
              value={String(m.calories)} unit="kcal" color="#ff9f0a" detail="Active energy" />
          )}
          {m.sleepHours !== null && (
            <MetricCard icon="moon" label="Sleep"
              value={String(m.sleepHours)} unit="hours" color="#5e5ce6" detail="Last night" />
          )}
          {m.weightKg !== null && (
            <MetricCard icon="barbell" label="Weight"
              value={String(m.weightKg)} unit="kg" color="#30d158" />
          )}
          {m.bloodOxygen !== null && (
            <MetricCard icon="water" label="Blood Oxygen"
              value={String(m.bloodOxygen)} unit="%" color="#0a84ff" detail="SpO₂" />
          )}
        </View>

        {/* Data source footnote */}
        <Text style={styles.sourceNote}>
          {m.isDemo
            ? 'Apple Health integration is available in EAS dev/production builds. Demo values shown here.'
            : 'Data from Apple Health. Pull to refresh.'}
        </Text>

        {/* Connect prompt (demo + iOS only) */}
        {m.isDemo && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.connectButton} onPress={(): void => { void loadMetrics(); }}>
            <Ionicons name="heart-circle-outline" size={18} color="#38bdf8" />
            <Text style={styles.connectButtonText}>Connect Apple Health</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04090f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#04090f' },
  content: { padding: 16, paddingBottom: 40 },

  header: { paddingHorizontal: 4, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  demoBadge: {
    marginTop: 8, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,159,10,0.15)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)',
  },
  demoBadgeText: { fontSize: 11, fontWeight: '600', color: '#ff9f0a' },

  stepsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)', padding: 20, marginBottom: 12, alignItems: 'center',
  },
  stepsRingWrap: { alignItems: 'center' },
  stepsRing: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: '#38bdf8',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  stepsRingValue: { fontSize: 22, fontWeight: '800', color: '#38bdf8' },
  stepsRingUnit: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  stepsGoal: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  stepsTarget: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  card: {
    width: '47.5%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 4,
  },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  cardValue: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  cardUnit: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  cardDetail: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },

  sourceNote: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center',
    lineHeight: 18, marginBottom: 16,
  },
  connectButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
  },
  connectButtonText: { fontSize: 15, fontWeight: '600', color: '#38bdf8' },
});
