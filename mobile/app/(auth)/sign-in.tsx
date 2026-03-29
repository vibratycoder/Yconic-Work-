/**
 * Sign-in screen — email + password authentication for returning users.
 *
 * On success Supabase fires an auth state change, which the root layout
 * listener picks up and navigates to (app)/home automatically.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

/**
 * Email + password sign-in form.
 *
 * Calls supabase.auth.signInWithPassword and displays any error returned.
 * Navigation on success is handled by the root layout's auth listener.
 */
export default function SignInScreen(): React.ReactElement {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Attempt to sign in with the provided email and password.
   * Displays the Supabase error message if the attempt fails.
   */
  const handleSignIn = async (): Promise<void> => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        setError(authError.message);
      }
      // On success the root layout listener navigates to (app)/home.
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Wordmark */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox} />
            <Text style={styles.brandName}>Sana Health</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your health profile</Text>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
          />

          {/* Error */}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Create account */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Sana Health? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/onboarding')}>
              <Text style={styles.footerLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#04090f' },
  content: { padding: 24, paddingTop: 60 },

  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#0369a1', marginRight: 10,
  },
  brandName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },

  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 36 },

  label: {
    fontSize: 13, fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#FFFFFF',
  },

  error: {
    color: '#ff453a',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },

  button: {
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: { fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  footerLink: { fontSize: 15, color: '#38bdf8', fontWeight: '600' },
});
