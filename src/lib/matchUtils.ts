import type { ScoreBusterMatch } from './footballApi'

export function normalizeTeamName(name?: string | null): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function matchKey(home?: string | null, away?: string | null, kickoff?: string | null) {
  const homeKey = normalizeTeamName(home)
  const awayKey = normalizeTeamName(away)
  const dateKey = kickoff ? new Date(kickoff).toISOString() : ''
  return `${homeKey}|${awayKey}|${dateKey}`
}

export function toKickoffIso(match: ScoreBusterMatch): string {
  const ts = eventTimestamp(match)
  if (ts) return ts.toISOString()
  return new Date().toISOString()
}

export function eventTimestamp(match: ScoreBusterMatch): Date | null {
  if (!match?.kickoff) return null
  const ts = new Date(match.kickoff)
  if (!Number.isNaN(ts.getTime())) return ts
  return null
}
