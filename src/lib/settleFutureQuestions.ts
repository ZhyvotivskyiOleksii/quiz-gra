import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  fetchLeagueResults,
  mapLeagueToApiId,
  type ScoreBusterMatch,
  fetchMatchStats,
  type ScoreBusterMatchStatMap,
  fetchMatchDetails,
} from '@/lib/footballApi'
import { eventTimestamp, normalizeTeamName } from '@/lib/matchUtils'

export const FUTURE_KINDS = ['future_1x2', 'future_score', 'future_yellow_cards', 'future_corners'] as const

type FutureKind = (typeof FUTURE_KINDS)[number]
type FutureStatKind = 'future_yellow_cards' | 'future_corners'

// Map question kind to stat key(s) - first match wins
const FUTURE_STAT_KEYS: Record<FutureStatKind, string[]> = {
  future_yellow_cards: ['yellow_cards', 'yellowcards', 'yellow cards', 'cards_yellow'],
  future_corners: ['corner', 'corners', 'corner_kicks', 'cornerkicks'],
}

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
  external_match_id: string | null
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

const statsCache = new Map<string, ScoreBusterMatchStatMap | null>()

export async function settleFutureQuestions(client?: SupabaseClient) {
  const supabase = client ?? createServiceClient()

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
    .select('id,round_id,home_team,away_team,kickoff_at,external_match_id')
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
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const { data: leagueRows, error: leagueErr } = await supabase
    .from('leagues')
    .select('id,name,code')
    .in('id', leagueIds)
  if (leagueErr) throw leagueErr
  const leagues = (leagueRows || []) as LeagueRow[]
  const leagueMap = new Map(leagues.map((l) => [l.id, l]))

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
      events: ScoreBusterMatch[]
    }
  >()

  let settledMatches = 0
  let settledQuestions = 0
  const skipped: string[] = []
  const now = Date.now()

  const pendingMatches = matches
    .map((match) => {
      const round = roundMap.get(match.round_id)
      const league = round?.league_id ? leagueMap.get(round.league_id) : null
      const apiId = league ? mapLeagueToApiId(league.name, league.code) : null
      if (!match.external_match_id && !apiId) return null
      return { match, apiId: apiId ?? null }
    })
    .filter((x): x is { match: MatchRow; apiId: string | null } => Boolean(x))

  const directMatches: MatchRow[] = []
  const fallbackMatches: { match: MatchRow; apiId: string }[] = []

  for (const entry of pendingMatches) {
    const match = entry.match
    const kickoff = match.kickoff_at ? new Date(match.kickoff_at).getTime() : null
    if (kickoff && kickoff > now) {
      skipped.push(`match_${match.id}_future`)
      continue
    }
    if (match.external_match_id) {
      directMatches.push(match)
    } else if (entry.apiId) {
      fallbackMatches.push({ match, apiId: entry.apiId })
    } else {
      skipped.push(`match_${match.id}_no_source`)
    }
  }

  for (const match of directMatches) {
    const externalId = match.external_match_id!
    let details = null
    try {
      details = await fetchMatchDetails(externalId)
    } catch (err) {
      console.error('match details fetch failed', externalId, err)
      skipped.push(`match_${match.id}_details_error`)
      continue
    }
    if (!details) {
      skipped.push(`match_${match.id}_details_missing`)
      continue
    }
    if (details.statusCategory !== 'finished') {
      skipped.push(`match_${match.id}_status_${details.statusId || 'pending'}`)
      continue
    }
    const homeScore = details.score.home
    const awayScore = details.score.away
    if (homeScore === null || awayScore === null) {
      skipped.push(`match_${match.id}_details_score_pending`)
      continue
    }
    const relatedQuestions = questionsByMatch.get(match.id) || []
    const result = await applySettlement({
      supabase,
      match,
      relatedQuestions,
      eventId: externalId,
      homeScore,
      awayScore,
      skipped,
    })
    if (result.success) {
      settledMatches += 1
      settledQuestions += result.settledCount
    }
  }

  for (const { match, apiId } of fallbackMatches) {
    if (!leagueBuckets.has(apiId)) {
      try {
        const events = await fetchLeagueResults(apiId)
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
    const kickoff = match.kickoff_at ? new Date(match.kickoff_at).getTime() : null
    const eventTs = eventTimestamp(found)
    if (kickoff && eventTs) {
      const delta = Math.abs(eventTs.getTime() - kickoff)
      if (delta > 1000 * 60 * 60 * 72) {
        skipped.push(`match_${match.id}_delta_exceeded`)
        continue
      }
    }
    const homeScore = parseScore(found.homeTeam.score)
    const awayScore = parseScore(found.awayTeam.score)
    if (homeScore === null || awayScore === null) {
      skipped.push(`match_${match.id}_score_pending`)
      continue
    }
    const relatedQuestions = questionsByMatch.get(match.id) || []
    const result = await applySettlement({
      supabase,
      match,
      relatedQuestions,
      eventId: found.id,
      homeScore,
      awayScore,
      skipped,
    })
    if (result.success) {
      settledMatches += 1
      settledQuestions += result.settledCount
    }
  }

  return { settledMatches, settledQuestions, skipped }
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('missing_supabase_config')
  return createClient(url, serviceKey)
}

function findMatchingEvent(events: ScoreBusterMatch[], match: MatchRow) {
  const home = normalizeTeamName(match.home_team)
  const away = normalizeTeamName(match.away_team)
  let best: { event: ScoreBusterMatch; delta: number } | null = null
  for (const event of events) {
    if (normalizeTeamName(event.homeTeam.name) !== home) continue
    if (normalizeTeamName(event.awayTeam.name) !== away) continue
    const eventTs = eventTimestamp(event)?.getTime() ?? 0
    const kickoff = match.kickoff_at ? new Date(match.kickoff_at).getTime() : 0
    const delta = Math.abs(eventTs - kickoff)
    if (!best || delta < best.delta) {
      best = { event, delta }
    }
  }
  return best?.event ?? null
}

function parseScore(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const num = Number(trimmed)
    return Number.isFinite(num) ? num : null
  }
  return null
}

function determineOutcomeSymbol(home: number, away: number) {
  if (home > away) return '1'
  if (home < away) return '2'
  return 'X'
}

function isFutureStatKind(kind: FutureKind): kind is FutureStatKind {
  return kind === 'future_yellow_cards' || kind === 'future_corners'
}

function extractStatTotal(stats: ScoreBusterMatchStatMap | null, keys: string[], debug?: string) {
  if (!stats) {
    if (debug) console.log(`[extractStatTotal] No stats object for ${debug}`)
    return null
  }
  // Log available keys for debugging
  if (debug) {
    console.log(`[extractStatTotal] ${debug} - looking for keys:`, keys, 'available:', Object.keys(stats))
  }
  // Try each key variant until we find a match
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_')
    const stat = stats[normalizedKey] || stats[key]
    if (stat) {
      const home = typeof stat.home === 'number' ? stat.home : 0
      const away = typeof stat.away === 'number' ? stat.away : 0
      const total = home + away
      if (debug) console.log(`[extractStatTotal] ${debug} - found ${key}: home=${home}, away=${away}, total=${total}`)
      return Number.isFinite(total) ? total : 0
    }
  }
  // If no stat found, we can't determine the result
  if (debug) console.log(`[extractStatTotal] ${debug} - no matching stat found`)
  return null
}

type ApplySettlementArgs = {
  supabase: SupabaseClient
  match: MatchRow
  relatedQuestions: PendingQuestion[]
  eventId?: string | null
  homeScore: number
  awayScore: number
  skipped: string[]
}

async function applySettlement({
  supabase,
  match,
  relatedQuestions,
  eventId,
  homeScore,
  awayScore,
  skipped,
}: ApplySettlementArgs): Promise<{ success: boolean; settledCount: number }> {
  const { error } = await supabase
    .from('matches')
    .update({ result_home: homeScore, result_away: awayScore, status: 'finished' })
    .eq('id', match.id)
  if (error) {
    skipped.push(`match_${match.id}_update_failed`)
    return { success: false, settledCount: 0 }
  }

  const needsStats = relatedQuestions.some((q) => isFutureStatKind(q.kind))
  const statEventId = needsStats ? eventId ?? null : null
  const statTotals = statEventId ? await getStatsForEvent(statEventId) : null

  let settledCount = 0
  for (const q of relatedQuestions) {
    let correctValue: any = null
    if (q.kind === 'future_score') {
      correctValue = { home: homeScore, away: awayScore }
    } else if (isFutureStatKind(q.kind)) {
      const statKeys = FUTURE_STAT_KEYS[q.kind]
      const statValue = statTotals ? extractStatTotal(statTotals, statKeys, `question_${q.id}`) : null
      if (statValue === null) {
        skipped.push(`question_${q.id}_stat_missing_${statKeys.join('|')}`)
        continue
      }
      correctValue = statValue
    } else {
      correctValue = determineOutcomeSymbol(homeScore, awayScore)
    }
    const { error: qErr } = await supabase.from('quiz_questions').update({ correct: correctValue }).eq('id', q.id)
    if (qErr) {
      skipped.push(`question_${q.id}_update_failed`)
      continue
    }
    settledCount += 1
  }

  await lockRoundIfSettled(supabase, match.round_id)
  return { success: true, settledCount }
}

async function getStatsForEvent(eventId: string): Promise<ScoreBusterMatchStatMap | null> {
  if (!eventId) return null
  if (!statsCache.has(eventId)) {
    try {
      console.log(`[getStatsForEvent] Fetching stats for event ${eventId}`)
      const stats = await fetchMatchStats(eventId)
      console.log(`[getStatsForEvent] Event ${eventId} stats:`, stats ? Object.keys(stats) : 'null')
      statsCache.set(eventId, stats)
    } catch (err) {
      console.error('[getStatsForEvent] fetch failed', eventId, err)
      statsCache.set(eventId, null)
    }
  }
  return statsCache.get(eventId) ?? null
}

async function lockRoundIfSettled(supabase: SupabaseClient, roundId: string) {
  const { count, error } = await supabase
    .from('quiz_questions')
    .select('id,quizzes!inner(round_id)', { count: 'exact', head: true })
    .eq('quizzes.round_id', roundId)
    .in('kind', FUTURE_KINDS as any)
    .is('correct', null)
  if (!error && (count ?? 0) === 0) {
    await supabase.from('rounds').update({ status: 'locked' }).eq('id', roundId)
  }
}
