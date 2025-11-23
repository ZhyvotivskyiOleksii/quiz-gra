import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Book, HelpCircle, Users, Zap } from 'lucide-react'
import { UsersActivityChart } from '@/components/admin/users-activity-chart'

type SubmissionRow = { id: string; submitted_at: string | null }
type LatestSubmissionRow = { id: string; submitted_at: string | null; quiz_id: string | null; user_id: string | null; quizzes?: { title?: string | null } | null }
type ProfileRow = { id: string; display_name?: string | null }

export default async function AdminDashboard() {
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      } as any,
    },
  )
  const {
    data: { session },
  } = await authClient.auth.getSession()
  if (!session) redirect('/login')

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    throw new Error('Missing service credentials for dashboard metrics')
  }
  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const now = new Date()
  const nowIso = now.toISOString()
  const hourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const monthAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixMonthsStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
  const sixMonthsIso = sixMonthsStart.toISOString()

  const [
    activeQuestionsRes,
    pendingRoundsRes,
    submissionsLastMonthRes,
    sessionsHourRes,
    submissionsSixMonthsRes,
    latestSubmissionsRes,
  ] = await Promise.all([
    serviceClient.from('quiz_questions').select('id', { count: 'exact', head: true }).is('correct', null),
    serviceClient
      .from('rounds')
      .select('id', { count: 'exact', head: true })
      .lte('deadline_at', nowIso)
      .neq('status', 'settled'),
    serviceClient.from('quiz_submissions').select('user_id').gte('submitted_at', monthAgoIso),
    serviceClient.from('quiz_submissions').select('id', { count: 'exact', head: true }).gte('submitted_at', hourAgoIso),
    serviceClient.from('quiz_submissions').select('submitted_at').gte('submitted_at', sixMonthsIso),
    serviceClient
      .from('quiz_submissions')
      .select('id,submitted_at,user_id,quiz_id,quizzes(title)')
      .order('submitted_at', { ascending: false })
      .limit(5),
  ])

  if (activeQuestionsRes.error) throw activeQuestionsRes.error
  if (pendingRoundsRes.error) throw pendingRoundsRes.error
  if (submissionsLastMonthRes.error) throw submissionsLastMonthRes.error
  if (sessionsHourRes.error) throw sessionsHourRes.error
  if (submissionsSixMonthsRes.error) throw submissionsSixMonthsRes.error
  if (latestSubmissionsRes.error) throw latestSubmissionsRes.error

  const activeQuestions = activeQuestionsRes.count ?? 0
  const pendingRounds = pendingRoundsRes.count ?? 0
  const submissionsLastMonthRows = (submissionsLastMonthRes.data || []) as { user_id: string | null }[]
  const activeUsers = new Set(submissionsLastMonthRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))).size
  const sessionsLastHour = sessionsHourRes.count ?? 0

  const recentSubmissionRows = (submissionsSixMonthsRes.data || []) as SubmissionRow[]
  const chartData = buildChartSeries(recentSubmissionRows, now)

  const latestSubmissionRows = (latestSubmissionsRes.data || []) as LatestSubmissionRow[]
  const latestUserIds = Array.from(
    new Set(latestSubmissionRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  )
  let profileMap = new Map<string, string>()
  if (latestUserIds.length > 0) {
    const { data: profileRows = [], error: profileErr } = await serviceClient
      .from('profiles')
      .select('id,display_name')
      .in('id', latestUserIds)
    if (profileErr) throw profileErr
    profileMap = new Map(
      (profileRows as ProfileRow[]).map((profile) => [profile.id, profile.display_name?.trim() || `Gracz ${profile.id.slice(0, 6)}`]),
    )
  }
  const latestActivities = latestSubmissionRows.map((row) => ({
    id: row.id,
    quizTitle: row.quizzes?.title || 'SuperGame',
    userLabel: row.user_id ? profileMap.get(row.user_id) || `Gracz ${row.user_id.slice(0, 6)}` : 'Anonim',
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
  }))

  const stats = [
    {
      title: 'Aktywne pytania',
      value: activeQuestions.toLocaleString('pl-PL'),
      description: 'Pytania bez rozstrzygnięcia',
      icon: HelpCircle,
    },
    {
      title: 'Do rozliczenia',
      value: pendingRounds.toLocaleString('pl-PL'),
      description: 'Rundy po deadlinie',
      icon: Book,
    },
    {
      title: 'Aktywni użytkownicy (30 dni)',
      value: activeUsers.toLocaleString('pl-PL'),
      description: 'Gracze z podejściami',
      icon: Users,
    },
    {
      title: 'Sesje w ostatniej godz.',
      value: sessionsLastHour.toLocaleString('pl-PL'),
      description: 'Zgłoszeń w 60 min',
      icon: Activity,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-headline font-extrabold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Podsumowanie quizów i aktywności w czasie rzeczywistym.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="border-white/10 bg-gradient-to-br from-white/10 to-transparent shadow-[0_20px_60px_rgba(3,2,12,0.45)]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5 text-white/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs text-white/60">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr),minmax(320px,0.8fr)]">
        <Card className="border-white/10 bg-white/5/70 shadow-[0_35px_90px_rgba(3,2,12,0.6)]">
          <CardHeader>
            <CardTitle className="text-white">Aktywność użytkowników</CardTitle>
            <CardDescription>Liczba podejść w ostatnich 6 miesiącach.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsersActivityChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/40 shadow-[0_25px_70px_rgba(3,2,12,0.5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Zap className="h-5 w-5 text-emerald-300" />
              Ostatnie aktywności
            </CardTitle>
            <CardDescription>Najświeższe zgłoszenia do quizów.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zgłoszeń do wyświetlenia.</p>
            ) : (
              latestActivities.map((activity) => (
                <div key={activity.id} className="rounded-2xl bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-white">{activity.quizTitle}</p>
                  <p className="text-xs text-white/60">
                    {activity.userLabel} •{' '}
                    {activity.submittedAt
                      ? new Intl.DateTimeFormat('pl-PL', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(activity.submittedAt)
                      : 'brak daty'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function buildChartSeries(rows: SubmissionRow[], now: Date) {
  const buckets: { label: string; year: number; month: number; value: number }[] = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    const label = dt.toLocaleDateString('pl-PL', { month: 'long' })
    buckets.push({ label, year: dt.getUTCFullYear(), month: dt.getUTCMonth(), value: 0 })
  }
  rows.forEach((row) => {
    if (!row.submitted_at) return
    const ts = new Date(row.submitted_at)
    const match = buckets.find((bucket) => bucket.year === ts.getUTCFullYear() && bucket.month === ts.getUTCMonth())
    if (match) match.value += 1
  })
  return buckets.map((bucket) => ({ month: bucket.label, desktop: bucket.value }))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
