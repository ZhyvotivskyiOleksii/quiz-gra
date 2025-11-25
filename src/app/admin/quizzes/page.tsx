import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { AdminQuizzesClient } from '@/components/admin/admin-quizzes-client'

export default async function AdminQuizzesPage() {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('rounds')
    .select(
      'id,label,status,deadline_at,leagues(name,code),matches(id,kickoff_at,status,result_home,result_away,home_team,away_team,home_team_external_id,away_team_external_id),quizzes(*)',
    )
    .order('deadline_at', { ascending: false })
    .limit(50)

  const items = (data || []).filter((r: any) => Array.isArray(r.quizzes) && r.quizzes.length > 0)

  return <AdminQuizzesClient initialItems={items} />
}
