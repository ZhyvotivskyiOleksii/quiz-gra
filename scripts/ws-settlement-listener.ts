import 'dotenv/config'
import WebSocket from 'ws'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { FUTURE_KINDS } from '@/lib/settleFutureQuestions'
import { autoSettle } from '@/lib/autoSettle'
import { fetchMatchDetails, type ScoreBusterStatusCategory } from '@/lib/footballApi'

const WS_URL = process.env.SCORE_WS_URL || 'wss://gateway.score-buster.test.royal-gambit.io/ws/events'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[ws-settlement] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const FINISHED_STATUS_IDS = new Set([
  6, 11, 13, 16, 24, 54, 59, 113, 190, 264, 265,
])

const MATCH_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 90_000
const WS_BUFFER_MINUTES = getWsBufferMinutes()

type ActiveMatch = {
  matchId: string
  eventId: number
}

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const activeMatches = new Map<number, ActiveMatch>()
let ws: WebSocket | null = null
let refreshTimer: NodeJS.Timeout | null = null
let heartbeatTimer: NodeJS.Timeout | null = null
let reconnectDelayMs = 2000
let lastHeartbeatAck = Date.now()

async function fetchPendingMatches(client: SupabaseClient) {
  const { data, error } = await client
    .from('quiz_questions')
    .select('match_id,matches!inner(id,external_match_id)')
    .in('kind', FUTURE_KINDS as any)
    .is('correct', null)
    .not('match_id', 'is', null)
  if (error) {
    console.error('[ws-settlement] Failed to fetch matches', error)
    return [] as ActiveMatch[]
  }
  const rows = (data || []) as any[]
  return rows
    .map((row) => {
      const ext = row.matches?.external_match_id
      if (!row.match_id || !ext) return null
      const eventId = Number(ext)
      if (!Number.isFinite(eventId)) return null
      return { matchId: row.match_id as string, eventId }
    })
    .filter((entry): entry is ActiveMatch => Boolean(entry))
}

function subscribe(wsInstance: WebSocket, eventId: number) {
  const payload = JSON.stringify({ action: 'subscribe', eventType: 'match_updates', eventId })
  wsInstance.send(payload)
  console.log(`[ws-settlement] Subscribed to event ${eventId}`)
}

async function refreshSubscriptions(wsInstance: WebSocket) {
  const pending = await fetchPendingMatches(serviceClient)
  const desiredIds = new Set<number>()
  pending.forEach((match) => {
    desiredIds.add(match.eventId)
    if (!activeMatches.has(match.eventId)) {
      activeMatches.set(match.eventId, match)
      subscribe(wsInstance, match.eventId)
    }
  })
  for (const eventId of [...activeMatches.keys()]) {
    if (!desiredIds.has(eventId)) {
      activeMatches.delete(eventId)
    }
  }
}

async function handleMessage(raw: WebSocket.RawData) {
  let payload: any
  try {
    payload = JSON.parse(raw.toString())
  } catch (err) {
    console.warn('[ws-settlement] Unable to parse message', raw.toString())
    return
  }

  if (payload?.type === 'pong' || payload?.action === 'pong' || raw.toString() === 'pong') {
    lastHeartbeatAck = Date.now()
    return
  }

  lastHeartbeatAck = Date.now()

  if (payload?.type !== 'updatedEventStatus') return
  const eventId = Number(payload.eventId)
  if (!activeMatches.has(eventId)) return

  const statusRaw = payload.statusTypeId ?? payload.statusId ?? payload.status
  const statusId = typeof statusRaw === 'string' ? parseInt(statusRaw, 10) : Number(statusRaw)
  if (!FINISHED_STATUS_IDS.has(statusId)) return

  const match = activeMatches.get(eventId)
  const matchId = match?.matchId
  if (!matchId) return

  console.log(`[ws-settlement] Event ${eventId} finished (status ${statusId}). Syncing match + settling quizzes...`)
  await syncMatchResult(matchId, eventId)
  try {
    const summary = await autoSettle({
      supabase: serviceClient,
      bufferMinutes: WS_BUFFER_MINUTES,
    })
    console.log(
      '[ws-settlement] Auto-settle summary',
      JSON.stringify({ settled: summary.settled.length, skipped: summary.skipped.length }),
    )
  } catch (err) {
    console.error('[ws-settlement] Settlement failed', err)
  } finally {
    activeMatches.delete(eventId)
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      refreshSubscriptions(ws)
    }
  }, MATCH_REFRESH_INTERVAL_MS)
}

function start() {
  console.log('[ws-settlement] Connecting to', WS_URL)
  ws = new WebSocket(WS_URL)

  ws.on('open', async () => {
    console.log('[ws-settlement] Connected')
    lastHeartbeatAck = Date.now()
    reconnectDelayMs = 2000
    startHeartbeat()
    await refreshSubscriptions(ws!)
    scheduleRefresh()
  })

  ws.on('message', handleMessage)

  ws.on('close', (code) => {
    console.warn('[ws-settlement] Connection closed', code)
    if (refreshTimer) clearInterval(refreshTimer)
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    activeMatches.clear()
    const delay = reconnectDelayMs
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000)
    setTimeout(start, delay)
  })

  ws.on('error', (err) => {
    console.error('[ws-settlement] WebSocket error', err)
  })
}

start()

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const sinceAck = Date.now() - lastHeartbeatAck
    if (sinceAck > HEARTBEAT_TIMEOUT_MS) {
      console.warn('[ws-settlement] Heartbeat timeout, restarting connection...')
      ws.terminate()
      return
    }
    try {
      ws.send(JSON.stringify({ action: 'ping' }))
    } catch (err) {
      console.error('[ws-settlement] Failed to send heartbeat ping', err)
    }
  }, HEARTBEAT_INTERVAL_MS)
}

function getWsBufferMinutes() {
  const raw =
    process.env.WS_AUTO_SETTLE_BUFFER_MINUTES ??
    process.env.AUTO_SETTLE_BUFFER_MINUTES ??
    ''
  const parsed = Number(raw)
  if (Number.isFinite(parsed)) return parsed
  return 0
}

function mapStatusToDb(category: ScoreBusterStatusCategory): string {
  switch (category) {
    case 'finished':
      return 'finished'
    case 'in_progress':
      return 'live'
    case 'cancelled':
    case 'deleted':
      return 'cancelled'
    default:
      return 'scheduled'
  }
}

async function syncMatchResult(matchId: string, eventId: number) {
  try {
    const details = await fetchMatchDetails(String(eventId))
    if (!details) return
    const update: Record<string, any> = {
      status: mapStatusToDb(details.statusCategory),
    }
    if (details.score.home !== null) update.result_home = details.score.home
    if (details.score.away !== null) update.result_away = details.score.away
    await serviceClient.from('matches').update(update).eq('id', matchId)
  } catch (err) {
    console.error('[ws-settlement] Failed to sync match result', { matchId, eventId }, err)
  }
}
