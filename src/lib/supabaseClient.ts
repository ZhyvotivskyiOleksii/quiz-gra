import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Controls where Supabase stores the auth session
function getPreferredStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  const remember = window.localStorage.getItem('sb_remember') === '1'
  return remember ? window.localStorage : window.sessionStorage
}

export function setAuthPersistence(remember: boolean) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('sb_remember', remember ? '1' : '0')
    client = null // recreate on next getSupabase() with the chosen storage
  }
}

export function getSupabase() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.'
    )
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: getPreferredStorage(),
    },
  })
  return client
}
