import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, BrainCircuit, Trophy } from 'lucide-react'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'

type UserResultRow = {
  points: number | null
  total_correct: number | null
  total_questions: number | null
  submitted_at: string | null
  quizzes?: { title?: string | null; rounds?: { label?: string | null } | null } | null
}

type MonthlyResultRow = {
  user_id: string | null
  rank: number | null
  prize_awarded?: number | null
  points?: number | null
}

type MonthlySubmissionRow = {
  user_id: string | null
}

type ProfileRow = {
  id: string | null
  display_name: string | null
}

type StatCard = {
  title: string
  value: string
  delta: string
  img: string
  alt: string
}

type PlayerStats = {
  userId: string
  displayName: string
  wins: number
  totalPoints: number
}

export default async function AppDashboard() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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
  } = await supabase.auth.getSession()
  if (!session) redirect('/?auth=login')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthLabel = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })

  const { data: userResults = [] } = (await supabase
    .from('quiz_results')
    .select('points,total_correct,total_questions,submitted_at,quizzes(title,rounds(label))')
    .eq('user_id', session.user.id)
    .order('submitted_at', { ascending: false })) as { data: UserResultRow[] }

  const totalPoints = userResults.reduce((sum, row) => sum + (row.points ?? 0), 0)
  const weeklyPoints = userResults.reduce(
    (sum, row) => (row.submitted_at && new Date(row.submitted_at) >= weekAgo ? sum + (row.points ?? 0) : sum),
    0,
  )

  const { data: submissions = [] } = await supabase
    .from('quiz_submissions')
    .select('created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  const totalAttempts = submissions.length
  const weeklyAttempts = submissions.filter((s) => s.created_at && new Date(s.created_at) >= weekAgo).length
  const recentResults = userResults.slice(0, 4)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: globalResults = [] } = await serviceSupabase
    .from('quiz_results')
    .select('user_id,rank,prize_awarded,points')

  const { data: allSubmissions = [] } = await serviceSupabase.from('quiz_submissions').select('user_id')

  const participantsSet = new Set<string>()
  ;(allSubmissions as MonthlySubmissionRow[]).forEach((row) => {
    if (!row?.user_id) return
    participantsSet.add(row.user_id)
  })

  const profileIds = new Set<string>()
  ;(globalResults as MonthlyResultRow[]).forEach((row) => {
    if (!row?.user_id) return
    profileIds.add(row.user_id)
  })

  const profileNameMap = new Map<string, string>()
  if (profileIds.size > 0) {
    const { data: profileRows = [] } = (await serviceSupabase
      .from('profiles')
      .select('id,display_name')
      .in('id', Array.from(profileIds))) as { data: ProfileRow[] }
    ;(profileRows || []).forEach((profile) => {
      if (profile?.id) profileNameMap.set(profile.id, profile.display_name?.trim() || '')
    })
  }

  const playerStatsMap = new Map<string, PlayerStats>()

  ;(globalResults as MonthlyResultRow[] | null)?.forEach((row) => {
    if (!row?.user_id) return
    const displayName = profileNameMap.get(row.user_id) || `Gracz ${row.user_id.slice(0, 6)}`
    const current =
      playerStatsMap.get(row.user_id) || ({ userId: row.user_id, displayName, wins: 0, totalPoints: 0 } as PlayerStats)
    current.totalPoints += row.points ?? 0
    if ((row.prize_awarded ?? 0) > 0 || row.rank === 1) {
      current.wins += 1
    }
    playerStatsMap.set(row.user_id, current)
  })

  const allPlayerStats = Array.from(playerStatsMap.values())
  const sortedPlayers = [...allPlayerStats].sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins)

  const totalWins = sortedPlayers.reduce((sum, row) => sum + row.wins, 0)
  const leaderboard = sortedPlayers.slice(0, 10)
  const topPlayers = sortedPlayers
  const userRankPosition = sortedPlayers.findIndex((row) => row.userId === session.user.id)
  const userRank = userRankPosition >= 0 ? userRankPosition + 1 : null

  const statCards = getStatCards(
    totalPoints,
    weeklyPoints,
    totalAttempts,
    weeklyAttempts,
    userRank,
    participantsSet.size,
  )

  return (
    <div className="mx-auto w-full max-w-full space-y-6 sm:max-w-[1100px] lg:max-w-[1200px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-extrabold">Panel</h1>
          <p className="text-sm text-muted-foreground">Przegląd Twojej aktywności w QuizTime</p>
        </div>
        <Button size="lg" className="w-full shadow-sm sm:w-auto" asChild>
          <Link href="/app/play">Rozpocznij szybki quiz <ArrowRight className="ml-2 h-5 w-5" /></Link>
        </Button>
      </div>

      <div className="space-y-4">
        <div className="-mx-3 sm:hidden">
          <div className="flex gap-3 overflow-x-auto px-3 pb-2 snap-x snap-mandatory scrollbar-none">
            {statCards.map((card) => renderStatCard(card, true))}
          </div>
        </div>
        <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => renderStatCard(card, false))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-xl shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ostatnie podejścia</CardTitle>
              <CardDescription>Twoje ostatnie odpowiedzi i status weryfikacji</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentResults.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nie masz jeszcze żadnych podejść. Zagraj w SuperGame i wróć tu później.
                </div>
              ) : (
                recentResults.map((result, idx) => {
                  const title = result.quizzes?.title || `Quiz #${idx + 1}`
                  const subtitle = result.quizzes?.rounds?.label
                    ? `${result.quizzes.rounds.label}${result.submitted_at ? ` • ${new Date(result.submitted_at).toLocaleDateString('pl-PL')}` : ''}`
                    : result.submitted_at
                      ? new Date(result.submitted_at).toLocaleDateString('pl-PL')
                      : ''
                  const scoreLabel = `${result.total_correct ?? 0}/${result.total_questions ?? 6}`
                  const badgeSuccess = (result.total_correct ?? 0) >= 5
                  return (
                    <div
                      key={`${title}-${result.submitted_at ?? idx}`}
                      className="flex flex-col gap-3 rounded-lg bg-card px-4 py-3 shadow-md shadow-black/10 transition-shadow hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <BrainCircuit className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-semibold leading-tight">{title}</div>
                          <div className="text-xs text-muted-foreground">{subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{scoreLabel}</span>
                        <span
                          className={cn(
                            'text-xs rounded-full px-2 py-1',
                            badgeSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-white/70',
                          )}
                        >
                          {badgeSuccess ? 'zaliczono' : 'weryfikacja'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-xl shadow-black/10 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-15">
            <Image
              src="/icon/eagle-mascot.webp"
              alt=""
              fill
              sizes="400px"
              className="object-cover"
            />
          </div>
          <CardHeader className="relative flex flex-col gap-1">
            <CardTitle>Top gracze</CardTitle>
            <CardDescription>Wszyscy, którzy grali w QuizTime</CardDescription>
          </CardHeader>
          <CardContent className="relative">
          {topPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wyników. Zagraj w SuperGame i zdobądź podium!</p>
            ) : (
              <div className="space-y-3">
                {topPlayers.slice(0, 5).map((player, index) => (
                  <div
                    key={player.userId}
                    className="relative overflow-hidden rounded-xl border border-white/5 bg-card/80 px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg"
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-20">
                      <Image
                        src="/icon/eagle-mascot.webp"
                        alt=""
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    </div>
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="font-medium leading-tight text-white">{player.displayName}</div>
                          <p className="text-xs text-muted-foreground">
                            Punkty: {player.totalPoints.toLocaleString('pl-PL')} • Wygrane: {player.wins.toLocaleString('pl-PL')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                        <Trophy className="h-4 w-4" /> {player.totalPoints.toLocaleString('pl-PL')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl shadow-black/10">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Ranking miesiąca</CardTitle>
            <CardDescription>Top 10 graczy w historii QuizTime</CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            Aktywni gracze: {participantsSet.size.toLocaleString('pl-PL')} • Łącznie zwycięstw: {totalWins.toLocaleString('pl-PL')}
          </div>
        </CardHeader>
        <CardContent>
          {allPlayerStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak aktywności w tym miesiącu. Zagraj pierwszy!</p>
          ) : (
            <div className="space-y-3">
              {allPlayerStats.slice(0, 10).map((row, index) => (
                <div key={row.userId} className="flex items-center justify-between rounded-lg border border-white/5 bg-card px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white/80">#{index + 1}</span>
                    <div>
                      <div className="font-medium text-white">{row.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        Punkty: {row.totalPoints.toLocaleString('pl-PL')} • Wygrane: {row.wins.toLocaleString('pl-PL')}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">{row.totalPoints.toLocaleString('pl-PL')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getStatCards(
  totalPoints: number,
  weeklyPoints: number,
  totalAttempts: number,
  weeklyAttempts: number,
  userRank: number | null,
  participants: number,
): StatCard[] {
  return [
    {
      title: 'Zdobyte punkty',
      value: totalPoints.toLocaleString('pl-PL'),
      delta: `+${weeklyPoints.toLocaleString('pl-PL')} w ostatnim tygodniu`,
      img: '/panel/1.png',
      alt: 'Punkty',
    },
    {
      title: 'Podejścia do quizów',
      value: totalAttempts.toLocaleString('pl-PL'),
      delta: weeklyAttempts > 0 ? `+${weeklyAttempts} w tym tygodniu` : 'Brak nowych w tym tygodniu',
      img: '/panel/2.png',
      alt: 'Próby',
    },
    {
      title: 'Pozycja w rankingu',
      value: userRank ? `#${userRank}` : '—',
      delta: userRank ? `wśród ${participants.toLocaleString('pl-PL')} graczy` : 'Zagraj, by pojawić się w rankingu',
      img: '/panel/3.png',
      alt: 'Ranking',
    },
  ]
}

function renderStatCard(card: StatCard, isMobile: boolean) {
  return (
    <Card
      key={`${card.title}-${isMobile ? 'mobile' : 'desktop'}`}
      className={cn(
        'relative overflow-hidden shadow-xl shadow-black/10 transition-shadow hover:shadow-2xl bg-gradient-to-br from-white/5 to-transparent dark:from-white/10',
        isMobile ? 'min-w-[260px] flex-shrink-0 snap-center' : '',
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 flex items-end justify-end">
        <Image src={card.img} alt={card.alt} width={600} height={600} className="h-full w-auto opacity-95" priority={false} />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{card.value}</div>
        <p className="text-xs text-muted-foreground">{card.delta}</p>
      </CardContent>
    </Card>
  )
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
