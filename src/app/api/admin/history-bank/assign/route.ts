import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { buildHistoryQuestionFromEntry, type HistoryBankEntry, type GeneratedHistoryQuestion } from '@/lib/historyBank'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { quizId?: string; limit?: number }
  const quizId = (body?.quizId || '').toString()
  const limitRaw = Number(body?.limit ?? 3)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 10) : 3

  if (!quizId) {
    return NextResponse.json({ ok: false, error: 'missing_quiz_id' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 500 })
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove: (name: string, options: any) => {
        try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }) } catch {}
      },
    },
  })

  const { data: userRes } = await supabase.auth.getUser()
  const user = (userRes as any)?.user
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { data: bankRows, error: bankErr } = await supabase
    .from('history_question_bank')
    .select('id, match_identifier, template, home_team, away_team, home_score, away_score, played_at, status, league_code, source_kind')
    .eq('status', 'ready')
    .in('template', ['winner_1x2', 'total_goals'])
    .order('played_at', { ascending: false, nullsLast: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (bankErr) {
    return NextResponse.json({ ok: false, error: bankErr.message }, { status: 400 })
  }

  const entries = (bankRows || []) as HistoryBankEntry[]
  if (!entries.length) {
    return NextResponse.json({ ok: false, error: 'no_entries' }, { status: 400 })
  }

  const prepared = entries
    .map((entry) => {
      const question = buildHistoryQuestionFromEntry(entry)
      if (!question) return null
      return { entry, question }
    })
    .filter((item): item is { entry: HistoryBankEntry; question: GeneratedHistoryQuestion } => Boolean(item))

  if (!prepared.length) {
    return NextResponse.json({ ok: false, error: 'no_supported_templates' }, { status: 400 })
  }

  const { data: orderRows } = await supabase
    .from('quiz_questions')
    .select('order_index')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: false })
    .limit(1)
  const startIndex = (orderRows && orderRows[0] && typeof orderRows[0].order_index === 'number')
    ? orderRows[0].order_index
    : -1

  const rowsToInsert = prepared.map(({ question }, idx) => ({
    quiz_id: quizId,
    kind: question.kind,
    prompt: question.prompt,
    options: question.options,
    correct: question.correct,
    order_index: startIndex + idx + 1,
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from('quiz_questions')
    .insert(rowsToInsert as any)
    .select('id')

  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 })
  }

  const usedIds = prepared.map(({ entry }) => entry.id)
  if (usedIds.length) {
    await supabase
      .from('history_question_bank')
      .update({ status: 'used', used_in_quiz_id: quizId, used_at: new Date().toISOString() })
      .in('id', usedIds)
      .eq('status', 'ready')
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted?.length || rowsToInsert.length,
    usedBankEntries: usedIds,
  })
}
