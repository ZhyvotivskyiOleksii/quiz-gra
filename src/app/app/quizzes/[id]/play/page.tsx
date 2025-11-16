"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { fetchTeamBadge } from '@/lib/footballApi'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

        const {
          data: { user },
        } = await s.auth.getUser()

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

        if (user) {
          const { data: submission } = await s
            .from('quiz_submissions')
            .select('id')
            .eq('quiz_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (submission?.id) {
            const { data: storedAnswers } = await s
              .from('quiz_answers')
              .select('question_id,answer')
              .eq('submission_id', submission.id)
            if (storedAnswers?.length) {
              const initial: Record<string, any> = {}
              storedAnswers.forEach(a => {
                if (a.question_id) initial[a.question_id] = a.answer
              })
              setAnswers(initial)
            }
          }
        }
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

      const nowIso = new Date().toISOString()
      const { data: existing, error: existingErr } = await s
        .from('quiz_submissions')
        .select('id')
        .eq('quiz_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (existingErr) throw existingErr

      let submissionId = existing?.id
      if (submissionId) {
        await s.from('quiz_submissions').update({ submitted_at: nowIso }).eq('id', submissionId)
        await s.from('quiz_answers').delete().eq('submission_id', submissionId)
      } else {
        const { data: sub, error: subErr } = await s
          .from('quiz_submissions')
          .insert({
            quiz_id: id,
            user_id: user.id,
            submitted_at: nowIso,
          } as any)
          .select('id')
          .single()
        if (subErr) throw subErr
        submissionId = sub!.id
      }

      if (!submissionId) throw new Error('Nie udało się zapisać zgłoszenia')

      const payload = Object.entries(answers).map(
        ([question_id, answer]) => ({
          submission_id: submissionId,
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
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(187,155,255,0.18),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,_rgba(255,102,51,0.18),_transparent_50%)]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] items-start justify-center px-4 pt-6 pb-6 text-white sm:px-6 sm:pt-10 md:px-8">
        <div className="w-full max-w-[900px]">
          {/* header / title with team badges for future questions */}
          <div className="mx-auto mb-5 w-full max-w-[640px] rounded-[26px] border border-white/10 bg-[rgba(16,18,34,0.9)] px-4 py-4 shadow-[0_25px_60px_rgba(5,5,10,0.65)] sm:mb-6 sm:px-8 sm:py-5">
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
                    ? 'bg-[hsl(var(--accent))]'
                    : isDone
                      ? 'bg-white/30'
                      : 'bg-white/10'
                  return <div key={idx} className={`${base} ${tone}`} />
                })}
              </div>
              <div className="text-center opacity-90 text-sm sm:text-base">
                Pytanie {step + 1} z {total}
              </div>
            </div>
          )}

          {(q.kind === 'future_1x2' || q.kind === 'future_score') && match && (
            <div className="mx-auto mb-5 flex max-w-[720px] flex-col gap-4 rounded-[32px] border border-white/10 bg-[rgba(10,12,24,0.82)] px-4 py-5 text-center shadow-[0_25px_60px_rgba(4,5,13,0.65)] sm:px-6">
              <div className="flex w-full items-center justify-between gap-2 sm:gap-6">
                <TeamBadgeVisual label={homeName} badge={homeBadge} fallback={homeInitials} />
                <div className="flex flex-col items-center gap-1 text-white">
                  <div className="text-2xl font-extrabold tracking-[0.35em] text-white sm:text-3xl">
                    VS
                  </div>
                  {match.kickoff_at && (
                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-white/80">
                      {new Date(match.kickoff_at).toLocaleString('pl-PL')}
                    </div>
                  )}
                </div>
                <TeamBadgeVisual label={awayName} badge={awayBadge} fallback={awayInitials} />
              </div>
            </div>
          )}

          <h2 className="text-center font-headline font-extrabold text-2xl sm:text-3xl md:text-4xl mb-5 sm:mb-6 drop-shadow">
            {q.prompt}
          </h2>

          {/* Render by type */}
          {Array.isArray(q.options) || q.kind === 'future_1x2' ? (
            <div className="mx-auto max-w-[720px] flex flex-wrap justify-center gap-3 sm:gap-4">
              {(Array.isArray(q.options) ? q.options : ['1', 'X', '2']).map((opt: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => choose(q.id, opt)}
                  className={cn(
                    'group relative flex-1 min-w-[140px] rounded-2xl border border-white/10 px-4 py-3 text-center font-semibold uppercase tracking-wide transition-all duration-200',
                    value === opt
                      ? 'bg-[linear-gradient(135deg,rgba(255,102,51,0.95),rgba(187,155,255,0.9))] text-slate-950 shadow-[0_18px_45px_rgba(255,102,51,0.45)]'
                      : 'bg-[rgba(13,16,28,0.85)] text-white/85 hover:border-white/30 hover:bg-[rgba(22,25,40,0.95)]'
                  )}
                >
                  {typeof opt === 'string' ? opt : JSON.stringify(opt)}
                </button>
              ))}
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
              className="rounded-full px-6 shadow-[0_12px_35px_rgba(4,5,15,0.55)]"
              disabled={step === 0}
              onClick={() => setStep(s => Math.max(0, s - 1))}
            >
              Poprzednie
            </Button>
            {step < total - 1 ? (
              <Button
                className="rounded-full px-8 shadow-[0_22px_50px_rgba(255,102,51,0.45)]"
                onClick={() => setStep(s => Math.min(total - 1, s + 1))}
                disabled={!isAnswered || submitting}
              >
                Następne
              </Button>
            ) : (
              <Button
                className="rounded-full px-8 shadow-[0_22px_50px_rgba(255,102,51,0.45)]"
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
      <div className="mx-auto mb-3 w-20 rounded-xl bg-[rgba(187,155,255,0.15)] py-3 text-center text-xl font-bold text-white">
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
      <div className="flex justify-between text-sm text-white/70">
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
      <div className="mx-auto flex max-w-[360px] items-center justify-center gap-10 rounded-[28px] border border-white/10 bg-[rgba(13,15,28,0.85)] px-8 py-5 text-5xl font-extrabold text-white shadow-[0_20px_45px_rgba(3,4,12,0.55)]">
        <span>{v.home}</span>
        <span>:</span>
        <span>{v.away}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => set('home', -1)}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
            variant="secondary"
          >
            -
          </Button>
          <Button
            onClick={() => set('home', +1)}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
            variant="secondary"
          >
            +
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => set('away', -1)}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
            variant="secondary"
          >
            -
          </Button>
          <Button
            onClick={() => set('away', +1)}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
            variant="secondary"
          >
            +
          </Button>
        </div>
      </div>
    </div>
  )
}

function TeamBadgeVisual({ label, badge, fallback }: { label: string; badge: string | null; fallback: string }) {
  const parts = (label || '').split(' ').filter(Boolean)
  return (
    <div className="flex flex-col items-center gap-2 text-center text-white">
      <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(187,155,255,0.45),_transparent_75%)] blur-lg"
        />
        <div className="relative flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-[rgba(7,9,20,0.9)] shadow-[0_20px_45px_rgba(3,4,12,0.75)]">
          {badge ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={badge}
              alt={label}
              className="h-12 w-12 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] sm:h-14 sm:w-14"
            />
          ) : (
            <div className="text-lg font-semibold tracking-widest text-white">
              {fallback || label.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.35em] text-white/75">
        {parts.length ? (
          parts.map((part, idx) => (
            <span key={`${label}-${idx}`} className="block">
              {part}
            </span>
          ))
        ) : (
          <span>{label}</span>
        )}
      </div>
    </div>
  )
}
