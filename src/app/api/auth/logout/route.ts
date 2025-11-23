import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, type SupabaseCookieAdapter } from '@/lib/createServerSupabase'

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: 'server_not_configured' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const res = NextResponse.json({ ok: true })

  const cookieAdapter: SupabaseCookieAdapter = {
    get: (name: string) => cookieStore.get(name)?.value,
    getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    set: (name: string, value: string, options: any) => {
      try {
        res.cookies.set({ name, value, ...(options ?? {}) })
      } catch {}
    },
    remove: (name: string, options: any) => {
      try {
        res.cookies.set({ name, value: '', ...(options ?? {}), maxAge: 0 })
      } catch {}
    },
    setAll: (cookiesToSet) => {
      cookiesToSet?.forEach(({ name, value, options }) => {
        try {
          res.cookies.set({ name, value, ...(options ?? {}) })
        } catch {}
      })
    },
  }

  const supabase = await createServerSupabaseClient(cookieAdapter)

  try {
    await supabase.auth.signOut()
  } catch (e) {
    // Continue even if signOut fails - we still want to clear cookies
  }

  // Explicitly clear all Supabase auth cookies
  const cookieNames = [
    'sb-access-token',
    'sb-refresh-token',
    'sb-auth-token',
    'supabase-auth-token',
    'sb-auth-token-code-verifier',
    'sb-auth-token-state',
  ]
  
  // Get all cookies and clear Supabase-related ones
  cookieStore.getAll().forEach((cookie) => {
    const name = cookie.name.toLowerCase()
    if (name.includes('supabase') || name.includes('sb-') || name.startsWith('sb_')) {
      try {
        // Clear with multiple path options to ensure it's removed
        res.cookies.set({
          name: cookie.name,
          value: '',
          maxAge: 0,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
        // Also try with empty path
        res.cookies.set({
          name: cookie.name,
          value: '',
          maxAge: 0,
          path: '',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
      } catch {}
    }
  })

  // Also clear the specific cookie names with multiple path options
  cookieNames.forEach((name) => {
    try {
      // Clear with root path
      res.cookies.set({
        name,
        value: '',
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      // Also try with empty path
      res.cookies.set({
        name,
        value: '',
        maxAge: 0,
        path: '',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    } catch {}
  })

  return res
}
