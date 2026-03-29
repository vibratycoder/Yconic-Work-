/**
 * Test route to verify Supabase database connectivity.
 * GET /api/test — returns connection status and a sample query result.
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseClient();

  // Lightweight query: fetch current DB timestamp to confirm connectivity
  const { data, error } = await supabase.rpc('now').single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, db_time: data });
}
