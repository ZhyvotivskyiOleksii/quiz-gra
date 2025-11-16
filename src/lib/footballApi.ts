const DEFAULT_API_KEY = '123'
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json'

export type TheSportsDbEvent = {
  idEvent: string
  strHomeTeam: string | null
  strAwayTeam: string | null
  strHomeTeamBadge?: string | null
  strAwayTeamBadge?: string | null
  intHomeScore?: string | null
  intAwayScore?: string | null
  strTimestamp?: string | null
  dateEvent?: string | null
  strTime?: string | null
  strLeague?: string | null
}

export type TheSportsDbSeason = {
  strSeason?: string | null
}

// Map our league names/codes to TheSportsDB league IDs
const LEAGUE_ID_MAP: Record<string, string> = {
  // Names used in UI / DB
  Bundesliga: '4331',
  Ekstraklasa: '4422',
  'La Liga': '4335',
  'Liga Mistrzów': '4480',
  'Champions League': '4480',
  'Premier League': '4328',
  'English Premier League': '4328',
  'Serie A': '4332',
  // Short codes (if you store codes in DB)
  BL: '4331',
  EKS: '4422',
  LL: '4335',
  CL: '4480',
  EPL: '4328',
  SA: '4332',
}

export function mapLeagueToApiId(name?: string | null, code?: string | null): string | null {
  const keyCandidates = [
    (name || '').trim(),
    (code || '').trim(),
  ].filter(Boolean) as string[]

  for (const k of keyCandidates) {
    const id = LEAGUE_ID_MAP[k]
    if (id) return id
  }
  return null
}

function getApiKey() {
  // Allow overriding via env, fallback to demo key from docs
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_THESPORTSDB_API_KEY) {
    return process.env.NEXT_PUBLIC_THESPORTSDB_API_KEY
  }
  return DEFAULT_API_KEY
}

async function callEndpoint(path: string): Promise<TheSportsDbEvent[]> {
  const apiKey = getApiKey()
  const url = `${BASE_URL}/${apiKey}/${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TheSportsDB error ${res.status}`)
  const json = await res.json()
  const events = (json?.events || []) as TheSportsDbEvent[]
  return events.filter((e) => e && e.idEvent && e.strHomeTeam && e.strAwayTeam)
}

async function callSeasonsEndpoint(path: string): Promise<TheSportsDbSeason[]> {
  const apiKey = getApiKey()
  const url = `${BASE_URL}/${apiKey}/${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TheSportsDB error ${res.status}`)
  const json = await res.json()
  return (json?.seasons || []) as TheSportsDbSeason[]
}

export async function fetchNextEvents(leagueApiId: string): Promise<TheSportsDbEvent[]> {
  return callEndpoint(`eventsnextleague.php?id=${encodeURIComponent(leagueApiId)}`)
}

export async function fetchPastEvents(leagueApiId: string): Promise<TheSportsDbEvent[]> {
  return callEndpoint(`eventspastleague.php?id=${encodeURIComponent(leagueApiId)}`)
}

export async function fetchSeasonEvents(leagueApiId: string, season: string): Promise<TheSportsDbEvent[]> {
  return callEndpoint(`eventsseason.php?id=${encodeURIComponent(leagueApiId)}&s=${encodeURIComponent(season)}`)
}

export async function fetchLeagueSeasons(leagueApiId: string): Promise<TheSportsDbSeason[]> {
  return callSeasonsEndpoint(`search_all_seasons.php?id=${encodeURIComponent(leagueApiId)}`)
}

export function toTinyBadge(url?: string | null): string | null {
  if (!url) return null
  if (url.includes('/tiny')) return url
  // TheSportsDB uses ...png/<size>, append /tiny when missing.
  if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp')) {
    return `${url}/tiny`
  }
  return url
}

// Fetch single team badge by name (used on play screen)
export async function fetchTeamBadge(teamName: string): Promise<string | null> {
  if (!teamName) return null
  const apiKey = getApiKey()
  const url = `${BASE_URL}/${apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json().catch(() => null as any)
  const badge = json?.teams?.[0]?.strBadge as string | undefined
  return badge ? toTinyBadge(badge) : null
}
