import Image from 'next/image'
import { Timer } from 'lucide-react'
import BonusInfoPanel, { BonusQuizSummary } from '@/components/app/bonus-info-panel'
import { redirect } from 'next/navigation'
import { QuizActionButton } from '@/components/app/quiz-action-button'
import { getTeamLogoUrl } from '@/lib/footballApi'
import { cn } from '@/lib/utils'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'

export default async function PlayPage() {
  // Load published quizzes for this view
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rounds } = await supabase
    .from('rounds')
    .select(
      'id,label,deadline_at,leagues(name,code),matches(id,kickoff_at,status,result_home,result_away,home_team,away_team,home_team_external_id,away_team_external_id),quizzes(*)',
    )
    .neq('status', 'draft')
    .order('deadline_at', { ascending: true })
    .limit(8)

  function formatTimeLeft(deadline?: string | null) {
    if (!deadline) return null
    try {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) return 'Zakończono'
      const m = Math.floor(diff / 60000)
      const d = Math.floor(m / (60*24))
      const h = Math.floor((m % (60*24)) / 60)
      const mm = m % 60
      if (d > 0) return `${d}d ${h}h ${mm}m`
      if (h > 0) return `${h}h ${mm}m`
      return `${mm}m`
    } catch { return null }
  }

  const items = (rounds || [])
    .filter((r:any) => {
      // must have at least one quiz attached and be within time window
      const hasQuiz = Array.isArray(r.quizzes) && r.quizzes.length > 0
      if (!hasQuiz) return false
      try { return new Date(r.deadline_at).getTime() > Date.now() } catch { return true }
    })

  const quizIds = items
    .map((r:any) => r.quizzes?.[0]?.id)
    .filter((id: string | undefined): id is string => Boolean(id))

  let prizeMap: Record<string, { correct_answers: number; pool: number }[]> = {}
  if (quizIds.length) {
    const { data: brackets } = await supabase
      .from('quiz_prize_brackets')
      .select('quiz_id,correct_answers,pool')
      .in('quiz_id', quizIds)
    prizeMap = (brackets || []).reduce((acc: Record<string, { correct_answers: number; pool: number }[]>, row) => {
      if (!row.quiz_id) return acc
      acc[row.quiz_id] = acc[row.quiz_id] || []
      acc[row.quiz_id].push({
        correct_answers: row.correct_answers ?? 0,
        pool: row.pool ?? 0,
      })
      acc[row.quiz_id].sort((a, b) => a.correct_answers - b.correct_answers)
      return acc
    }, {})
  }

  const quizSummaries: BonusQuizSummary[] = items
    .map((r: any) => {
      const quiz = r.quizzes?.[0]
      if (!quiz?.id) return null
      return {
        quizId: quiz.id,
        title: quiz.title || r.leagues?.name || 'Wiktoryna',
        label: r.label,
        prize: quiz.prize || 0,
        brackets: prizeMap[quiz.id] || [],
      }
    })
    .filter(Boolean) as BonusQuizSummary[]

  const submissionMap: Record<string, { submitted_at: string | null }> = {}
  if (user && quizIds.length) {
    const { data: submissions } = await supabase
      .from('quiz_submissions')
      .select('quiz_id,submitted_at')
      .eq('user_id', user.id)
      .in('quiz_id', quizIds)
    submissions?.forEach((s) => {
      if (s.quiz_id) submissionMap[s.quiz_id] = { submitted_at: s.submitted_at }
    })
  }

  // Phone info - check from user metadata (phone fields might not be accessible due to RLS)
  // Don't query phone fields from profiles table to avoid 400 errors
  const hasPhone =
    Boolean((user as any).phone) ||
    Boolean((user.user_metadata as any)?.phone)
  const phoneConfirmed = Boolean((user as any).phone_confirmed_at) || Boolean((user.user_metadata as any)?.phone_confirmed_at)
  const needsPhoneGate = !(hasPhone && phoneConfirmed)

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col space-y-6">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[300px] -translate-x-1/2 z-0">
        <Image
          src="/images/qv-img.svg"
          alt=""
          width={320}
          height={220}
          className="object-contain contrast-125 saturate-125 dark:brightness-150"
          style={{ opacity: 0.3 }}
          priority
        />
      </div>

      <div className="relative z-10 flex flex-1 gap-6 lg:grid lg:grid-cols-[minmax(0,1.75fr),minmax(360px,1fr)] lg:items-start">
        <div className="flex h-full flex-col gap-4">
          <div className="flex-none">
            <h1 className="font-headline font-extrabold uppercase text-4xl sm:text-5xl bg-clip-text text-transparent bg-gradient-to-b from-yellow-300 via-yellow-300 to-yellow-600 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
              TYPUJ I WYGRYWAJ
            </h1>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold uppercase text-white drop-shadow">ZA DARMO</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 lg:pr-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-[32px] border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/70">
                Brak aktywnych wiktoryн. Wróć wkrótce — nowe rundy pojawiają się regularnie.
              </div>
            ) : (
              <>
                {items.map((r: any) => {
              const q = r.quizzes?.[0] || {}
              const img = q.image_url || '/images/preview.webp'
              const prize = q.prize
              const deadlineTs = new Date(r.deadline_at).getTime()
              const matchKickoffs = Array.isArray(r.matches)
                ? r.matches
                    .map((m: any) => (m?.kickoff_at ? new Date(m.kickoff_at).getTime() : NaN))
                    .filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts))
                : []
              const earliestKickoff = matchKickoffs.length ? Math.min(...matchKickoffs) : null
              const now = Date.now()
              const kickoffSource = Number.isFinite(earliestKickoff ?? NaN) ? earliestKickoff! : deadlineTs
              const matchFinished = Array.isArray(r.matches)
                ? r.matches.some((m: any) => (m?.status || '').toLowerCase() === 'finished')
                : false
              const matchStarted = matchFinished
                ? true
                : Number.isFinite(earliestKickoff ?? NaN)
                  ? earliestKickoff! <= now
                  : false
              const isClosed = matchFinished || (Number.isFinite(deadlineTs) ? deadlineTs <= now : false)
              const hasSubmission = q.id ? Boolean(submissionMap[q.id]) : false
              const kickoffLabel = Number.isFinite(kickoffSource)
                ? new Date(kickoffSource).toLocaleString('pl-PL', {
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
              const startCountdown =
                !matchStarted && Number.isFinite(kickoffSource)
                  ? formatTimeLeft(new Date(kickoffSource).toISOString())
                  : null
              const fallbackDeadlineCountdown = !Number.isFinite(kickoffSource)
                ? formatTimeLeft(r.deadline_at)
                : null
              // Улучшенная логика статусов квизов
              let chipText = '—'
              if (matchFinished) {
                chipText = 'Mecz zakończony'
              } else if (matchStarted) {
                chipText = 'Mecz trwa'
              } else if (Number.isFinite(kickoffSource)) {
                const timeLeft = startCountdown
                if (timeLeft) {
                  chipText = `Start za: ${timeLeft}`
                } else {
                  const kickoffTime = new Date(kickoffSource).getTime()
                  const now = Date.now()
                  if (kickoffTime <= now) {
                    chipText = 'Mecz trwa'
                  } else {
                    chipText = 'Mecz wkrótce'
                  }
                }
              } else if (fallbackDeadlineCountdown) {
                chipText = `Koniec za: ${fallbackDeadlineCountdown}`
              } else if (r.deadline_at) {
                try {
                  const deadlineTime = new Date(r.deadline_at).getTime()
                  const now = Date.now()
                  if (deadlineTime > now) {
                    const diff = deadlineTime - now
                    const hours = Math.floor(diff / (1000 * 60 * 60))
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                    if (hours > 24) {
                      const days = Math.floor(hours / 24)
                      chipText = `Dostępne jeszcze ${days}d`
                    } else if (hours > 0) {
                      chipText = `Dostępne jeszcze ${hours}h ${minutes}m`
                    } else if (minutes > 0) {
                      chipText = `Dostępne jeszcze ${minutes}m`
                    } else {
                      chipText = 'Wkrótce zamknięte'
                    }
                  } else {
                    chipText = 'Zamknięte'
                  }
                } catch {
                  chipText = '—'
                }
              }
              const actionLabel = isClosed
                ? 'Zamknięte'
                : hasSubmission
                  ? 'Edytuj typy'
                  : 'Zagraj za darmo'
              const matchesForCard = Array.isArray(r.matches) ? r.matches.slice(0, 2) : []
              const extraMatches =
                Array.isArray(r.matches) && r.matches.length > matchesForCard.length
                  ? r.matches.length - matchesForCard.length
                  : 0
              return (
                <div key={r.id} className="group relative overflow-hidden rounded-[30px] sm:rounded-[34px] bg-gradient-to-r from-[#3a0d0d] via-[#5a0f0f] to-[#7a1313] p-0 shadow-xl">
                  <div className="flex">
                    <div className="relative w-[55%] min-h-[170px] sm:min-h-[210px] overflow-hidden rounded-[30px] sm:rounded-[34px]">
                      <Image src={img} alt="Quiz" fill className="object-cover scale-105 sm:scale-100" />
                      {/* chip */}
                      <div className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] px-2 py-1 flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5" /> {chipText}
                      </div>
                      {matchesForCard.length > 0 && (
                        <div className="absolute bottom-3 left-3 right-3 space-y-2 rounded-2xl border border-white/15 bg-black/35 px-3 py-2 backdrop-blur-md">
                          {matchesForCard.map((match: any) => (
                            <MatchVersusRow
                              key={match.id || `${match.home_team}-${match.away_team}-${match.kickoff_at}`}
                              homeName={match.home_team}
                              awayName={match.away_team}
                              homeLogo={getTeamLogoUrl(match.home_team_external_id, 'small')}
                              awayLogo={getTeamLogoUrl(match.away_team_external_id, 'small')}
                            />
                          ))}
                          {extraMatches > 0 && (
                            <div className="text-right text-[10px] font-semibold text-white/70">
                              +{extraMatches} dodatkowych spotkań
                            </div>
                          )}
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#7a1313] opacity-95"/>
                    </div>
                    <div className="relative flex-1 p-5 sm:p-6 flex flex-col justify-center items-end text-right">
                      {/* Soft gloss and vignette */}
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_70%_0%,rgba(255,255,255,0.06),transparent_40%)]" />
                      <div className="text-[11px] uppercase tracking-[0.12em] text-white/75">Runda {r.label}</div>
                      <div className="mt-1 text-3xl md:text-4xl font-headline font-extrabold text-white drop-shadow">{r.leagues?.name || 'Wiktoryna'}</div>
                      <div className="mt-2 text-xl sm:text-2xl font-extrabold text-yellow-300 drop-shadow">
                        {typeof prize === 'number' ? prize.toLocaleString('pl-PL') + ' zł' : ''}
                      </div>
                      <div className="mt-1 text-xs text-white/90">{kickoffLabel}</div>
                      <div className="mt-4 self-end">
                        {q.id && (
                          <QuizActionButton
                            quizId={q.id}
                            isClosed={isClosed}
                            hasSubmission={hasSubmission}
                            actionLabel={actionLabel}
                            needsPhone={needsPhoneGate}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:flex lg:h-full lg:flex-col lg:self-start">
          <div className="lg:sticky lg:top-0">
            {quizSummaries.length > 0 ? (
              <BonusInfoPanel quizzes={quizSummaries} />
            ) : (
              <div className="rounded-[32px] border border-white/10 bg-black/30 p-6 text-center text-sm text-white/70">
                Brak zdefiniowanych bonusów dla aktywnych rund.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type MatchVersusRowProps = {
  homeName?: string | null
  awayName?: string | null
  homeLogo?: string | null
  awayLogo?: string | null
}

function MatchVersusRow({ homeName, awayName, homeLogo, awayLogo }: MatchVersusRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90">
      <TeamBadge logo={homeLogo} name={homeName} />
      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/60">VS</span>
      <TeamBadge logo={awayLogo} name={awayName} align="right" />
    </div>
  )
}

function TeamBadge({
  logo,
  name,
  align = 'left',
}: {
  logo?: string | null
  name?: string | null
  align?: 'left' | 'right'
}) {
  const initials = getInitials(name)
  return (
    <div
      className={cn(
        'flex flex-1 items-center gap-2 rounded-full bg-black/20 px-2.5 py-1.5 backdrop-blur-sm',
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left',
      )}
    >
      {logo ? (
        <Image
          src={logo}
          alt={name || ''}
          width={28}
          height={28}
          className="h-7 w-7 rounded-full border border-white/20 object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[11px] font-bold">
          {initials}
        </span>
      )}
      <span className="truncate text-[11px] font-semibold">{name || '—'}</span>
    </div>
  )
}

function getInitials(name?: string | null) {
  if (!name) return '??'
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}
