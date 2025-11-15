"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { fetchTeamBadge } from '@/lib/footballApi'
import { Button } from '@/components/ui/button'

type Q = {
  id: string
  kind: string
  prompt: string
  options: any
  order_index: number
  match_id: string | null
}

export default function QuizPlayPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [title, setTitle] = React.useState<string>('')
  const [deadline, setDeadline] = React.useState<string | null>(null)
  const [questions, setQuestions] = React.useState<Q[]>([])
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, any>>({})
  const [matchMap, setMatchMap] = React.useState<Record<string, any>>({})
  const [teamBadges, setTeamBadges] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const total = questions.length

  React.useEffect(() => {
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const s = getSupabase()

        const { data: qz, error: quizErr } = await s
          .from('quizzes')
          .select('title,round_id')
          .eq('id', id)
          .maybeSingle()
        if (quizErr) throw quizErr

        if (qz?.title) setTitle(qz.title)

        if (qz?.round_id) {
          const { data: r, error: roundErr } = await s
            .from('rounds')
            .select('id,deadline_at')
            .eq('id', qz.round_id)
            .maybeSingle()
          if (roundErr) throw roundErr

          setDeadline(r?.deadline_at ?? null)

          if (r?.id) {
            const { data: ms, error: matchErr } = await s
              .from('matches')
              .select('id,home_team,away_team,kickoff_at')
              .eq('round_id', r.id)
            if (matchErr) throw matchErr

            const map: Record<string, any> = {}
            ;(ms || []).forEach((m: any) => {
              map[m.id] = m
            })
            setMatchMap(map)
          }
        }

        const { data: qs, error: qErr } = await s
          .from('quiz_questions')
          .select('id,kind,prompt,options,order_index,match_id')
          .eq('quiz_id', id)
          .order('order_index', { ascending: true })
        if (qErr) throw qErr

        setQuestions(qs || [])
      } catch (err: any) {
        console.error('Quiz load error', err)
        setError('Nie udało się załadować wiktoryny. Spróbuj ponownie.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  // Load team badges for all matches (TheSportsDB searchteams.php)
  React.useEffect(() => {
    const teams = new Set<string>()
    Object.values(matchMap).forEach((m: any) => {
      if (m?.home_team) teams.add(m.home_team)
      if (m?.away_team) teams.add(m.away_team)
    })
    const missing = Array.from(teams).filter(
      name => name && !teamBadges[name],
    )
    if (missing.length === 0) return

    ;(async () => {
      const entries = await Promise.all(
        missing.map(async name => {
          try {
            const badge = await fetchTeamBadge(name)
            return [name, badge || ''] as const
          } catch {
            return [name, ''] as const
          }
        }),
      )
      setTeamBadges(prev => {
        const next = { ...prev }
        for (const [name, badge] of entries) {
          if (badge && !next[name]) next[name] = badge
        }
        return next
      })
    })()
  }, [matchMap, teamBadges])

  function choose(questionId: string, value: any) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    const s = getSupabase()
    try {
      const {
        data: { user },
      } = await s.auth.getUser()
      if (!user) throw new Error('Brak sesji')

      const { data: sub, error: subErr } = await s
        .from('quiz_submissions')
        .insert({
          quiz_id: id,
          user_id: user.id,
          submitted_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single()

      if (subErr) throw subErr

      const payload = Object.entries(answers).map(
        ([question_id, answer]) => ({
          submission_id: sub!.id,
          question_id,
          answer,
        }),
      )

      if (payload.length) {
        await s.from('quiz_answers').insert(payload as any)
      }

      router.replace('/app/history')
    } catch (e) {
      console.error(e)
      alert('Nie udało się wysłać odpowiedzi. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center text-white">
        Ładowanie…
      </div>
    )

  if (error)
    return (
      <div className="min-h-[60vh] grid place-items-center text-center text-white gap-4">
        <div>{error}</div>
        <Button onClick={() => router.refresh()}>Spróbuj ponownie</Button>
      </div>
    )

  if (!total)
    return (
      <div className="min-h-[60vh] grid place-items-center text-white">
        Brak pytań dla tej wiktoryny.
      </div>
    )

  const q = questions[step]
  const value = answers[q.id]
  const match = q.match_id ? matchMap[q.match_id] : null
  const isFuture = q.kind === 'future_1x2' || q.kind === 'future_score'
  const homeName = match?.home_team || ''
  const awayName = match?.away_team || ''
  const homeBadge =
    homeName && teamBadges[homeName] ? teamBadges[homeName] : null
  const awayBadge =
    awayName && teamBadges[awayName] ? teamBadges[awayName] : null

  const makeInitials = (name: string) => {
    if (!name) return ''
    const parts = name.split(' ').filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  const homeInitials = makeInitials(homeName)
  const awayInitials = makeInitials(awayName)
  const renderSplitName = (name: string | undefined, align: 'left' | 'right') => {
    if (!name) return null
    return (
      <span
        className={`text-sm sm:text-base uppercase tracking-wide leading-tight ${
          align === 'left' ? 'text-left' : 'text-right'
        }`}
      >
        {name.split(' ').map((part, idx) => (
          <span key={`${name}-${part}-${idx}`} className="block">
            {part}
          </span>
        ))}
      </span>
    )
  }

  const isAnswered =
    q.kind === 'future_score'
      ? Boolean(
          value &&
            typeof value.home === 'number' &&
            typeof value.away === 'number',
        )
      : q.kind === 'history_numeric'
        ? typeof value === 'number'
        : typeof value !== 'undefined' && value !== null

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden w-full bg-background">
      {/* Тёмный фон + красный блок справа с мягким туманом */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(
              90deg,
              #050712 0%,
              #050712 30%,
              #7f1d1d 55%,
              #dc2626 80%,
              #f97373 100%
            ),
            radial-gradient(
              circle at 80% 45%,
              rgba(248,113,113,0.95) 0%,
              rgba(239,68,68,0.85) 18%,
              rgba(220,38,38,0.55) 38%,
              rgba(127,29,29,0.2) 55%,
              rgba(15,23,42,0.0) 80%
            )
          `,
          backgroundRepeat: 'no-repeat, no-repeat',
          backgroundSize: '100% 100%, 160% 160%',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] items-start justify-center px-4 sm:px-6 md:px-8 pt-6 sm:pt-10 pb-6 text-white">
        <div className="w-full max-w-[900px]">
          {/* header / title with team badges for future questions */}
          <div className="mx-auto w-full max-w-[640px] rounded-2xl border border-white/35 bg-white/10 px-4 sm:px-8 py-4 sm:py-5 mb-5 sm:mb-6">
            <div className="text-center">
              <div className="font-headline tracking-wider text-lg uppercase">
                {title || 'Wiktoryna'}
              </div>
              {deadline && (
                <div className="opacity-80 text-sm mt-1">
                  Do: {new Date(deadline).toLocaleString('pl-PL')}
                </div>
              )}
            </div>
          </div>

          {/* Pasek postępu w formie segmentów + licznik pytania */}
          {total > 0 && (
            <div className="mb-4 sm:mb-5">
              <div className="mb-1 flex justify-center gap-1.5 sm:gap-2">
                {Array.from({ length: Math.min(total, 10) }).map((_, idx) => {
                  const segmentCount = Math.min(total, 10)
                  const activeIndex =
                    segmentCount === 1
                      ? 0
                      : Math.round(
                          (step / Math.max(total - 1, 1)) *
                            (segmentCount - 1),
                        )
                  const isDone = idx < activeIndex
                  const isActive = idx === activeIndex
                  const base =
                    'h-[3px] rounded-full transition-colors duration-200 w-7 sm:w-9 md:w-10'
                  const tone = isActive
                    ? 'bg-white'
                    : isDone
                      ? 'bg-white/70'
                      : 'bg-black/45'
                  return <div key={idx} className={`${base} ${tone}`} />
                })}
              </div>
              <div className="text-center opacity-90 text-sm sm:text-base">
                Pytanie {step + 1} z {total}
              </div>
            </div>
          )}

          {(q.kind === 'future_1x2' || q.kind === 'future_score') &&
            match && (
              <div className="mx-auto mb-4 flex max-w-[520px] flex-col items-center gap-3 text-center">
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex w-[130px] flex-col items-center gap-2 text-center">
                    {homeBadge || homeInitials ? (
                      homeBadge ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={homeBadge || undefined}
                          alt={homeName || 'home'}
                          className="h-16 w-16 rounded-full bg-black/40 object-contain shadow-md"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-black/40 flex items-center justify-center text-sm font-semibold shadow-md">
                          {homeInitials}
                        </div>
                      )
                    ) : (
                      <div className="h-16 w-16" />
                    )}
                    <span className="text-[12px] uppercase tracking-wide text-white/85 leading-tight line-clamp-2">
                      {homeName}
                    </span>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-3 text-lg font-semibold">
                      <div className="text-right">{renderSplitName(match.home_team, 'right')}</div>
                      <span className="text-base uppercase tracking-wide text-white/80">
                        vs
                      </span>
                      <div className="text-left">{renderSplitName(match.away_team, 'left')}</div>
                    </div>
                    {match.kickoff_at && (
                      <div className="opacity-80 text-sm mt-1">
                        {new Date(match.kickoff_at).toLocaleString('pl-PL')}
                      </div>
                    )}
                  </div>
                  <div className="flex w-[130px] flex-col items-center gap-2 text-center">
                    {awayBadge || awayInitials ? (
                      awayBadge ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={awayBadge || undefined}
                          alt={awayName || 'away'}
                          className="h-16 w-16 rounded-full bg-black/40 object-contain shadow-md"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-black/40 flex items-center justify-center text-sm font-semibold shadow-md">
                          {awayInitials}
                        </div>
                      )
                    ) : (
                      <div className="h-16 w-16" />
                    )}
                    <span className="text-[12px] uppercase tracking-wide text-white/85 leading-tight line-clamp-2">
                      {awayName}
                    </span>
                  </div>
                </div>
              </div>
            )}

          <h2 className="text-center font-headline font-extrabold text-2xl sm:text-3xl md:text-4xl mb-5 sm:mb-6 drop-shadow">
            {q.prompt}
          </h2>

          {/* Render by type */}
          {Array.isArray(q.options) || q.kind === 'future_1x2' ? (
            <div className="mx-auto max-w-[700px] space-y-3">
              {(Array.isArray(q.options) ? q.options : ['1', 'X', '2']).map(
                (opt: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => choose(q.id, opt)}
                    className={`w-full rounded-xl px-4 py-3 text-left transition backdrop-blur
                      ${
                        value === opt
                          ? 'bg-white text-black'
                          : 'bg-white/20 hover:bg-white/30'
                      }`}
                  >
                    {typeof opt === 'string' ? opt : JSON.stringify(opt)}
                  </button>
                ),
              )}
            </div>
          ) : q.kind === 'future_score' ? (
            <ScorePicker
              value={value as any}
              onChange={(v: any) => choose(q.id, v)}
              options={q.options as any}
            />
          ) : q.kind === 'history_numeric' ? (
            <NumericPicker
              value={value as number}
              onChange={(v: number) => choose(q.id, v)}
              options={q.options as any}
            />
          ) : (
            <div className="text-center opacity-80">
              Nieobsługiwany typ pytania
            </div>
          )}

          <div className="mt-6 sm:mt-7 flex items-center justify-between gap-3 max-w-[700px] mx-auto">
            <Button
              variant="secondary"
              className="rounded-full px-6"
              disabled={step === 0}
              onClick={() => setStep(s => Math.max(0, s - 1))}
            >
              Poprzednie
            </Button>
            {step < total - 1 ? (
              <Button
                className="rounded-full bg-yellow-400 text-black hover:bg-yellow-300 px-8"
                onClick={() => setStep(s => Math.min(total - 1, s + 1))}
                disabled={!isAnswered || submitting}
              >
                Następne
              </Button>
            ) : (
              <Button
                className="rounded-full bg-yellow-400 text-black hover:bg-yellow-300 px-8"
                onClick={submit}
                disabled={!isAnswered || submitting}
              >
                {submitting ? 'Wysyłanie…' : 'Prześlij'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NumericPicker({
  value,
  onChange,
  options,
}: {
  value?: number
  onChange: (v: number) => void
  options?: any
}) {
  const min = options?.min ?? 0
  const max = options?.max ?? 6
  const step = options?.step ?? 1
  const v = typeof value === 'number' ? value : min

  return (
    <div className="mx-auto max-w-[700px]">
      <div className="mx-auto w-20 text-center rounded-xl bg-white/15 py-3 text-xl font-bold mb-3">
        {v}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-sm opacity-80">
        <span>{min}</span>
        <span>{max}+</span>
      </div>
    </div>
  )
}

function ScorePicker({
  value,
  onChange,
  options,
}: {
  value?: { home: number; away: number }
  onChange: (v: { home: number; away: number }) => void
  options?: any
}) {
  const v =
    value || {
      home: options?.min_home ?? 0,
      away: options?.min_away ?? 0,
    }

  const set = (k: 'home' | 'away', d: number) =>
    onChange({ ...v, [k]: Math.max(0, (v as any)[k] + d) })

  return (
    <div className="mx-auto max-w-[700px] text-center">
      <div className="flex items-center justify-center gap-10 text-5xl font-extrabold">
        <span>{v.home}</span>
        <span>:</span>
        <span>{v.away}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => set('home', -1)}
            className="h-10 w-10 rounded-xl"
            variant="secondary"
          >
            -
          </Button>
          <Button
            onClick={() => set('home', +1)}
            className="h-10 w-10 rounded-xl"
            variant="secondary"
          >
            +
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => set('away', -1)}
            className="h-10 w-10 rounded-xl"
            variant="secondary"
          >
            -
          </Button>
          <Button
            onClick={() => set('away', +1)}
            className="h-10 w-10 rounded-xl"
            variant="secondary"
          >
            +
          </Button>
        </div>
      </div>
    </div>
  )
}
