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
  const phone = normalizePhone(phoneRaw)
  if (!phone || phone.length < 7) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
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

  // Ask Supabase to send confirmation SMS for the current user
  const { error: updateError } = await supabase.auth.updateUser({ phone })
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message || 'Nie udało się wysłać kodu.' }, { status: 400 })
  }

  const { error: pendingError } = await supabase.rpc('signal_phone_pending', { p_user_id: user.id })
  if (pendingError) {
    console.warn('signal_phone_pending failed', pendingError)
  }

  return NextResponse.json({ ok: true })
}
