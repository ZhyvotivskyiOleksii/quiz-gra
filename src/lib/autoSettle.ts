import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { settleFutureQuestions, FUTURE_KINDS } from '@/lib/settleFutureQuestions'

const DEFAULT_BUFFER_MINUTES = 10

export type AutoSettleSummary = {
  bufferMinutes: number
  attempted: number
  settled: string[]
  skipped: string[]
}

type AutoSettleOptions = {
  bufferMinutes?: number
  supabase?: SupabaseClient
}

type RoundWithQuiz = {
  id: string
  roundId?: string
  quizzes?: { id: string }[] | null
}

export async function autoSettle(options: AutoSettleOptions = {}): Promise<AutoSettleSummary> {
  const supabase = options.supabase ?? createServiceClient()
  const bufferMinutes = resolveBufferMinutes(options.bufferMinutes)

  await settleFutureQuestions(supabase)

  const threshold = new Date(Date.now() - bufferMinutes * 60 * 1000).toISOString()

  const { data: rounds, error: roundsErr } = await supabase
    .from('rounds')
    .select('id,status,deadline_at,quizzes!inner(id)')
    .lte('deadline_at', threshold)
    .neq('status', 'settled')
  if (roundsErr) throw roundsErr

  const targets =
    (rounds || []).flatMap((round) =>
      (round as RoundWithQuiz)?.quizzes?.map((quiz) => ({ quizId: quiz.id, roundId: round.id })) || [],
    ) ?? []

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

function resolveBufferMinutes(explicit?: number) {
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return explicit
  const envValue = Number(process.env.AUTO_SETTLE_BUFFER_MINUTES)
  if (Number.isFinite(envValue)) return envValue
  return DEFAULT_BUFFER_MINUTES
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('missing_supabase_config')
  }
  return createClient(url, serviceKey)
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
