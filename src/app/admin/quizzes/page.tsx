import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { AdminQuizzesClient } from '@/components/admin/admin-quizzes-client'

export default async function AdminQuizzesPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  )

  const { data } = await supabase
    .from('rounds')
    .select('id,label,status,deadline_at,leagues(name,code),matches(id,kickoff_at,status,result_home,result_away),quizzes(*)')
    .order('deadline_at', { ascending: false })
    .limit(50)

  const items = (data || []).filter((r: any) => Array.isArray(r.quizzes) && r.quizzes.length > 0)

  return <AdminQuizzesClient initialItems={items} />
}
