/**
 * Visit Prep screen — AI-generated doctor visit summary.
 *
 * Calls GET /api/visit-prep/{user_id} on mount and renders the result as
 * structured sections: medications to discuss, abnormal labs, health history,
 * and the full AI-generated summary text.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { generateVisitPrep } from '../../lib/api';
import { supabase } from '../../lib/supabase';

/** Shape of the VisitSummary returned by the backend. */
interface VisitSummary {
  chief_complaints: string[];
  medication_list: string[];
  abnormal_labs: string[];
  health_history: string[];
  questions_to_ask: string[];
  full_text: string;
}

/**
 * Renders a titled section card with a list of string items.
 *
 * @param title - Section heading displayed in small-caps style.
 * @param items - Bullet items to render.
 * @param emptyText - Fallback text when items is empty.
 */
function SectionCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyHint}>{emptyText}</Text>
      ) : (
        items.map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Visit preparation screen.
 *
 * Loads the AI-generated visit summary from the backend and presents it
 * in digestible sections the user can review before seeing their doctor.
 */
export default function VisitPrepScreen(): React.ReactElement {
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  const loadSummary = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setError(null);
    try {
      const result = await generateVisitPrep(userId);
      setSummary(result as VisitSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate visit summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void loadSummary();
  }, [userId, loadSummary]);

  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    void loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Generating your visit summary…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visit Prep</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadSummary()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : summary ? (
          <>
            <Text style={styles.intro}>
              AI-generated summary to help you make the most of your doctor visit.
            </Text>

            <SectionCard
              title="MEDICATIONS TO DISCUSS"
              items={summary.medication_list}
              emptyText="No medications recorded"
            />
            <SectionCard
              title="ABNORMAL LABS TO REVIEW"
              items={summary.abnormal_labs}
              emptyText="No abnormal labs on file"
            />
            <SectionCard
              title="HEALTH HISTORY POINTS"
              items={summary.health_history}
              emptyText="No health facts recorded"
            />
            <SectionCard
              title="QUESTIONS TO ASK YOUR DOCTOR"
              items={summary.questions_to_ask}
              emptyText="No questions generated"
            />

            {summary.full_text ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>FULL SUMMARY</Text>
                <Text style={styles.fullText}>{summary.full_text}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04090f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#04090f',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56,189,248,0.12)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  intro: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(56,189,248,0.7)',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#38bdf8',
    lineHeight: 22,
    width: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },
  fullText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,100,100,0.9)',
    textAlign: 'center',
    lineHeight: 21,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#38bdf8',
  },
});
