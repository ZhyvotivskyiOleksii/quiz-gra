import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { settleFutureQuestions, FUTURE_KINDS } from '@/lib/settleFutureQuestions'

const DEFAULT_BUFFER_MINUTES = 10

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
  const secret = process.env.ADMIN_GRANT_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const summary = await autoSettle()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('auto-settle error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}

async function autoSettle() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('missing_supabase_config')

  const supabase = createClient(url, serviceKey)

  // 1) Обновляем правильные ответы для future-питаний
  await settleFutureQuestions(supabase)

  const bufferMinutes = Number(process.env.AUTO_SETTLE_BUFFER_MINUTES || DEFAULT_BUFFER_MINUTES)
  const threshold = new Date(Date.now() - bufferMinutes * 60 * 1000).toISOString()

  const { data: rounds, error: roundsErr } = await supabase
    .from('rounds')
    .select('id,status,deadline_at,quizzes!inner(id)')
    .lte('deadline_at', threshold)
    .neq('status', 'settled')
  if (roundsErr) throw roundsErr

  const targets = (rounds || []).flatMap((round) =>
    (round as any)?.quizzes?.map((quiz: { id: string }) => ({ quizId: quiz.id, roundId: round.id })) || [],
  )

  const settled: string[] = []
  const skipped: string[] = []

  for (const target of targets) {
    if (!target.quizId) continue
    const pending = await hasPendingFutureQuestions(supabase, target.quizId)
    if (pending) {
      skipped.push(`${target.quizId}:pending_future_questions`)
      continue
    }
    const { error: settleErr } = await supabase.rpc('settle_quiz', { p_quiz: target.quizId })
    if (settleErr) {
      skipped.push(`${target.quizId}:settle_failed:${settleErr.message}`)
      continue
    }
    settled.push(target.quizId)
    await supabase.from('rounds').update({ status: 'settled' }).eq('id', target.roundId)
  }

  return {
    bufferMinutes,
    attempted: targets.length,
    settled,
    skipped,
  }
}

async function hasPendingFutureQuestions(supabase: SupabaseClient, quizId: string) {
  const { count, error } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .in('kind', FUTURE_KINDS as any)
    .is('correct', null)
  if (error) throw error
  return (count ?? 0) > 0
}
