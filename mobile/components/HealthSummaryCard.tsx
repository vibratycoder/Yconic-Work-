/**
 * Card showing a compact health profile summary for the home screen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HealthProfile } from '../lib/types';

interface HealthSummaryCardProps {
  /** The user's health profile to summarize. */
  profile: HealthProfile;
}

/**
 * Compact health profile summary card.
 *
 * Shows condition count, medication count, and abnormal lab count.
 * Used on the home screen and as the memory indicator in chat.
 */
export function HealthSummaryCard({ profile }: HealthSummaryCardProps): React.ReactElement {
  const abnormalLabs = profile.recent_labs.filter(
    (l) => l.status === 'high' || l.status === 'low' || l.status === 'critical',
  );

  return (
    <View style={styles.card}>
      <Text style={styles.memoryIndicator}>
        Sona Health knows your health
      </Text>
      <View style={styles.statsRow}>
        <StatPill label="Conditions" value={profile.primary_conditions.length} />
        <StatPill label="Medications" value={profile.current_medications.length} />
        <StatPill label="Abnormal labs" value={abnormalLabs.length} alert={abnormalLabs.length > 0} />
      </View>
      {profile.primary_conditions.length > 0 && (
        <Text style={styles.conditions} numberOfLines={1}>
          {profile.primary_conditions.join(' · ')}
        </Text>
      )}
    </View>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  alert?: boolean;
}

function StatPill({ label, value, alert = false }: StatPillProps): React.ReactElement {
  return (
    <View style={[styles.pill, alert && styles.pillAlert]}>
      <Text style={[styles.pillValue, alert && styles.pillValueAlert]}>{value}</Text>
      <Text style={[styles.pillLabel, alert && styles.pillLabelAlert]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  memoryIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    flex: 1,
  },
  pillAlert: {
    backgroundColor: 'rgba(254,215,170,0.3)',
  },
  pillValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pillValueAlert: {
    color: '#FEF3C7',
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  pillLabelAlert: {
    color: 'rgba(254,243,199,0.9)',
  },
  conditions: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
  },
});
