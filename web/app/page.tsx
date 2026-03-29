'use client';

/**
 * Home page — checks auth state, redirects to /auth if not signed in.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../lib/supabase';
import { fetchHealthProfile } from '../lib/api';
import { ChatInterface } from '../components/ChatInterface';

/**
 * Root page — auth guard then renders ChatInterface.
 *
 * Redirects unauthenticated users to /auth.
 * Redirects users with no health profile to /onboarding.
 * Passes the authenticated user ID into ChatInterface.
 */
export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        if (!user) { router.replace('/auth'); return; }
        const profile = await fetchHealthProfile(user.id);
        if (!profile) { router.replace('/onboarding'); return; }
        setUserId(user.id);
      })
      .catch(() => router.replace('/auth'))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking || !userId) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #071e3d, #04090f)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Sana Help...</p>
        </div>
      </div>
    );
  }

  return <ChatInterface userId={userId} />;
}
