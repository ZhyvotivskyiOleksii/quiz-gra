import 'dotenv/config'
import { fetchMatchDetails, fetchMatchStats } from '@/lib/footballApi'

function usage() {
  console.error('Usage: npm run scorebuster:match -- <eventId>')
  process.exit(1)
}

function formatScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : '—'
}

async function main() {
  const eventId = process.argv[2] || process.env.SCORE_EVENT_ID
  if (!eventId) usage()

  console.log(`[scorebuster] Fetching details for event ${eventId}...`)
  const details = await fetchMatchDetails(eventId)
  if (!details) {
    console.log('[scorebuster] Match not found.')
  } else {
    console.log('[scorebuster] Details:')
    console.table({
      event: details.id,
      statusId: details.statusId ?? '—',
      status: details.statusName ?? details.statusCategory,
      home: formatScore(details.score.home),
      away: formatScore(details.score.away),
    })
  }

  console.log('[scorebuster] Fetching stats...')
  const stats = await fetchMatchStats(eventId)
  if (!stats || Object.keys(stats).length === 0) {
    console.log('[scorebuster] No stats available.')
  } else {
    const statTable = Object.entries(stats).map(([name, values]) => ({
      stat: name,
      home: formatScore(values.home),
      away: formatScore(values.away),
      total:
        typeof values.home === 'number' && typeof values.away === 'number'
          ? values.home + values.away
          : '—',
    }))
    console.table(statTable)
  }
}

main().catch((err) => {
  console.error('[scorebuster] Failed to fetch match data', err)
  process.exit(1)
})
