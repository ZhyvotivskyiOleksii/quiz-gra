import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Book, HelpCircle, Users, Zap } from 'lucide-react'
import { UsersActivityChart } from '@/components/admin/users-activity-chart'
import { getTeamLogoUrl } from '@/lib/footballApi'
import Image from 'next/image'

type SubmissionRow = { id: string; submitted_at: string | null }
type LatestSubmissionRow = { 
  id: string
  submitted_at: string | null
  quiz_id: string | null
  user_id: string | null
  quizzes?: { 
    title?: string | null
    round_id?: string | null
  } | null 
}
type ProfileRow = { id: string; display_name?: string | null }

export default async function AdminDashboard() {
  const authClient = await createServerSupabaseClient()
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
    activeQuizzesRes,
    pendingRoundsRes,
    submissionsLastMonthRes,
    sessionsHourRes,
    submissionsSixMonthsRes,
    latestSubmissionsRes,
  ] = await Promise.all([
    serviceClient.from('quiz_questions').select('quiz_id').is('correct', null),
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
      .select('id,submitted_at,user_id,quiz_id,quizzes(title,round_id)')
      .order('submitted_at', { ascending: false })
      .limit(5),
  ])

  if (activeQuizzesRes.error) throw activeQuizzesRes.error
  if (pendingRoundsRes.error) throw pendingRoundsRes.error
  if (submissionsLastMonthRes.error) throw submissionsLastMonthRes.error
  if (sessionsHourRes.error) throw sessionsHourRes.error
  if (submissionsSixMonthsRes.error) throw submissionsSixMonthsRes.error
  if (latestSubmissionsRes.error) throw latestSubmissionsRes.error

  const activeQuizzesRows = (activeQuizzesRes.data || []) as { quiz_id: string | null }[]
  const activeQuizzes = new Set(activeQuizzesRows.map(r => r.quiz_id).filter((id): id is string => Boolean(id))).size
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
  const latestRoundIds = Array.from(
    new Set(latestSubmissionRows.map((row) => row.quizzes?.round_id).filter((id): id is string => Boolean(id))),
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
  
  // Fetch matches for rounds
  type MatchInfo = { home_team: string; away_team: string; home_team_external_id: string | null; away_team_external_id: string | null }
  let matchMap = new Map<string, MatchInfo>()
  if (latestRoundIds.length > 0) {
    const { data: matchRows = [] } = await serviceClient
      .from('matches')
      .select('round_id,home_team,away_team,home_team_external_id,away_team_external_id')
      .in('round_id', latestRoundIds)
    for (const m of matchRows as any[]) {
      if (m.round_id) {
        matchMap.set(m.round_id, {
          home_team: m.home_team || '',
          away_team: m.away_team || '',
          home_team_external_id: m.home_team_external_id,
          away_team_external_id: m.away_team_external_id,
        })
      }
    }
  }
  
  const latestActivities = latestSubmissionRows.map((row) => {
    const roundId = row.quizzes?.round_id
    const match = roundId ? matchMap.get(roundId) : null
    return {
      id: row.id,
      quizTitle: row.quizzes?.title || 'SuperGame',
      userLabel: row.user_id ? profileMap.get(row.user_id) || `Gracz ${row.user_id.slice(0, 6)}` : 'Anonim',
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      homeTeam: match?.home_team || null,
      awayTeam: match?.away_team || null,
      homeLogoUrl: match?.home_team_external_id ? getTeamLogoUrl(match.home_team_external_id) : null,
      awayLogoUrl: match?.away_team_external_id ? getTeamLogoUrl(match.away_team_external_id) : null,
    }
  })

  const stats = [
    {
      title: 'Aktywne quizy',
      value: activeQuizzes.toLocaleString('pl-PL'),
      description: 'Quizy oczekujące na wyniki',
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
        {stats.map((stat, index) => {
          const gradients = [
            'from-violet-500/20 to-purple-500/5',
            'from-blue-500/20 to-cyan-500/5',
            'from-emerald-500/20 to-teal-500/5',
            'from-primary/20 to-orange-500/5',
          ]
          const iconColors = [
            'text-violet-400',
            'text-blue-400',
            'text-emerald-400',
            'text-primary',
          ]
          return (
            <Card
              key={stat.title}
              className={`group relative overflow-hidden border-white/10 bg-gradient-to-br ${gradients[index]} backdrop-blur shadow-[0_20px_60px_rgba(3,2,12,0.45)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(3,2,12,0.55)]`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/80">{stat.title}</CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ${iconColors[index]}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <p className="text-xs text-white/50">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr),minmax(320px,0.8fr)]">
        <Card className="border-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 shadow-2xl backdrop-blur overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/30">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-white">Aktywność użytkowników</CardTitle>
                <CardDescription className="text-white/50">Liczba podejść w ostatnich 6 miesiącach</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <UsersActivityChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 shadow-2xl backdrop-blur">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-white">Ostatnie aktywności</CardTitle>
                <CardDescription className="text-white/50">Najświeższe zgłoszenia do quizów</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {latestActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center">
                <p className="text-sm text-white/50">Brak zgłoszeń do wyświetlenia</p>
              </div>
            ) : (
              latestActivities.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-all hover:bg-white/[0.05] hover:border-white/10"
                >
                  {index === 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                  )}
                  <div className="flex items-center gap-3">
                    {/* Team logos */}
                    {(activity.homeLogoUrl || activity.awayLogoUrl) && (
                      <div className="flex items-center gap-1 shrink-0">
                        {activity.homeLogoUrl && (
                          <div className="relative h-8 w-8 rounded-lg bg-white/10 p-1">
                            <Image
                              src={activity.homeLogoUrl}
                              alt=""
                              fill
                              className="object-contain p-0.5"
                              unoptimized
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-white/30 font-bold">VS</span>
                        {activity.awayLogoUrl && (
                          <div className="relative h-8 w-8 rounded-lg bg-white/10 p-1">
                            <Image
                              src={activity.awayLogoUrl}
                              alt=""
                              fill
                              className="object-contain p-0.5"
                              unoptimized
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{activity.quizTitle}</p>
                      {activity.homeTeam && activity.awayTeam && (
                        <p className="text-xs text-primary/80 truncate">
                          {activity.homeTeam} vs {activity.awayTeam}
                        </p>
                      )}
                      <p className="text-[11px] text-white/40">
                        {activity.userLabel} • {activity.submittedAt
                          ? new Intl.DateTimeFormat('pl-PL', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(activity.submittedAt)
                          : 'brak daty'}
                      </p>
                    </div>
                    
                    {/* New badge */}
                    {index === 0 && (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        NOWE
                      </span>
                    )}
                  </div>
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
