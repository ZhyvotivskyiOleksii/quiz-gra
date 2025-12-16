const BASE_URL = 'https://gateway.score-buster.dev.royal-gambit.io'

type RawTeam = {
  id?: string | number | null
  name?: string | null
  score?: number | string | null
}

type RawMatch = {
  id?: string | number | null
  date?: string | null
  homeTeam?: RawTeam | null
  awayTeam?: RawTeam | null
}

type RawRound = {
  round?: string | null
  matches?: RawMatch[] | null
}

type RawMatchesResponse = {
  rounds?: RawRound[] | null
}

type RawStatValue = {
  home?: string | number | null
  away?: string | number | null
}

type RawStatEntry = {
  name?: string | null
  value?: RawStatValue | null
  typeId?: string | number | null
  group?: string | null
}

type RawStatGroup = {
  name?: string | null
  statistics?: RawStatEntry[] | null
}

// API can return either:
// 1. { stats: [{ name: "overall", statistics: [...] }] } - old format
// 2. [{ name: "yellow_cards", value: {...}, group: "other" }] - /stats/football format
type RawMatchStatsResponse = {
  stats?: RawStatGroup[] | null
} | RawStatEntry[]

type RawMatchDetailsResponse = {
  id?: string | number | null
  status?: {
    name?: string | null
    statusId?: string | number | null
  } | null
  score?: {
    home?: string | number | null
    away?: string | number | null
  } | null
}

export type ScoreBusterTeam = {
  id: string
  name: string
  score?: number | null
}

export type ScoreBusterMatch = {
  id: string
  leagueId: string
  round?: string | null
  kickoff: string
  homeTeam: ScoreBusterTeam
  awayTeam: ScoreBusterTeam
}

export type ScoreBusterStanding = {
  team: ScoreBusterTeam
  divisionMember: unknown[]
  overall: StandingSplit
  home: StandingSplit
  away: StandingSplit
}

type StandingSplit = {
  rank: number
  pointsScored: number
  pointsLost: number
  gamesLost: number
  gamesDraws: number
  gamesPlayed: number
  gamesWins: number
  points: number
  percentageWins: number
}

class ScoreBusterError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message ?? `ScoreBuster API error ${status}`)
    this.name = 'ScoreBusterError'
    this.status = status
  }
}

async function fetchJson<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, BASE_URL)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (typeof value === 'undefined' || value === null) return
    url.searchParams.set(key, String(value))
  })
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new ScoreBusterError(res.status, `ScoreBuster API error ${res.status}`)
  }
  return (await res.json()) as T
}

function toScore(value?: number | string | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

function normalizeTeam(raw?: RawTeam | null): ScoreBusterTeam | null {
  if (!raw?.name) return null
  const id =
    typeof raw.id === 'number' || typeof raw.id === 'string'
      ? String(raw.id)
      : raw.name
  return {
    id,
    name: raw.name,
    score: toScore(raw.score),
  }
}

function normalizeMatches(
  payload: RawMatchesResponse | undefined,
  leagueId: string,
): ScoreBusterMatch[] {
  const rounds = payload?.rounds || []
  const normalized: ScoreBusterMatch[] = []
  for (const round of rounds) {
    const matches = round?.matches || []
    for (const match of matches) {
      const id =
        typeof match?.id === 'number' || typeof match?.id === 'string'
          ? String(match.id)
          : null
      const kickoff = match?.date || null
      const home = normalizeTeam(match?.homeTeam)
      const away = normalizeTeam(match?.awayTeam)
      if (!id || !kickoff || !home || !away) continue
      normalized.push({
        id,
        leagueId,
        round: round?.round ?? null,
        kickoff,
        homeTeam: home,
        awayTeam: away,
      })
    }
  }
  return normalized
}

export async function fetchLeagueFixtures(
  leagueId: string,
): Promise<ScoreBusterMatch[]> {
  const payload = await fetchJson<RawMatchesResponse>(
    `/api/score/events/${leagueId}/fixtures`,
  )
  return normalizeMatches(payload, leagueId)
}

export async function fetchLeagueResults(
  leagueId: string,
): Promise<ScoreBusterMatch[]> {
  const payload = await fetchJson<RawMatchesResponse>(
    `/api/score/events/${leagueId}/results`,
  )
  return normalizeMatches(payload, leagueId)
}

type RawStandingsResponse = {
  ranking?: ScoreBusterStanding[] | null
}

export async function fetchLeagueStandings(
  leagueId: string,
  sportId = '1',
): Promise<ScoreBusterStanding[]> {
  const payload = await fetchJson<RawStandingsResponse>(
    `/api/score/leagues/${leagueId}/standings`,
    { sportId },
  )
  return (payload?.ranking || []) as ScoreBusterStanding[]
}

export type ScoreBusterMatchStatMap = Record<string, { home: number; away: number }>

function normalizeMatchStats(
  payload: RawMatchStatsResponse | null | undefined,
): ScoreBusterMatchStatMap | null {
  if (!payload) return null
  
  const stats: ScoreBusterMatchStatMap = {}
  
  // Format 2: flat array from /stats/football endpoint
  // [{ name: "yellow_cards", value: { home: "1", away: "1" }, group: "other" }]
  if (Array.isArray(payload)) {
    for (const stat of payload) {
      const statName = stat?.name?.toLowerCase()?.replace(/\s+/g, '_')
      if (!statName) continue
      const home = toScore(stat?.value?.home)
      const away = toScore(stat?.value?.away)
      // Allow 0 values - only skip if truly null/undefined
      if (home === null && away === null) continue
      stats[statName] = { home: home ?? 0, away: away ?? 0 }
    }
    if (Object.keys(stats).length) return stats
  }
  
  // Format 1: nested structure { stats: [{ name: "overall", statistics: [...] }] }
  const groups = (payload as { stats?: RawStatGroup[] | null })?.stats || []
  
  // Try "overall" group first
  const overall = groups.find((group) => group?.name?.toLowerCase() === 'overall')
  if (overall?.statistics?.length) {
    for (const stat of overall.statistics) {
      const statName = stat?.name?.toLowerCase()?.replace(/\s+/g, '_')
      if (!statName) continue
      const home = toScore(stat?.value?.home)
      const away = toScore(stat?.value?.away)
      if (home === null && away === null) continue
      stats[statName] = { home: home ?? 0, away: away ?? 0 }
    }
  }
  
  // Fallback: try all groups
  if (!Object.keys(stats).length) {
    for (const group of groups) {
      for (const stat of group?.statistics || []) {
        const statName = stat?.name?.toLowerCase()?.replace(/\s+/g, '_')
        if (!statName) continue
        const home = toScore(stat?.value?.home)
        const away = toScore(stat?.value?.away)
        if (home === null && away === null) continue
        stats[statName] = { home: home ?? 0, away: away ?? 0 }
      }
    }
  }
  
  return Object.keys(stats).length ? stats : null
}

export async function fetchMatchStats(eventId: string): Promise<ScoreBusterMatchStatMap | null> {
  if (!eventId) return null
  const endpoints = [
    `/api/score/events/${eventId}/stats/football`,
    `/api/score/events/${eventId}/stats`,
    `/api/score/matches/${eventId}/stats`,
  ]

  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<RawMatchStatsResponse>(endpoint)
      const stats = normalizeMatchStats(payload)
      if (stats) return stats
    } catch (err) {
      lastError = err
      if (
        endpoint.includes('/events/') &&
        err instanceof ScoreBusterError &&
        err.status === 404
      ) {
        continue
      }
      throw err
    }
  }

  if (lastError) {
    if (lastError instanceof ScoreBusterError && lastError.status === 404) {
      return null
    }
    throw lastError
  }
  return null
}

export type ScoreBusterStatusCategory =
  | 'not_started'
  | 'in_progress'
  | 'finished'
  | 'interrupted'
  | 'unknown'
  | 'cancelled'
  | 'deleted'

const SCORE_STATUS_MAP: Record<string, ScoreBusterStatusCategory> = {
  '1': 'not_started',
  '2': 'in_progress',
  '3': 'in_progress',
  '4': 'in_progress',
  '5': 'not_started',
  '6': 'finished',
  '7': 'in_progress',
  '8': 'in_progress',
  '9': 'in_progress',
  '10': 'in_progress',
  '11': 'finished',
  '12': 'interrupted',
  '13': 'finished',
  '14': 'in_progress',
  '15': 'in_progress',
  '16': 'finished',
  '17': 'interrupted',
  '18': 'unknown',
  '19': 'in_progress',
  '20': 'in_progress',
  '21': 'in_progress',
  '22': 'in_progress',
  '23': 'in_progress',
  '24': 'finished',
  '25': 'not_started',
  '26': 'in_progress',
  '30': 'in_progress',
  '31': 'in_progress',
  '36': 'in_progress',
  '37': 'in_progress',
  '38': 'in_progress',
  '41': 'in_progress',
  '45': 'in_progress',
  '49': 'unknown',
  '52': 'in_progress',
  '54': 'finished',
  '57': 'unknown',
  '58': 'unknown',
  '59': 'finished',
  '80': 'in_progress',
  '81': 'in_progress',
  '82': 'in_progress',
  '83': 'in_progress',
  '93': 'interrupted',
  '95': 'in_progress',
  '96': 'in_progress',
  '97': 'in_progress',
  '98': 'in_progress',
  '99': 'in_progress',
  '100': 'in_progress',
  '101': 'in_progress',
  '102': 'in_progress',
  '103': 'in_progress',
  '104': 'in_progress',
  '105': 'in_progress',
  '106': 'cancelled',
  '107': 'unknown',
  '113': 'finished',
  '139': 'in_progress',
  '158': 'deleted',
  '160': 'in_progress',
  '161': 'in_progress',
  '162': 'in_progress',
  '163': 'in_progress',
  '164': 'in_progress',
  '165': 'in_progress',
  '166': 'in_progress',
  '167': 'in_progress',
  '168': 'in_progress',
  '169': 'in_progress',
  '170': 'in_progress',
  '171': 'in_progress',
  '172': 'in_progress',
  '173': 'in_progress',
  '174': 'in_progress',
  '175': 'in_progress',
  '176': 'in_progress',
  '177': 'in_progress',
  '178': 'in_progress',
  '179': 'in_progress',
  '180': 'in_progress',
  '181': 'in_progress',
  '182': 'in_progress',
  '183': 'in_progress',
  '184': 'in_progress',
  '185': 'in_progress',
  '186': 'in_progress',
  '187': 'in_progress',
  '188': 'in_progress',
  '189': 'unknown',
  '190': 'finished',
  '192': 'in_progress',
  '193': 'in_progress',
  '194': 'in_progress',
  '195': 'in_progress',
  '196': 'in_progress',
  '197': 'in_progress',
  '198': 'in_progress',
  '199': 'in_progress',
  '200': 'in_progress',
  '204': 'in_progress',
  '205': 'in_progress',
  '206': 'not_started',
  '207': 'in_progress',
  '208': 'in_progress',
  '209': 'in_progress',
  '210': 'in_progress',
  '211': 'in_progress',
  '212': 'interrupted',
  '213': 'interrupted',
  '214': 'interrupted',
  '215': 'interrupted',
  '216': 'interrupted',
  '217': 'interrupted',
  '218': 'in_progress',
}

export function mapScoreStatus(statusId?: string | number | null): ScoreBusterStatusCategory {
  if (typeof statusId === 'number') {
    return SCORE_STATUS_MAP[String(statusId)] ?? 'unknown'
  }
  if (typeof statusId === 'string' && statusId.trim()) {
    return SCORE_STATUS_MAP[statusId.trim()] ?? 'unknown'
  }
  return 'unknown'
}

export type ScoreBusterMatchDetails = {
  id: string
  statusId: string | null
  statusName: string | null
  statusCategory: ScoreBusterStatusCategory
  score: {
    home: number | null
    away: number | null
  }
}

export async function fetchMatchDetails(matchId: string): Promise<ScoreBusterMatchDetails | null> {
  if (!matchId) return null
  const payload = await fetchJson<RawMatchDetailsResponse>(`/api/score/matches/${matchId}/details`)
  const id = typeof payload?.id === 'number' || typeof payload?.id === 'string' ? String(payload.id) : String(matchId)
  const home = toScore(payload?.score?.home)
  const away = toScore(payload?.score?.away)
  const statusId =
    typeof payload?.status?.statusId === 'number' || typeof payload?.status?.statusId === 'string'
      ? String(payload.status.statusId)
      : null
  const statusName = payload?.status?.name ?? null
  return {
    id,
    statusId,
    statusName,
    statusCategory: mapScoreStatus(statusId),
    score: {
      home: home ?? null,
      away: away ?? null,
    },
  }
}

const LEAGUE_ID_MAP: Record<string, string> = {
  ekstraklasa: '899985',
  'pko ekstraklasa': '899985',
  'pko bp ekstraklasa': '899985',
  eks: '899985',
  'eks-pl': '899985',
  bundesliga: '899867',
  '1. bundesliga': '899867',
  bl: '899867',
  'la liga': '901074',
  laliga: '901074',
  ll: '901074',
  'liga mistrzów': '904988',
  'liga mistrzow': '904988',
  'champions league': '904988',
  'cl-league': '904988',
  'liga mistrzów faza 2': '904995',
  'champions league playoff': '904995',
  'liga mistrzów - play-off': '904995',
  'premier league': '900326',
  'english premier league': '900326',
  epl: '900326',
  'serie a': '899984',
  sa: '899984',
}

export function mapLeagueToApiId(
  name?: string | null,
  code?: string | null,
): string | null {
  const candidates = [name, code]
    .map((value) => (value || '').trim().toLowerCase())
    .filter(Boolean)
  for (const candidate of candidates) {
    const id = LEAGUE_ID_MAP[candidate]
    if (id) return id
  }
  return null
}

export function getTeamLogoUrl(
  teamId?: string | number | null,
  size: 'small' | 'medium' = 'small',
): string | null {
  if (teamId === null || typeof teamId === 'undefined') return null
  const id = String(teamId).trim()
  if (!id) return null
  return `${BASE_URL}/api/images/teams/${encodeURIComponent(
    id,
  )}/logo?size=${size}`
}
