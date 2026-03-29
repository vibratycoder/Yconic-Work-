/**
 * Supabase browser client for the Pulse web app.
 * Singleton — safe to import anywhere on the client side.
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let _client: SupabaseClient | null = null;

/**
 * Return the singleton Supabase browser client.
 *
 * @returns Configured SupabaseClient instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}

/**
 * Get the currently authenticated user, or null if not signed in.
 *
 * @returns Supabase User object or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await getSupabaseClient().auth.getUser();
  return data.user;
}

/**
 * Sign in with email and password.
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Supabase User on success.
 * @throws Error with descriptive message on failure.
 */
export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign in failed — no user returned');
  return data.user;
}

/**
 * Create a new account with email, password, and profile metadata.
 *
 * @param email - User's email address
 * @param password - User's chosen password
 * @param metadata - Additional user info stored in auth.user_metadata
 * @returns Supabase User on success.
 * @throws Error with descriptive message on failure.
 */
export async function signUp(
  email: string,
  password: string,
  metadata: {
    display_name: string;
    phone: string;
    date_of_birth: string;
  },
): Promise<User> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign up failed — no user returned');
  return data.user;
}

/**
 * Sign out the current user and clear the session.
 */
export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}
