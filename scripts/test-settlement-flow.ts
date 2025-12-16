import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { settleFutureQuestions, FUTURE_KINDS } from '@/lib/settleFutureQuestions'
import { fetchMatchDetails, fetchMatchStats } from '@/lib/footballApi'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  console.log('=== Test Settlement Flow ===\n')

  // 1. Find all pending future questions
  console.log('1. Finding pending future questions...')
  const { data: pendingQuestions, error: pendingErr } = await supabase
    .from('quiz_questions')
    .select(`
      id,
      kind,
      correct,
      match_id,
      matches!inner(
        id,
        home_team,
        away_team,
        kickoff_at,
        external_match_id,
        status,
        result_home,
        result_away
      )
    `)
    .in('kind', FUTURE_KINDS as any)
    .not('match_id', 'is', null)
    .limit(20)
  
  if (pendingErr) {
    console.error('Error fetching questions:', pendingErr)
    return
  }

  console.log(`Found ${pendingQuestions?.length || 0} future questions\n`)

  // Group by status
  const byCorrect = {
    pending: pendingQuestions?.filter(q => q.correct === null) || [],
    resolved: pendingQuestions?.filter(q => q.correct !== null) || [],
  }
  
  console.log(`Pending (correct=null): ${byCorrect.pending.length}`)
  console.log(`Resolved: ${byCorrect.resolved.length}\n`)

  // 2. Check each pending question
  for (const q of byCorrect.pending) {
    const match = (q as any).matches
    console.log('---')
    console.log(`Question: ${q.id}`)
    console.log(`  Kind: ${q.kind}`)
    console.log(`  Match: ${match?.home_team} vs ${match?.away_team}`)
    console.log(`  Kickoff: ${match?.kickoff_at}`)
    console.log(`  External ID: ${match?.external_match_id}`)
    console.log(`  Match status: ${match?.status}`)
    console.log(`  Scores in DB: ${match?.result_home} - ${match?.result_away}`)

    if (match?.external_match_id) {
      // Check API for this match
      console.log(`\n  Checking API for event ${match.external_match_id}...`)
      
      try {
        const details = await fetchMatchDetails(match.external_match_id)
        if (details) {
          console.log(`    API Status: ${details.statusCategory} (ID: ${details.statusId})`)
          console.log(`    API Score: ${details.score.home} - ${details.score.away}`)
        } else {
          console.log('    API: No details found')
        }
      } catch (err) {
        console.log(`    API Details Error: ${err}`)
      }

      // Check stats if needed
      if (q.kind === 'future_yellow_cards' || q.kind === 'future_corners') {
        try {
          const stats = await fetchMatchStats(match.external_match_id)
          if (stats) {
            console.log(`    API Stats keys: ${Object.keys(stats).join(', ')}`)
            if (q.kind === 'future_yellow_cards') {
              const yc = stats['yellow_cards'] || stats['yellowcards'] || stats['cards_yellow']
              console.log(`    Yellow cards: ${yc ? `${yc.home} + ${yc.away} = ${yc.home + yc.away}` : 'NOT FOUND'}`)
            }
            if (q.kind === 'future_corners') {
              const c = stats['corner'] || stats['corners'] || stats['corner_kicks']
              console.log(`    Corners: ${c ? `${c.home} + ${c.away} = ${c.home + c.away}` : 'NOT FOUND'}`)
            }
          } else {
            console.log('    API Stats: null (no stats available)')
          }
        } catch (err) {
          console.log(`    API Stats Error: ${err}`)
        }
      }
    }
  }

  // 3. Test settlement
  console.log('\n\n=== Running settleFutureQuestions ===\n')
  const result = await settleFutureQuestions(supabase)
  console.log('Settlement result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)





