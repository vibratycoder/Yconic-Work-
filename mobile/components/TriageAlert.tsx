/**
 * Full-screen emergency alert component.
 * Shown when the backend returns triage_level === "emergency".
 * Cannot be dismissed until the user confirms they are seeking help.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
} from 'react-native';

interface TriageAlertProps {
  /** Whether the alert is visible. */
  visible: boolean;
  /** Called when the user confirms they are seeking emergency care. */
  onConfirm: () => void;
  /** Emergency message text from the backend. */
  message: string;
}

/**
 * Undismissable full-screen emergency banner.
 *
 * Renders on top of all other UI when a life-threatening symptom pattern
 * is detected. The user must tap "I understand — calling now" to dismiss.
 * Provides a one-tap button to call 911 directly.
 */
export function TriageAlert({ visible, onConfirm, message }: TriageAlertProps): React.ReactElement {
  const [confirmed, setConfirmed] = useState(false);

  const handleCall911 = (): void => {
    Linking.openURL('tel:911');
  };

  const handleConfirm = (): void => {
    setConfirmed(true);
    onConfirm();
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emergencyLabel}>EMERGENCY</Text>
          <Text style={styles.title}>Call 911 Now</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity style={styles.call911Button} onPress={handleCall911} activeOpacity={0.85}>
            <Text style={styles.call911Text}>Call 911</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, confirmed && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={confirmed}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>I understand — calling now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DC2626',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emergencyLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#FEE2E2',
    marginBottom: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  message: {
    fontSize: 17,
    color: '#FEE2E2',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 48,
  },
  call911Button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 64,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  call911Text: {
    fontSize: 24,
    fontWeight: '800',
    color: '#DC2626',
  },
  confirmButton: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
