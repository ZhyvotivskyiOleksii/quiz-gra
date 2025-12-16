import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FUTURE_KINDS } from '@/lib/settleFutureQuestions'

type PendingQuestionRow = {
  id: string
  kind: string
  prompt: string | null
  quiz_id: string | null
  match_id: string | null
  matches?: {
    id: string
    external_match_id: string | null
    home_team: string | null
    away_team: string | null
    kickoff_at: string | null
  } | null
  quizzes?: {
    title: string | null
    rounds?: { label: string | null } | null
  } | null
}

type PendingSummary = {
  matchId: string | null
  externalMatchId: string | null
  homeTeam: string | null
  awayTeam: string | null
  kickoffAt: string | null
  quizTitles: Set<string>
  roundLabels: Set<string>
  questionIds: string[]
  questionKinds: Set<string>
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[pending-futures] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function fetchPendingQuestions(client: SupabaseClient) {
  const { data, error } = await client
    .from('quiz_questions')
    .select(
      `
        id,
        kind,
        prompt,
        quiz_id,
        match_id,
        matches!inner (
          id,
          external_match_id,
          home_team,
          away_team,
          kickoff_at
        ),
        quizzes (
          title,
          rounds (
            label
          )
        )
      `,
    )
    .in('kind', FUTURE_KINDS as any)
    .is('correct', null)
    .order('match_id')

  if (error) {
    console.error('[pending-futures] Failed to fetch questions:', error)
    process.exit(1)
  }

  return (data || []) as PendingQuestionRow[]
}

function summarize(rows: PendingQuestionRow[]): PendingSummary[] {
  if (!rows.length) return []

  const map = new Map<string, PendingSummary>()
  for (const row of rows) {
    const key = row.match_id ?? `question:${row.id}`
    const summary: PendingSummary =
      map.get(key) ??
      {
        matchId: row.match_id ?? null,
        externalMatchId: row.matches?.external_match_id ?? null,
        homeTeam: row.matches?.home_team ?? null,
        awayTeam: row.matches?.away_team ?? null,
        kickoffAt: row.matches?.kickoff_at ?? null,
        quizTitles: new Set<string>(),
        roundLabels: new Set<string>(),
        questionIds: [],
        questionKinds: new Set<string>(),
      }

    const quizTitle = row.quizzes?.title
    if (quizTitle) summary.quizTitles.add(quizTitle)
    const roundLabel = row.quizzes?.rounds?.label
    if (roundLabel) summary.roundLabels.add(roundLabel)

    summary.questionIds.push(row.id)
    summary.questionKinds.add(row.kind)

    map.set(key, summary)
  }

  return Array.from(map.values()).sort((a, b) => {
    const aKickoff = a.kickoffAt ? Date.parse(a.kickoffAt) : 0
    const bKickoff = b.kickoffAt ? Date.parse(b.kickoffAt) : 0
    return bKickoff - aKickoff
  })
}

async function main() {
  const client = getSupabaseClient()
  const rows = await fetchPendingQuestions(client)
  const summaries = summarize(rows)

  if (!summaries.length) {
    console.log('[pending-futures] No unresolved future questions 🎉')
    return
  }

  console.log(`[pending-futures] Found ${rows.length} pending questions across ${summaries.length} match/es.`)
  const table = summaries.map((entry) => ({
    match_id: entry.matchId ?? '—',
    external_id: entry.externalMatchId ?? '—',
    matchup: entry.homeTeam && entry.awayTeam ? `${entry.homeTeam} vs ${entry.awayTeam}` : '—',
    kickoff: entry.kickoffAt ?? '—',
    quizzes: Array.from(entry.quizTitles).join(', ') || '—',
    rounds: Array.from(entry.roundLabels).join(', ') || '—',
    pending_questions: entry.questionIds.length,
    kinds: Array.from(entry.questionKinds).join(', '),
  }))

  console.table(table)
}

main().catch((err) => {
  console.error('[pending-futures] Unexpected error', err)
  process.exit(1)
})
