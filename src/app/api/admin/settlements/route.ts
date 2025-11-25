import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { createClient } from '@supabase/supabase-js'
import { fetchPendingSettlementTargets, fetchSettlementRows } from '@/lib/admin/fetchSettlements'

async function resolveAdminServiceClient() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  const envAdmins =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? []
  const mail = (user.email || '').toLowerCase()
  const isEnvAdmin = mail && envAdmins.includes(mail)
  const isAdmin = Boolean(profile?.is_admin) || isEnvAdmin

  if (!isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'not_authorized' }, { status: 403 }),
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'service_key_missing' }, { status: 500 }),
    }
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  return { ok: true as const, serviceClient }
}

export async function GET() {
  const admin = await resolveAdminServiceClient()
  if (!admin.ok) return admin.response

  try {
    const [rows, pending] = await Promise.all([
      fetchSettlementRows(admin.serviceClient),
      fetchPendingSettlementTargets(admin.serviceClient),
    ])
    return NextResponse.json({ ok: true, rows, pending })
  } catch (err: any) {
    console.error('settlements fetch error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await resolveAdminServiceClient()
  if (!admin.ok) return admin.response

  const body = (await req.json().catch(() => null)) as { quizId?: string } | null
  if (!body?.quizId) {
    return NextResponse.json({ ok: false, error: 'quiz_id_required' }, { status: 400 })
  }

  try {
    const { error } = await admin.serviceClient.rpc('settle_quiz', { p_quiz: body.quizId })
    if (error) {
      throw new Error(error.message || 'settle_failed')
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('manual settle error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}
