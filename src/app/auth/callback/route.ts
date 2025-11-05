import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  // Prepare a redirect response that we will reuse to ensure cookies are preserved
  // Prefer an explicitly configured public site URL to avoid wrong origins
  // when running behind a proxy or when Host headers are rewritten.
  const publicBase = process.env.NEXT_PUBLIC_SITE_URL || url.origin
  const to = new URL(url.searchParams.get('from') || '/app', publicBase)
  const res = NextResponse.redirect(to)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => { try { res.cookies.set({ name, value, ...options }) } catch {} },
        remove: (name: string, options: any) => { try { res.cookies.set({ name, value: '', ...options, maxAge: 0 }) } catch {} },
      },
    }
  )

  try {
    await supabase.auth.exchangeCodeForSession(url.searchParams)
  } catch {}

  // Optional: set default marketing consent
  try {
    const { data: userRes } = await supabase.auth.getUser()
    const user = (userRes as any)?.user
    if (user && !user?.user_metadata?.marketing_consent) {
      try { await supabase.auth.updateUser({ data: { marketing_consent: true } }) } catch {}
    }
  } catch {}

  return res
}

// Sync auth cookies for email/password or SMS flows
export async function POST(req: NextRequest) {
  // Always return the same Response instance we attach cookies to
  const res = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => { try { res.cookies.set({ name, value, ...options }) } catch {} },
        remove: (name: string, options: any) => { try { res.cookies.set({ name, value: '', ...options, maxAge: 0 }) } catch {} },
      },
    }
  )

  try {
    const body = await req.json().catch(() => ({})) as any
    const event = body?.event as string | undefined
    const session = body?.session as { access_token?: string; refresh_token?: string } | undefined

    if (event === 'SIGNED_OUT' || !session?.access_token || !session?.refresh_token) {
      try { await supabase.auth.signOut() } catch {}
      return res
    }

    await supabase.auth.setSession({
      access_token: session.access_token!,
      refresh_token: session.refresh_token!,
    })
    return res
  } catch {
    // Return the same response, but with an error code
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
