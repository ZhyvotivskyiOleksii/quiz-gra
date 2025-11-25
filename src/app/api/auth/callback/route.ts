import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })

  const supabase = createServerClient(projectUrl, anonKey, {
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        try {
          res.cookies.set({ name, value, ...options })
        } catch {
          // ignore
        }
      },
      remove: (name: string, options: any) => {
        try {
          res.cookies.set({ name, value: '', ...options, maxAge: 0 })
        } catch {
          // ignore
        }
      },
    },
  })

  try {
    const body = (await req.json().catch(() => ({}))) as any
    const event = body?.event as string | undefined
    const session = body?.session as
      | { access_token?: string; refresh_token?: string }
      | undefined

    if (event === 'SIGNED_OUT' || !session?.access_token || !session?.refresh_token) {
      try {
        await supabase.auth.signOut()
      } catch {
        //
      }
      return res
    }

    await supabase.auth.setSession({
      access_token: session.access_token!,
      refresh_token: session.refresh_token!,
    })

    // Optional marketing consent sync (mirrors legacy logic)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user && !user.user_metadata?.marketing_consent) {
        await supabase.auth.updateUser({ data: { marketing_consent: true } })
      }
    } catch {
      //
    }

    return res
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

