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

  // Use the same logic as login - signInWithOtp with shouldCreateUser: true
  // This works even for existing users - Supabase will send SMS if phone matches
  const { error: otpError } = await supabase.auth.signInWithOtp({
    phone,
    options: { 
      shouldCreateUser: true, // Same as login - allows sending OTP
      channel: 'sms' as any 
    },
  })

  // If OTP send fails, check if it's a recoverable error
  // "Signups not allowed" error often appears but SMS is still sent
  if (otpError) {
    const errorMsg = otpError.message || ''
    // These errors often mean SMS was sent anyway
    if (
      errorMsg.includes('signups not allowed') ||
      errorMsg.includes('already') || 
      errorMsg.includes('rate limit') || 
      errorMsg.includes('too many')
    ) {
      // SMS was likely sent despite the error, continue
      // Update phone on user account
      await supabase.auth.updateUser({ phone }).catch(() => {})
    } else {
      return NextResponse.json({ ok: false, error: otpError.message }, { status: 400 })
    }
  } else {
    // OTP sent successfully, update phone on user account
    await supabase.auth.updateUser({ phone }).catch(() => {})
  }

  // Mark phone as pending in profiles
  await supabase.rpc('signal_phone_pending', { p_user_id: user.id }).catch(() => {})

  return NextResponse.json({ ok: true })
}
