'use client';

/**
 * Authentication page — login and sign-up for Pulse.
 * Handles both flows with a toggled form UI.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '../../lib/supabase';

type AuthMode = 'login' | 'signup';

interface LoginForm {
  email: string;
  password: string;
}

interface SignUpForm {
  display_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  password: string;
  confirm_password: string;
}

const EMPTY_LOGIN: LoginForm = { email: '', password: '' };
const EMPTY_SIGNUP: SignUpForm = {
  display_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  password: '',
  confirm_password: '',
};

/**
 * Creates a minimal health profile for a new user via the Pulse API.
 *
 * @param userId - Supabase auth user UUID
 * @param displayName - User's full name from sign-up form
 */
async function createInitialProfile(userId: string, displayName: string): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';
  await fetch(`${apiUrl}/api/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      display_name: displayName,
      primary_conditions: [],
      current_medications: [],
      allergies: [],
      recent_labs: [],
      health_facts: [],
      conversation_count: 0,
    }),
  });
}

/**
 * Full-page auth UI with login and sign-up modes.
 *
 * Uses the dark navy (#0f172a) base palette.
 */
export default function AuthPage(): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginForm, setLoginForm] = useState<LoginForm>(EMPTY_LOGIN);
  const [signUpForm, setSignUpForm] = useState<SignUpForm>(EMPTY_SIGNUP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = useCallback((next: AuthMode): void => {
    setMode(next);
    setError(null);
  }, []);

  const handleLogin = useCallback(async (): Promise<void> => {
    setError(null);
    if (!loginForm.email.trim() || !loginForm.password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await signIn(loginForm.email.trim(), loginForm.password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loginForm, router]);

  const handleSignUp = useCallback(async (): Promise<void> => {
    setError(null);
    if (!signUpForm.display_name.trim()) { setError('Please enter your name.'); return; }
    if (!signUpForm.email.trim()) { setError('Please enter your email address.'); return; }
    if (!signUpForm.date_of_birth) { setError('Please enter your date of birth.'); return; }
    if (signUpForm.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (signUpForm.password !== signUpForm.confirm_password) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const user = await signUp(signUpForm.email.trim(), signUpForm.password, {
        display_name: signUpForm.display_name.trim(),
        phone: signUpForm.phone.trim(),
        date_of_birth: signUpForm.date_of_birth,
      });
      await createInitialProfile(user.id, signUpForm.display_name.trim());
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [signUpForm, router]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !loading) {
      if (mode === 'login') void handleLogin();
      else void handleSignUp();
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at center, #071e3d, #04090f)' }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 600, borderRadius: '50%', background: 'rgba(14,165,233,0.12)', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(6,182,212,0.08)', filter: 'blur(100px)' }} />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #0369a1, #0f4c75)', boxShadow: '0 0 20px rgba(56,189,248,0.25), 0 8px 32px rgba(3,105,161,0.4)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <polyline
                points="3,20 9,10 15,15 21,6 25,9"
                stroke="white"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Sana Help</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Your AI health co-pilot</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0d2440, #071526, #050e1c)', border: '1px solid rgba(56,189,248,0.18)', boxShadow: '0 4px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06)' }}
        >
          {/* Tab switcher */}
          <div className="flex" style={{ borderBottom: '1px solid rgba(56,189,248,0.12)' }}>
            <button
              className="flex-1 py-4 text-sm font-semibold transition-colors"
              style={mode === 'login'
                ? { color: '#38bdf8', borderBottom: '2px solid #38bdf8' }
                : { color: 'rgba(255,255,255,0.4)' }}
              onClick={() => switchMode('login')}
            >
              Log In
            </button>
            <button
              className="flex-1 py-4 text-sm font-semibold transition-colors"
              style={mode === 'signup'
                ? { color: '#38bdf8', borderBottom: '2px solid #38bdf8' }
                : { color: 'rgba(255,255,255,0.4)' }}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <div className="p-8" onKeyDown={handleKeyDown}>
            {error && (
              <div
                className="mb-5 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
              >
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <LoginFormFields form={loginForm} onChange={setLoginForm} />
            ) : (
              <SignUpFormFields form={signUpForm} onChange={setSignUpForm} />
            )}

            <button
              className="btn-primary mt-6 w-full py-3.5 text-sm"
              onClick={mode === 'login' ? () => void handleLogin() : () => void handleSignUp()}
              disabled={loading}
            >
              {loading
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Log In' : 'Create Account')}
            </button>

            <p className="mt-5 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {mode === 'login' ? (
                <>
                  No account?{' '}
                  <button className="font-semibold hover:underline" style={{ color: '#38bdf8' }} onClick={() => switchMode('signup')}>
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button className="font-semibold hover:underline" style={{ color: '#38bdf8' }} onClick={() => switchMode('login')}>
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Sana Help is not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

interface LoginFormFieldsProps {
  form: LoginForm;
  onChange: (f: LoginForm) => void;
}

function LoginFormFields({ form, onChange }: LoginFormFieldsProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <DarkField label="Email" type="email" placeholder="you@example.com"
        value={form.email} onChange={(v) => onChange({ ...form, email: v })} autoComplete="email" />
      <DarkField label="Password" type="password" placeholder="Your password"
        value={form.password} onChange={(v) => onChange({ ...form, password: v })} autoComplete="current-password" />
    </div>
  );
}

interface SignUpFormFieldsProps {
  form: SignUpForm;
  onChange: (f: SignUpForm) => void;
}

function SignUpFormFields({ form, onChange }: SignUpFormFieldsProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <DarkField label="Full name" type="text" placeholder="Your name"
        value={form.display_name} onChange={(v) => onChange({ ...form, display_name: v })} autoComplete="name" />
      <DarkField label="Email" type="email" placeholder="you@example.com"
        value={form.email} onChange={(v) => onChange({ ...form, email: v })} autoComplete="email" />
      <DarkField label="Phone number" type="tel" placeholder="+1 (555) 000-0000"
        value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} autoComplete="tel" />
      <DarkField label="Date of birth" type="date" placeholder=""
        value={form.date_of_birth} onChange={(v) => onChange({ ...form, date_of_birth: v })} autoComplete="bday" />
      <div className="grid grid-cols-2 gap-3">
        <DarkField label="Password" type="password" placeholder="Min. 8 chars"
          value={form.password} onChange={(v) => onChange({ ...form, password: v })} autoComplete="new-password" />
        <DarkField label="Confirm" type="password" placeholder="Repeat"
          value={form.confirm_password} onChange={(v) => onChange({ ...form, confirm_password: v })} autoComplete="new-password" />
      </div>
    </div>
  );
}

interface DarkFieldProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}

function DarkField({ label, type, placeholder, value, onChange, autoComplete }: DarkFieldProps): React.ReactElement {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-colors"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
    </div>
  );
}
