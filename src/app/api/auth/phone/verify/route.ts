import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function normalizePhone(input: string | null | undefined) {
  if (!input) return ''
  const trimmed = input.startsWith('+') ? input : `+${input}`
  return trimmed.replace(/[^\d+]/g, '')
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: 'server_not_configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const phoneRaw = typeof body?.phone === 'string' ? body.phone : ''
  const tokenRaw = typeof body?.code === 'string' ? body.code.trim() : ''
  const phone = normalizePhone(phoneRaw)
  if (!phone || phone.length < 7) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }
  if (!tokenRaw) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {}
      },
      remove: (name: string, options: any) => {
        try {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        } catch {}
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token: tokenRaw,
    type: 'phone_change' as any,
  })

  if (verifyError) {
    return NextResponse.json({ ok: false, error: verifyError.message }, { status: 400 })
  }

  const { error: confirmError } = await supabase.rpc('mark_phone_confirmed', { p_user_id: user.id, p_phone: phone })
  if (confirmError) {
    console.warn('mark_phone_confirmed failed', confirmError)
  }

  return NextResponse.json({ ok: true })
}
