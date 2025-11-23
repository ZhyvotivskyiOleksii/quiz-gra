import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'
import { SettlementsClient } from '@/components/admin/settlements-client'

async function getSettlementRows() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('quiz_results')
      .select('id,status,prize_awarded,submitted_at,user_id,quizzes(title)')
      .order('submitted_at', { ascending: false })
      .limit(40)

    if (error) {
      // Table might not exist yet - return empty array silently
      return []
    }

    const rows = data || []
    const userIds = Array.from(
      new Set(
        rows
          .map((row) => row.user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    const profileMap = new Map<string, { id: string; display_name: string | null }>()
    if (userIds.length > 0) {
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id,display_name')
          .in('id', userIds)
        if (!profilesError && profiles) {
          ;(profiles || []).forEach((profile) => {
            if (profile?.id) profileMap.set(profile.id, profile as { id: string; display_name: string | null })
          })
        }
      } catch (err) {
        // Silently handle profile fetch errors
      }
    }
    return rows.map((row) => ({
      ...row,
      profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
    }))
  } catch (err) {
    // Table might not exist yet - return empty array silently
    return []
  }
}

export default async function SettlementsPage() {
  const rows = await getSettlementRows()

  return <SettlementsClient initialRows={rows} />
}
