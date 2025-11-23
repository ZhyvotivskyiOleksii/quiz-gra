import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import crypto from 'crypto'

// POST /api/admin/grant { code: string }
// Grants admin to the current authenticated user if code is valid.
// Code format: base64url(HMAC_SHA256(email, ADMIN_GRANT_SECRET))
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as any
  const code = String(body?.code || '')

  const supabase = await createServerSupabaseClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const secret = process.env.ADMIN_GRANT_SECRET || ''
  if (!secret) return NextResponse.json({ ok: false, error: 'server_not_configured' }, { status: 500 })

  const email = session.user.email.toLowerCase()
  const h = crypto.createHmac('sha256', secret).update(email).digest('base64url')

  // Constant-time compare
  const valid = crypto.timingSafeEqual(Buffer.from(h), Buffer.from(code))
  if (!valid) return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 403 })

  // Grant admin in profiles (safe via RLS admin policy if already admin, but here we do direct upsert)
  const { error } = await supabase.from('profiles').upsert({ id: session.user.id, is_admin: true } as any, { onConflict: 'id' } as any)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
