import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FUTURE_KINDS } from '@/lib/settleFutureQuestions'

export type AdminSettlementRow = {
  id: string
  quiz_id: string | null
  status: string | null
  points: number | null
  prize_awarded: number | null
  submitted_at: string | null
  user_id: string | null
  quizzes?: { title: string | null } | null
  profile?: { id: string; display_name: string | null } | null
}

type ProfileRow = { id: string; display_name: string | null }

function ensureServiceClient(client?: SupabaseClient) {
  if (client) return client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('missing_supabase_service_credentials')
  }
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

export async function fetchSettlementRows(client?: SupabaseClient): Promise<AdminSettlementRow[]> {
  const supabase = ensureServiceClient(client)

  const { data, error } = await supabase
    .from('quiz_results')
    .select('id,quiz_id,status,points,prize_awarded,submitted_at,user_id,quizzes(title)')
    .order('submitted_at', { ascending: false })
    .limit(40)

  if (error) {
    const missingTable =
      (typeof error.code === 'string' && error.code === 'PGRST205') ||
      (typeof error.message === 'string' && error.message.includes('quiz_results'))
    if (!missingTable) throw error
    return []
  }

  const rows = (data || []) as AdminSettlementRow[]
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  )

  let profileMap = new Map<string, ProfileRow>()
  if (userIds.length > 0) {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id,display_name')
        .in('id', userIds)
      if (!profilesError && Array.isArray(profiles)) {
        profileMap = new Map((profiles as ProfileRow[]).map((profile) => [profile.id, profile]))
      }
    } catch {
      // Ignore profile fetch issues — rows will just render without display names.
    }
  }

  return rows.map((row) => ({
    ...row,
    profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
  }))
}

export type PendingSettlementTarget = {
  quiz_id: string
  quiz_title: string | null
  round_id: string
  round_label: string | null
  round_status: string | null
  deadline_at: string | null
  submissions: number
  future_pending: number
  future_total: number
}

export async function fetchPendingSettlementTargets(
  client?: SupabaseClient,
): Promise<PendingSettlementTarget[]> {
  const supabase = ensureServiceClient(client)
  const nowIso = new Date().toISOString()

  const { data: roundRows, error: roundsError } = await supabase
    .from('rounds')
    .select('id,label,deadline_at,status,quizzes(id,title)')
    .lte('deadline_at', nowIso)
    .neq('status', 'settled')
    .order('deadline_at', { ascending: false })

  if (roundsError) throw roundsError

  const pendingEntries: PendingSettlementTarget[] = []
  ;(roundRows || []).forEach((round) => {
    const quizzes = (round as any)?.quizzes as Array<{ id: string; title: string | null }> | null
    if (!quizzes?.length) return
    quizzes.forEach((quiz) => {
      pendingEntries.push({
        quiz_id: quiz.id,
        quiz_title: quiz.title ?? 'Quiz',
        round_id: round.id,
        round_label: (round as any)?.label ?? null,
        round_status: (round as any)?.status ?? null,
        deadline_at: (round as any)?.deadline_at ?? null,
        submissions: 0,
        future_pending: 0,
        future_total: 0,
      })
    })
  })

  if (!pendingEntries.length) return []

  const quizIds = pendingEntries.map((entry) => entry.quiz_id)
  const [futureQuestions, submissions] = await Promise.all([
    supabase
      .from('quiz_questions')
      .select('quiz_id, correct, kind')
      .in('quiz_id', quizIds)
      .in('kind', FUTURE_KINDS as any),
    supabase.from('quiz_submissions').select('quiz_id').in('quiz_id', quizIds),
  ])

  if (futureQuestions.error) throw futureQuestions.error
  if (submissions.error) throw submissions.error

  const futureMap = new Map<string, { total: number; pending: number }>()
  ;(futureQuestions.data || []).forEach((row) => {
    if (!row.quiz_id) return
    const entry = futureMap.get(row.quiz_id) ?? { total: 0, pending: 0 }
    entry.total += 1
    if (row.correct === null || row.correct === undefined) {
      entry.pending += 1
    }
    futureMap.set(row.quiz_id, entry)
  })

  const submissionsMap = new Map<string, number>()
  ;(submissions.data || []).forEach((row) => {
    if (!row.quiz_id) return
    submissionsMap.set(row.quiz_id, (submissionsMap.get(row.quiz_id) ?? 0) + 1)
  })

  return pendingEntries.map((entry) => {
    const future = futureMap.get(entry.quiz_id)
    return {
      ...entry,
      submissions: submissionsMap.get(entry.quiz_id) ?? 0,
      future_total: future?.total ?? 0,
      future_pending: future?.pending ?? 0,
    }
  })
}
