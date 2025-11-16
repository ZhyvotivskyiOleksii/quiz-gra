import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPastEvents, mapLeagueToApiId, type TheSportsDbEvent } from '@/lib/footballApi'
import { eventTimestamp, normalizeTeamName } from '@/lib/matchUtils'

const FUTURE_KINDS = ['future_1x2', 'future_score'] as const
const MAX_EVENT_DELTA_MS = 1000 * 60 * 60 * 72 // 72h tolerance

type FutureKind = (typeof FUTURE_KINDS)[number]

type PendingQuestion = {
  id: string
  kind: FutureKind
  match_id: string
}

type MatchRow = {
  id: string
  round_id: string
  home_team: string | null
  away_team: string | null
  kickoff_at: string | null
}

type RoundRow = {
  id: string
  league_id: string | null
}

type LeagueRow = {
  id: string
  name: string | null
  code: string | null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
  const secret = process.env.ADMIN_GRANT_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const summary = await settleFutureQuestions()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('settle error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}

async function settleFutureQuestions() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('missing_supabase_config')

  const supabase = createClient(url, serviceKey)

  const { data: pendingQuestions, error: pendingErr } = await supabase
    .from('quiz_questions')
    .select('id,kind,match_id')
    .is('correct', null)
    .in('kind', FUTURE_KINDS as any)
    .not('match_id', 'is', null)
  if (pendingErr) throw pendingErr
  const questions = (pendingQuestions || []) as PendingQuestion[]
  if (!questions.length) return { settledMatches: 0, settledQuestions: 0, skipped: [] as string[] }

  const matchIds = Array.from(new Set(questions.map((q) => q.match_id)))
  const { data: matchRows, error: matchErr } = await supabase
    .from('matches')
    .select('id,round_id,home_team,away_team,kickoff_at')
    .in('id', matchIds)
  if (matchErr) throw matchErr
  const matches = (matchRows || []) as MatchRow[]
  if (!matches.length) return { settledMatches: 0, settledQuestions: 0, skipped: ['no_matches_found'] }

  const roundIds = Array.from(new Set(matches.map((m) => m.round_id)))
  const { data: roundRows, error: roundErr } = await supabase
    .from('rounds')
    .select('id,league_id')
    .in('id', roundIds)
  if (roundErr) throw roundErr
  const rounds = (roundRows || []) as RoundRow[]
  const roundMap = new Map(rounds.map((r) => [r.id, r]))

  const leagueIds = Array.from(
    new Set(
      rounds
        .map((r) => r.league_id)
        .filter((id): id is string => Boolean(id))
    )
  )
  const { data: leagueRows, error: leagueErr } = await supabase
    .from('leagues')
    .select('id,name,code')
    .in('id', leagueIds)
  if (leagueErr) throw leagueErr
  const leagues = (leagueRows || []) as LeagueRow[]
  const leagueMap = new Map(leagues.map((l) => [l.id, l]))

  const matchById = new Map(matches.map((m) => [m.id, m]))
  const questionsByMatch = new Map<string, PendingQuestion[]>()
  for (const q of questions) {
    const arr = questionsByMatch.get(q.match_id) || []
    arr.push(q)
    questionsByMatch.set(q.match_id, arr)
  }

  const leagueBuckets = new Map<
    string,
    {
      apiId: string
      events: TheSportsDbEvent[]
    }
  >()

  let settledMatches = 0
  let settledQuestions = 0
  const skipped: string[] = []

  const now = Date.now()

  const pendingMatches = matches
    .map((match) => {
      const round = roundMap.get(match.round_id)
      if (!round?.league_id) return null
      const league = leagueMap.get(round.league_id)
      if (!league) return null
      const apiId = mapLeagueToApiId(league.name, league.code)
      if (!apiId) return null
      return { match, apiId }
    })
    .filter((x): x is { match: MatchRow; apiId: string } => Boolean(x))

  for (const { match, apiId } of pendingMatches) {
    const kickoff = match.kickoff_at ? new Date(match.kickoff_at).getTime() : null
    if (kickoff && kickoff > now) {
      skipped.push(`match_${match.id}_future`)
      continue
    }

    if (!leagueBuckets.has(apiId)) {
      try {
        const events = await fetchPastEvents(apiId)
        leagueBuckets.set(apiId, { apiId, events })
      } catch (err) {
        console.error('events fetch failed', apiId, err)
        leagueBuckets.set(apiId, { apiId, events: [] })
      }
    }

    const bucket = leagueBuckets.get(apiId)!
    const found = findMatchingEvent(bucket.events, match)
    if (!found) {
      skipped.push(`match_${match.id}_no_event`)
      continue
    }

    const eventTs = eventTimestamp(found)
    if (kickoff && eventTs) {
      const delta = Math.abs(eventTs.getTime() - kickoff)
      if (delta > MAX_EVENT_DELTA_MS) {
        skipped.push(`match_${match.id}_delta_exceeded`)
        continue
      }
    }

    const homeScore = parseScore(found.intHomeScore)
    const awayScore = parseScore(found.intAwayScore)
    if (homeScore === null || awayScore === null) {
      skipped.push(`match_${match.id}_score_pending`)
      continue
    }

    const matchUpdate = await supabase
      .from('matches')
      .update({ result_home: homeScore, result_away: awayScore, status: 'finished' })
      .eq('id', match.id)
    if (matchUpdate.error) {
      skipped.push(`match_${match.id}_update_failed`)
      continue
    }

    const relatedQuestions = questionsByMatch.get(match.id) || []
    for (const q of relatedQuestions) {
      const correctValue =
        q.kind === 'future_score'
          ? { home: homeScore, away: awayScore }
          : determineOutcomeSymbol(homeScore, awayScore)
      const { error: qErr } = await supabase.from('quiz_questions').update({ correct: correctValue }).eq('id', q.id)
      if (qErr) {
        skipped.push(`question_${q.id}_update_failed`)
        continue
      }
      settledQuestions += 1
    }

    settledMatches += 1
  }

  return { settledMatches, settledQuestions, skipped }
}

function findMatchingEvent(events: TheSportsDbEvent[], match: MatchRow) {
  const home = normalizeTeamName(match.home_team)
  const away = normalizeTeamName(match.away_team)
  let best: { event: TheSportsDbEvent; delta: number } | null = null
  for (const event of events) {
    if (normalizeTeamName(event.strHomeTeam) !== home) continue
    if (normalizeTeamName(event.strAwayTeam) !== away) continue
    const eventTs = eventTimestamp(event)?.getTime() ?? 0
    const kickoff = match.kickoff_at ? new Date(match.kickoff_at).getTime() : 0
    const delta = Math.abs(eventTs - kickoff)
    if (!best || delta < best.delta) {
      best = { event, delta }
    }
  }
  return best?.event ?? null
}

function parseScore(value?: string | null) {
  if (value === null || typeof value === 'undefined') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function determineOutcomeSymbol(home: number, away: number) {
  if (home > away) return '1'
  if (home < away) return '2'
  return 'X'
}
