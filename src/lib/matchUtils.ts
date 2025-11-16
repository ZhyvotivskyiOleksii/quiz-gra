import type { TheSportsDbEvent } from './footballApi'

export function normalizeTeamName(name?: string | null): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function matchKey(home?: string | null, away?: string | null, kickoff?: string | null) {
  const homeKey = normalizeTeamName(home)
  const awayKey = normalizeTeamName(away)
  const dateKey = kickoff ? new Date(kickoff).toISOString() : ''
  return `${homeKey}|${awayKey}|${dateKey}`
}

export function toKickoffIso(event: TheSportsDbEvent): string {
  const ts = eventTimestamp(event)
  if (ts) return ts.toISOString()
  return new Date().toISOString()
}

export function eventTimestamp(event: TheSportsDbEvent): Date | null {
  if (event.strTimestamp) {
    const ts = new Date(event.strTimestamp)
    if (!Number.isNaN(ts.getTime())) return ts
  }
  if (event.dateEvent) {
    const time = event.strTime && event.strTime !== '' ? event.strTime : '12:00:00'
    const composed = new Date(`${event.dateEvent}T${time}Z`)
    if (!Number.isNaN(composed.getTime())) return composed
  }
  return null
}
