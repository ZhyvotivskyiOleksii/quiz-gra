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
    throw new Error(`ScoreBuster API error ${res.status}`)
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
