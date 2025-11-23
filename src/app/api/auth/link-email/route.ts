import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { createClient } from '@supabase/supabase-js'

// POST /api/auth/link-email
// Body: { email: string; password?: string; firstName?: string; lastName?: string; marketingConsent?: boolean }
// Purpose: For users registered via phone OTP, set primary email (and password) on the same auth user
// so it appears in Supabase Auth → Users. Uses service role if available to confirm immediately.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as any
  const email: string = (body?.email || '').toString().trim()
  const password: string | undefined = typeof body?.password === 'string' && body.password.length > 0 ? body.password : undefined
  const firstName: string | undefined = typeof body?.firstName === 'string' ? body.firstName : undefined
  const lastName: string | undefined = typeof body?.lastName === 'string' ? body.lastName : undefined
  const marketingConsent: boolean = Boolean(body?.marketingConsent)

  if (!email) return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const rsc = await createServerSupabaseClient()

  const { data: userRes } = await rsc.auth.getUser()
  const me = (userRes as any)?.user
  if (!me?.id) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  
  // Get phone from session or user metadata
  const { data: sessionData } = await rsc.auth.getSession()
  const phoneFromSession = sessionData?.session?.user?.phone || me.phone || (me.user_metadata?.phone as string | undefined)

  // Critical: check if email already belongs to a different user
  // This prevents overwriting another user's data
  try {
    const { data: exists } = await rsc.rpc('email_exists', { p_email: email.toLowerCase() })
    if (exists === true) {
      // Check if this email belongs to the current user
      const currentEmail = me.email?.toLowerCase() || (me.user_metadata?.email as string | undefined)?.toLowerCase() || (me.user_metadata?.contact_email as string | undefined)?.toLowerCase()
      if (currentEmail !== email.toLowerCase()) {
        // Email belongs to a different user - reject
        return NextResponse.json({ ok: false, error: 'email_in_use' }, { status: 409 })
      }
    }
  } catch {}

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    // Use admin API to set email immediately (confirmed) and optionally password
    const admin = createClient(url, serviceKey)
    const { error: updErr } = await admin.auth.admin.updateUserById(me.id, {
      email,
      email_confirm: true,
      password,
      user_metadata: {
        ...(me.user_metadata || {}),
        first_name: firstName,
        last_name: lastName,
        marketing_consent: marketingConsent,
        contact_email: email,
      },
    })
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

    // Keep profiles row in sync - only update for current user, never overwrite other users
    try {
      const displayName = `${(firstName||'').trim()} ${(lastName||'').trim()}`.trim() || null
      await admin.from('profiles').upsert({
        id: me.id,
        email,
        display_name: displayName,
        // Also save phone if it exists
        phone: phoneFromSession || null,
      } as any, { 
        onConflict: 'id',
        // Only update if the row belongs to current user
        ignoreDuplicates: false
      } as any)
    } catch {}

    return NextResponse.json({ ok: true, method: 'admin' })
  }

  // Fallback without service key: request an email change (will require confirmation)
  // and set password if provided. Also update metadata and profiles under user session.
  const { error: upd1 } = await rsc.auth.updateUser({
    email,
    data: {
      ...(me.user_metadata || {}),
      first_name: firstName,
      last_name: lastName,
      marketing_consent: marketingConsent,
      contact_email: email,
    },
  })
  if (upd1) return NextResponse.json({ ok: false, error: upd1.message }, { status: 400 })

  if (password) {
    const { error: upd2 } = await rsc.auth.updateUser({ password })
    if (upd2) return NextResponse.json({ ok: false, error: upd2.message }, { status: 400 })
  }

  // Only update profiles for current user
  try {
    const displayName = `${(firstName||'').trim()} ${(lastName||'').trim()}`.trim() || null
    await rsc.from('profiles').upsert({ 
      id: me.id, 
      email, 
      display_name: displayName,
      // Also save phone if it exists
      phone: phoneFromSession || null,
    } as any, { 
      onConflict: 'id',
      // Ensure we only update the row that belongs to current user
      ignoreDuplicates: false
    } as any)
  } catch {}

  return NextResponse.json({ ok: true, method: 'user_update' })
}
