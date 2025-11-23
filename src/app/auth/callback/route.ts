import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, type SupabaseCookieAdapter } from '@/lib/createServerSupabase'

// Minimal OAuth callback handler - exchanges the code and redirects back to the app
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const publicBase = process.env.NEXT_PUBLIC_SITE_URL || url.origin
  const redirectTarget = url.searchParams.get('from') || '/app'
  const redirectUrl = new URL(redirectTarget, publicBase)
  const response = NextResponse.redirect(redirectUrl)

  const cookieAdapter: SupabaseCookieAdapter = {
    get: (name: string) => req.cookies.get(name)?.value,
    getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
    set: (name: string, value: string, options: any) => {
      try {
        response.cookies.set({ name, value, ...(options ?? {}) })
      } catch {}
    },
    remove: (name: string, options: any) => {
      try {
        response.cookies.set({ name, value: '', ...(options ?? {}), maxAge: 0 })
      } catch {}
    },
    setAll: (cookiesToSet) => {
      cookiesToSet?.forEach(({ name, value, options }) => {
        try {
          response.cookies.set({ name, value, ...(options ?? {}) })
        } catch {}
      })
    },
  }

  const supabase = await createServerSupabaseClient(cookieAdapter)

  const code = url.searchParams.get('code')
  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(url.searchParams)
    } catch {
      // allow middleware to handle any invalid/expired codes
    }
  }

  return response
}

// Session sync endpoint - only syncs session to server cookies
// All redirect logic is handled by middleware
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  const syncAdapter: SupabaseCookieAdapter = {
    get: (name: string) => req.cookies.get(name)?.value,
    getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
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

  const supabase = await createServerSupabaseClient(syncAdapter)

  try {
    const body = await req.json().catch(() => ({})) as any
    const event = body?.event as string | undefined
    const session = body?.session as { access_token?: string; refresh_token?: string } | undefined

    // Handle sign out
    if (event === 'SIGNED_OUT' || !session?.access_token || !session?.refresh_token) {
      try { 
        await supabase.auth.signOut() 
      } catch {}
      return res
    }

    // Set session - this will automatically sync cookies via Supabase SSR
    await supabase.auth.setSession({
      access_token: session.access_token!,
      refresh_token: session.refresh_token!,
    })
    
    return res
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
