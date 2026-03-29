/**
 * Card component for displaying a single lab result with status indicator.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LabResult } from '../lib/types';

interface LabCardProps {
  /** The lab result to display. */
  lab: LabResult;
}

/** Color mapping for lab result status badges. */
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  normal: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
  low: { bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
  high: { bg: '#FFF7ED', text: '#C2410C', border: '#FCA5A1' },
  critical: { bg: '#FFF1F2', text: '#BE123C', border: '#FDA4AF' },
  unknown: { bg: '#F9FAFB', text: '#6B7280', border: '#D1D5DB' },
};

/** Status display labels. */
const STATUS_LABELS: Record<string, string> = {
  normal: 'Normal',
  low: 'Low',
  high: 'High',
  critical: 'Critical',
  unknown: 'Unknown',
};

/**
 * Displays a lab test result with value, unit, reference range, and status badge.
 *
 * Color-coded by clinical status: green for normal, orange for high,
 * blue for low, red for critical.
 */
export function LabCard({ lab }: LabCardProps): React.ReactElement {
  const colors = STATUS_COLORS[lab.status] ?? STATUS_COLORS.unknown;
  const statusLabel = STATUS_LABELS[lab.status] ?? 'Unknown';
  const displayValue = lab.value !== undefined ? `${lab.value} ${lab.unit ?? ''}`.trim() : (lab.value_text ?? '—');

  const referenceRange =
    lab.reference_range_low !== undefined && lab.reference_range_high !== undefined
      ? `${lab.reference_range_low}–${lab.reference_range_high} ${lab.unit ?? ''}`.trim()
      : lab.reference_range_high !== undefined
      ? `< ${lab.reference_range_high} ${lab.unit ?? ''}`.trim()
      : null;

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.testName}>{lab.test_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusText, { color: colors.text }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.value}>{displayValue}</Text>
      {referenceRange && <Text style={styles.referenceRange}>Normal: {referenceRange}</Text>}
      {lab.date_collected && (
        <Text style={styles.date}>Collected: {lab.date_collected}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  testName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  referenceRange: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
