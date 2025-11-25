import Image from 'next/image'
import { Timer } from 'lucide-react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import BonusInfoPanel, { BonusQuizSummary } from '@/components/app/bonus-info-panel'
import { redirect } from 'next/navigation'
import { QuizActionButton } from '@/components/app/quiz-action-button'

export default async function PlayPage() {
  // Load published quizzes for this view
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      } as any,
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/?auth=login')
  }

  const { data: rounds } = await supabase
    .from('rounds')
    .select('id,label,deadline_at,leagues(name,code),matches(kickoff_at),quizzes(*)')
    .neq('status','draft')
    .order('deadline_at',{ ascending: true })
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, phone_confirmed_at')
    .eq('id', user.id)
    .maybeSingle()
  const hasPhone =
    Boolean(profile?.phone) ||
    Boolean((user as any).phone) ||
    Boolean((user.user_metadata as any)?.phone)
  const phoneConfirmed = Boolean(profile?.phone_confirmed_at) || Boolean((user as any).phone_confirmed_at)
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
              const isClosed = Number.isFinite(deadlineTs) ? deadlineTs <= now : false
              const hasSubmission = q.id ? Boolean(submissionMap[q.id]) : false
              const kickoffSource = Number.isFinite(earliestKickoff ?? NaN) ? earliestKickoff! : deadlineTs
              const kickoffLabel = Number.isFinite(kickoffSource)
                ? new Date(kickoffSource).toLocaleString('pl-PL', {
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
              const actionLabel = isClosed
                ? 'Zamknięte'
                : hasSubmission
                  ? 'Edytuj typy'
                  : 'Zagraj za darmo'
              return (
                <div key={r.id} className="group relative overflow-hidden rounded-[30px] sm:rounded-[34px] bg-gradient-to-r from-[#3a0d0d] via-[#5a0f0f] to-[#7a1313] p-0 shadow-xl">
                  <div className="flex">
                    <div className="relative w-[55%] min-h-[170px] sm:min-h-[210px] overflow-hidden rounded-[30px] sm:rounded-[34px]">
                      <Image src={img} alt="Quiz" fill className="object-cover scale-105 sm:scale-100" />
                      {/* chip */}
                      <div className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] px-2 py-1 flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5" /> Koniec za: {formatTimeLeft(r.deadline_at) || '—'}
                      </div>
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
