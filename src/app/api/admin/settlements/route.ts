import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { createClient } from '@supabase/supabase-js'
import { fetchPendingSettlementTargets, fetchSettlementRows } from '@/lib/admin/fetchSettlements'
import { settleFutureQuestions } from '@/lib/settleFutureQuestions'
import { hasPendingFutureQuestions } from '@/lib/autoSettle'

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

  console.log('[Settle API] Starting settlement for quiz:', body.quizId)

  try {
    // Step 1: Try to auto-resolve future questions from Football API
    console.log('[Settle API] Step 1: Settling future questions...')
    const futureResult = await settleFutureQuestions(admin.serviceClient)
    console.log('[Settle API] Future questions result:', futureResult)

    // Step 2: Check if there are still pending future questions
    console.log('[Settle API] Step 2: Checking pending future questions...')
    const pending = await hasPendingFutureQuestions(admin.serviceClient, body.quizId)
    if (pending) {
      console.log('[Settle API] Quiz has pending future questions, cannot settle')
      return NextResponse.json(
        {
          ok: false,
          error: 'pending_future_questions',
          message: 'Nie wszystkie pytania future mają ustawione wyniki. Rozstrzygnij najpierw mecze.',
        },
        { status: 409 },
      )
    }

    // Step 3: Run the settlement RPC
    console.log('[Settle API] Step 3: Running settle_quiz RPC...')
    const { data, error } = await admin.serviceClient.rpc('settle_quiz', { p_quiz: body.quizId })
    if (error) {
      console.error('[Settle API] RPC error:', error)
      throw new Error(error.message || 'settle_failed')
    }
    
    console.log('[Settle API] Settlement complete:', data)
    return NextResponse.json({ ok: true, result: data })
  } catch (err: any) {
    console.error('[Settle API] Error:', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}
