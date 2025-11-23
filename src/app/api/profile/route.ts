import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

type ProfilePayload = {
  firstName: string
  lastName: string
  contactEmail: string | null
  birthDate: string | null
  avatarUrl: string | null
}

const clamp = (value: string, max = 120) => value.slice(0, max)

function normalizeBody(body: any): ProfilePayload {
  const first = typeof body?.firstName === 'string' ? clamp(body.firstName.trim(), 120) : ''
  const last = typeof body?.lastName === 'string' ? clamp(body.lastName.trim(), 120) : ''
  const emailRaw = typeof body?.contactEmail === 'string' ? body.contactEmail.trim() : ''
  const avatarRaw = typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : ''
  const birthRaw = typeof body?.birthDate === 'string' ? body.birthDate.trim() : ''

  return {
    firstName: first,
    lastName: last,
    contactEmail: emailRaw.length ? emailRaw : null,
    avatarUrl: avatarRaw.length ? avatarRaw : null,
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthRaw) ? birthRaw : null,
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: 'server_not_configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const payload = normalizeBody(body)
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

  const resolvedAvatar = payload.avatarUrl ?? (user.user_metadata as any)?.avatar_url ?? null
  const metadata = {
    ...(user.user_metadata || {}),
    first_name: payload.firstName,
    last_name: payload.lastName,
    contact_email: payload.contactEmail,
    avatar_url: resolvedAvatar,
  }

  const needsPrimaryEmail = !user.email && payload.contactEmail
  const displayName = `${payload.firstName} ${payload.lastName}`.trim() || null
  const profileRow = {
    id: user.id,
    email: needsPrimaryEmail ? payload.contactEmail : user.email || null,
    display_name: displayName,
    birth_date: payload.birthDate,
    avatar_url: resolvedAvatar,
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error: adminErr } = await admin.auth.admin.updateUserById(user.id, {
      email: needsPrimaryEmail ? payload.contactEmail! : undefined,
      email_confirm: needsPrimaryEmail ? true : undefined,
      user_metadata: metadata,
    })
    if (adminErr) {
      return NextResponse.json({ ok: false, error: adminErr.message }, { status: 400 })
    }

    const { error: profileErr } = await admin
      .from('profiles')
      .upsert(profileRow as any, { onConflict: 'id' } as any)
    if (profileErr) {
      return NextResponse.json({ ok: false, error: profileErr.message }, { status: 400 })
    }
  } else {
    const { error: authErr } = await supabase.auth.updateUser({
      email: needsPrimaryEmail ? payload.contactEmail! : undefined,
      data: metadata,
    })
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 })
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(profileRow as any, { onConflict: 'id' } as any)
    if (profileErr) {
      return NextResponse.json({ ok: false, error: profileErr.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}
