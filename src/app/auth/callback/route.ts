import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  // Prepare redirect response first so Supabase can attach cookies onto it
  const redirectResponse = NextResponse.redirect(new URL('/app', req.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: false },
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: async (cookieList) => {
          cookieList.forEach(({ name, value, options }) => {
            try { redirectResponse.cookies.set({ name, value, ...options }) } catch {}
          })
        }
      } as any,
    }
  )

  try {
    await supabase.auth.exchangeCodeForSession(req.url)
  } catch {
    // ignore; if no code present, fall through to redirect
  }

  // After OAuth callback, ensure default marketing consent is set (best-effort)
  try {
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user as any
    const hasConsent = !!user?.user_metadata?.marketing_consent
    if (user && !hasConsent) {
      await supabase.auth.updateUser({ data: { marketing_consent: true } })
    }
  } catch {}

  return redirectResponse
}

// Sync auth cookies for email/password or SMS flows
export async function POST(req: NextRequest) {
  // Prepare JSON response first so Supabase can attach cookies onto it
  let res = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: false },
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: async (cookieList) => {
          cookieList.forEach(({ name, value, options }) => {
            try { res.cookies.set({ name, value, ...options }) } catch {}
          })
        }
      } as any,
    }
  )

  try {
    const body = await req.json().catch(() => ({})) as any
    const event = body?.event as string | undefined
    const session = body?.session as { access_token?: string; refresh_token?: string } | undefined

    if (event === 'SIGNED_OUT' || !session?.access_token || !session?.refresh_token) {
      try { await supabase.auth.signOut() } catch {}
      return NextResponse.json({ ok: true })
    }

    // Persist session cookies on the server for RSC routes
    await supabase.auth.setSession({
      access_token: session.access_token!,
      refresh_token: session.refresh_token!,
    })
    return res
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
