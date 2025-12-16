import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Target, Trophy, TrendingUp } from 'lucide-react'
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
  short_id: string | null
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
      .select('id,display_name,short_id')
      .in('id', Array.from(profileIds))) as { data: ProfileRow[] }
    ;(profileRows || []).forEach((profile) => {
      if (profile?.id) {
        const name = profile.display_name?.trim()
        const shortId = profile.short_id || profile.id.slice(0, 6)
        if (name) {
          const truncated = name.slice(0, 4) + '***'
          profileNameMap.set(profile.id, `${truncated} id ${shortId}`)
        } else {
          profileNameMap.set(profile.id, `Gracz id ${shortId}`)
        }
      }
    })
  }

  const playerStatsMap = new Map<string, PlayerStats>()

  ;(globalResults as MonthlyResultRow[] | null)?.forEach((row) => {
    if (!row?.user_id) return
    const displayName = profileNameMap.get(row.user_id) || `Gracz ${row.user_id.slice(0, 6)}`
    const current =
      playerStatsMap.get(row.user_id) ?? ({ userId: row.user_id, displayName, wins: 0, totalPoints: 0 } as PlayerStats)
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
        <Card className="lg:col-span-2 border-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 shadow-2xl backdrop-blur">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/30">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-white">Twoje wyniki</CardTitle>
                <CardDescription className="text-white/50">Historia gier i zdobyte punkty</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {recentResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-8 text-center">
                  <div className="mb-2 text-3xl">🎮</div>
                  <p className="text-sm text-white/60">Nie masz jeszcze żadnych podejść</p>
                  <p className="text-xs text-white/40">Zagraj w SuperGame i wróć tu później</p>
                </div>
              ) : (
                recentResults.map((result, idx) => {
                  const title = result.quizzes?.title || `Quiz #${idx + 1}`
                  const roundLabel = result.quizzes?.rounds?.label || ''
                  const dateLabel = result.submitted_at
                    ? new Date(result.submitted_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
                    : ''
                  const correct = result.total_correct ?? 0
                  const total = result.total_questions ?? 6
                  const percentage = Math.round((correct / total) * 100)
                  const isWin = correct >= 4
                  const isPerfect = correct === total
                  
                  return (
                    <div
                      key={`${title}-${result.submitted_at ?? idx}`}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.01]",
                        isPerfect
                          ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent"
                          : isWin
                            ? "border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        {/* Left: Match info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-bold text-sm",
                            isPerfect
                              ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                              : isWin
                                ? "bg-gradient-to-br from-primary to-orange-600 text-white shadow-lg shadow-primary/30"
                                : "bg-white/10 text-white/60"
                          )}>
                            {correct}/{total}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white truncate">{title}</span>
                              {isPerfect && <span className="text-xs">🏆</span>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                              <span>{roundLabel}</span>
                              {roundLabel && dateLabel && <span>•</span>}
                              <span>{dateLabel}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Right: Score bar + status */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Mini progress bar */}
                          <div className="hidden sm:flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isPerfect ? "bg-emerald-500" : isWin ? "bg-primary" : "bg-white/30"
                                )}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-medium w-8",
                              isPerfect ? "text-emerald-400" : isWin ? "text-primary" : "text-white/50"
                            )}>
                              {percentage}%
                            </span>
                          </div>
                          
                          {/* Status badge */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                              isPerfect
                                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                                : isWin
                                  ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                                  : "bg-white/10 text-white/50"
                            )}
                          >
                            {isPerfect ? '🎯 Perfect' : isWin ? '✓ Wygrana' : 'Ukończono'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Points earned indicator */}
                      {(result.points ?? 0) > 0 && (
                        <div className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-br from-yellow-500/20 to-amber-600/20 px-2 py-0.5">
                          <span className="text-[10px] font-bold text-yellow-400">+{result.points} pkt</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

  <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card shadow-[0_20px_50px_rgba(255,106,39,0.15)]">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <Image
              src="/icon/eagle-mascot.webp"
              alt=""
              fill
              sizes="400px"
              className="object-cover"
            />
          </div>
          <CardHeader className="relative flex flex-col gap-1 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold text-white">Top gracze</CardTitle>
            </div>
            <CardDescription>Wszyscy, którzy grali w QuizTime</CardDescription>
          </CardHeader>
          <CardContent className="relative pt-0">
          {topPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wyników. Zagraj w SuperGame i zdobądź podium!</p>
            ) : (
              <div className="space-y-2">
                {topPlayers.slice(0, 5).map((player, index) => {
                  const isTop3 = index < 3
                  const medalEmojis = ['🥇', '🥈', '🥉']
                  const medalColors = ['from-yellow-400 to-amber-600', 'from-slate-300 to-slate-500', 'from-orange-400 to-orange-700']
                  return (
                  <div
                    key={player.userId}
                    className={cn(
                      "relative overflow-hidden rounded-xl px-3 py-2.5 transition-all hover:scale-[1.02]",
                      isTop3 
                        ? "border border-primary/20 bg-gradient-to-r from-primary/15 via-card/90 to-card/80 shadow-lg shadow-primary/10" 
                        : "border border-white/5 bg-card/60"
                    )}
                  >
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex items-center justify-center rounded-full shadow-md",
                          isTop3 
                            ? `h-10 w-10 text-xl bg-gradient-to-br ${medalColors[index]} text-white shadow-lg` 
                            : "h-8 w-8 text-sm font-bold bg-white/10 text-white/70"
                        )}>
                          {isTop3 ? medalEmojis[index] : `#${index + 1}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={cn(
                            "font-semibold leading-tight truncate",
                            isTop3 ? "text-white" : "text-white/80"
                          )}>
                            {player.displayName}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {player.totalPoints.toLocaleString('pl-PL')} pkt • {player.wins} wyg.
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold border shadow-md",
                        index === 0 
                          ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/40 text-yellow-400 shadow-yellow-500/20" 
                          : index === 1
                            ? "bg-gradient-to-r from-slate-400/20 to-slate-300/20 border-slate-400/40 text-slate-300 shadow-slate-400/20"
                            : index === 2
                              ? "bg-gradient-to-r from-orange-500/20 to-orange-400/20 border-orange-500/40 text-orange-400 shadow-orange-500/20"
                              : "bg-white/5 border-white/10 text-white/60"
                      )}>
                        <Trophy className={cn(
                          "h-4 w-4",
                          index === 0 ? "text-yellow-400" : index === 1 ? "text-slate-300" : index === 2 ? "text-orange-400" : ""
                        )} />
                        {player.totalPoints.toLocaleString('pl-PL')}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 shadow-2xl backdrop-blur overflow-hidden">
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg shadow-yellow-500/30">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-white">Ranking graczy</CardTitle>
                <CardDescription className="text-white/50">Najlepsi w historii QuizTime</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5">
                <span className="text-white/40">Graczy:</span>
                <span className="font-semibold text-white">{participantsSet.size}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                <span className="text-primary/60">Zwycięstw:</span>
                <span className="font-semibold text-primary">{totalWins}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {allPlayerStats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-8 text-center">
              <div className="mb-2 text-3xl">🏆</div>
              <p className="text-sm text-white/60">Brak aktywności w tym miesiącu</p>
              <p className="text-xs text-white/40">Zagraj pierwszy i zdobądź #1!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allPlayerStats.slice(0, 10).map((row, index) => {
                const isTop3 = index < 3
                const medalEmojis = ['🥇', '🥈', '🥉']
                const medalGradients = [
                  'from-yellow-400 via-amber-500 to-yellow-600',
                  'from-slate-300 via-slate-400 to-slate-500',
                  'from-orange-400 via-amber-600 to-orange-700',
                ]
                
                return (
                  <div
                    key={row.userId}
                    className={cn(
                      "group relative flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300",
                      isTop3
                        ? "bg-gradient-to-r from-white/[0.08] to-transparent border border-white/10 hover:border-white/20"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank badge */}
                      <div className={cn(
                        "flex items-center justify-center rounded-xl font-bold shrink-0",
                        isTop3
                          ? `h-12 w-12 text-2xl bg-gradient-to-br ${medalGradients[index]} text-white shadow-lg`
                          : "h-10 w-10 text-sm bg-white/10 text-white/50"
                      )}>
                        {isTop3 ? medalEmojis[index] : `#${index + 1}`}
                      </div>
                      
                      {/* Player info */}
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          "font-semibold truncate",
                          isTop3 ? "text-white" : "text-white/80"
                        )}>
                          {row.displayName}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <span className="text-primary">●</span>
                            {row.totalPoints.toLocaleString('pl-PL')} pkt
                          </span>
                          <span className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            {row.wins} wyg.
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Points display */}
                    <div className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5",
                      isTop3 ? "bg-primary/20" : "bg-white/5"
                    )}>
                      <span className={cn(
                        "text-lg font-bold tabular-nums",
                        isTop3 ? "text-primary" : "text-white/60"
                      )}>
                        {row.totalPoints.toLocaleString('pl-PL')}
                      </span>
                      <span className="text-[10px] text-white/30 uppercase">pkt</span>
                    </div>
                  </div>
                )
              })}
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
