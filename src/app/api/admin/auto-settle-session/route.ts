import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { autoSettle } from '@/lib/autoSettle'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const envAdmins =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) || []
  const mail = (user.email || '').toLowerCase()
  const isEnvAdmin = mail && envAdmins.includes(mail)
  const isAdmin = Boolean(profile?.is_admin) || isEnvAdmin

  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: 'not_authorized' }, { status: 403 })
  }

  try {
    // Use service role client for autoSettle
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ ok: false, error: 'service_key_missing' }, { status: 500 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )

    const summary = await autoSettle({ supabase: serviceClient })
    return NextResponse.json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('auto-settle error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}

