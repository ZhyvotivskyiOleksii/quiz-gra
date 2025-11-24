import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, BrainCircuit, CalendarDays, CheckCircle2, Clock } from 'lucide-react'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
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

const EAGER_STAT_IMAGES = new Set(['/panel/2.png', '/panel/3.png'])

export default async function AppDashboard() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthLabel = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })

  let userResults: UserResultRow[] = []
  try {
    const { data: userResultsData, error: userResultsError } = await supabase
      .from('quiz_results')
      .select('points,total_correct,total_questions,submitted_at,quizzes(title,rounds(label))')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })

    if (!userResultsError) {
      userResults = (userResultsData as UserResultRow[] | null) || []
    }
  } catch (err) {
    userResults = []
  }

  const totalPoints = userResults.reduce((sum, row) => sum + (row.points ?? 0), 0)
  const weeklyPoints = userResults.reduce(
    (sum, row) => (row.submitted_at && new Date(row.submitted_at) >= weekAgo ? sum + (row.points ?? 0) : sum),
    0,
  )

  let submissions: Array<{ created_at: string | null }> = []
  try {
    const { data: submissionsData, error: submissionsError } = await supabase
      .from('quiz_submissions')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!submissionsError) {
      submissions = submissionsData || []
    }
  } catch (err) {
    submissions = []
  }
  const totalAttempts = submissions.length
  const weeklyAttempts = submissions.filter((s) => s.created_at && new Date(s.created_at) >= weekAgo).length
  const recentResults = userResults.slice(0, 4)

  let monthlyResults: MonthlyResultRow[] = []
  let monthlySubmissions: MonthlySubmissionRow[] = []
  
  try {
    const { data: monthlyResultsData, error: monthlyResultsError } = await supabase
      .from('quiz_results')
      .select('user_id,rank,prize_awarded')
      .gte('submitted_at', monthStart.toISOString())

    if (!monthlyResultsError) {
      monthlyResults = (monthlyResultsData as MonthlyResultRow[] | null) || []
    }
  } catch (err) {
    monthlyResults = []
  }

  try {
    const { data: monthlySubmissionsData, error: monthlySubmissionsError } = await supabase
      .from('quiz_submissions')
      .select('user_id')
      .gte('submitted_at', monthStart.toISOString())

    if (!monthlySubmissionsError) {
      monthlySubmissions = (monthlySubmissionsData as MonthlySubmissionRow[] | null) || []
    }
  } catch (err) {
    monthlySubmissions = []
  }

  const participantsSet = new Set<string>()
  ;(monthlySubmissions as MonthlySubmissionRow[]).forEach((row) => {
    if (!row?.user_id) return
    participantsSet.add(row.user_id)
  })

  const profileIds = new Set<string>()
  ;(monthlyResults as MonthlyResultRow[]).forEach((row) => {
    if (!row?.user_id) return
    profileIds.add(row.user_id)
  })

  const profileNameMap = new Map<string, string>()
  if (profileIds.size > 0) {
    try {
      const { data: profileRowsData, error: profileRowsError } = await supabase
        .from('profiles')
        .select('id,display_name')
        .in('id', Array.from(profileIds))

      if (!profileRowsError) {
        const profileRows = (profileRowsData as ProfileRow[] | null) || []
        profileRows.forEach((profile) => {
          if (profile?.id) profileNameMap.set(profile.id, profile.display_name?.trim() || '')
        })
      }
    } catch (err) {
      // Silently handle profile fetch errors
    }
  }

  const winsMap = new Map<
    string,
    {
      userId: string
      displayName: string
      wins: number
    }
  >()

  ;(monthlyResults as MonthlyResultRow[]).forEach((row) => {
    if (!row?.user_id) return
    const earnedPrize = row.prize_awarded && Number(row.prize_awarded) > 0
    const isRankWinner = row.rank === 1
    if (!earnedPrize && !isRankWinner) return
    const displayName = profileNameMap.get(row.user_id) || `Gracz ${row.user_id.slice(0, 6)}`
    const current = winsMap.get(row.user_id) || { userId: row.user_id, displayName, wins: 0 }
    current.wins += 1
    winsMap.set(row.user_id, current)
  })

  const allWinners = Array.from(winsMap.values())
  const sortedWinners = [...allWinners].sort((a, b) => b.wins - a.wins)
  const totalWins = sortedWinners.reduce((sum, row) => sum + row.wins, 0)
  const leaderboard = sortedWinners.slice(0, 10)
  const userRankPosition = sortedWinners.findIndex((row) => row.userId === user.id)
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

        <Card className="shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle>Na dziś</CardTitle>
            <CardDescription>Co możesz zrobić teraz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Przejdź szybki quiz z 6 pytań
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
              <CalendarDays className="h-4 w-4 text-primary" />
              Dodaj przypomnienie o codziennym wyzwaniu
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
              <Clock className="h-4 w-4 text-primary" />
              Zobacz prognozowane pytania oczekujące na wynik
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl shadow-black/10">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Ranking miesiąca</CardTitle>
            <CardDescription>Zwycięstwa w {monthLabel}</CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            Aktywni gracze: {participantsSet.size.toLocaleString('pl-PL')} • Łącznie zwycięstw: {totalWins.toLocaleString('pl-PL')}
          </div>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak zwycięstw w tym miesiącu. Bądź pierwszy!</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((row, index) => (
                <div key={row.userId} className="flex items-center justify-between rounded-lg border border-white/5 bg-card px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white/80">#{index + 1}</span>
                    <div>
                      <div className="font-medium text-white">{row.displayName}</div>
                      <div className="text-xs text-muted-foreground">Wygrane: {row.wins}</div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">{row.wins.toLocaleString('pl-PL')}</span>
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
  const isHeroImage = EAGER_STAT_IMAGES.has(card.img)
  return (
    <Card
      key={`${card.title}-${isMobile ? 'mobile' : 'desktop'}`}
      className={cn(
        'relative overflow-hidden shadow-xl shadow-black/10 transition-shadow hover:shadow-2xl bg-gradient-to-br from-white/5 to-transparent dark:from-white/10',
        isMobile ? 'min-w-[260px] flex-shrink-0 snap-center' : '',
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 flex items-end justify-end">
        <Image
          src={card.img}
          alt={card.alt}
          width={600}
          height={600}
          className="h-full w-auto opacity-95"
          priority={isHeroImage}
          loading={isHeroImage ? 'eager' : undefined}
        />
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
