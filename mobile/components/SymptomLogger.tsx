/**
 * Inline symptom logging widget for the home screen.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface SymptomLoggerProps {
  /** Called when a symptom is submitted with severity. */
  onSubmit: (symptom: string, severity: number) => Promise<void>;
}

/**
 * Quick symptom logging widget.
 *
 * Accepts a free-text symptom description and a 1-10 severity rating.
 * Designed for rapid entry without navigating away from the home screen.
 */
export function SymptomLogger({ onSubmit }: SymptomLoggerProps): React.ReactElement {
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState(5);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!symptom.trim()) return;
    setLoading(true);
    try {
      await onSubmit(symptom.trim(), severity);
      setSubmitted(true);
      setSymptom('');
      setSeverity(5);
      setTimeout(() => setSubmitted(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Log a symptom</Text>
      <TextInput
        style={styles.input}
        value={symptom}
        onChangeText={setSymptom}
        placeholder="What are you experiencing?"
        placeholderTextColor="#9CA3AF"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      <View style={styles.severityRow}>
        <Text style={styles.severityLabel}>Severity: {severity}/10</Text>
        <View style={styles.severityButtons}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.severityDot, severity >= n && styles.severityDotActive]}
              onPress={() => setSeverity(n)}
            />
          ))}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.button, (!symptom.trim() || loading) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!symptom.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>{submitted ? 'Logged' : 'Log Symptom'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  severityRow: {
    marginBottom: 12,
  },
  severityLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  severityDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
  },
  severityDotActive: {
    backgroundColor: '#0EA5E9',
  },
  button: {
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#BAE6FD',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
