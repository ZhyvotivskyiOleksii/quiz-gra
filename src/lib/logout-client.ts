'use client'

import { getSupabase } from './supabaseClient'

export async function performClientLogout() {
  const supabase = getSupabase()

  await supabase.auth.signOut({ scope: 'global' } as any).catch(() => {})

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
    })
  } catch {}

  try {
    await fetch('/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ event: 'SIGNED_OUT' }),
    })
  } catch {}
}

