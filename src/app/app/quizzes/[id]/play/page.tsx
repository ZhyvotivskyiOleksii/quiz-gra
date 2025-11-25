"use client";
import * as React from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { PitchLoader } from '@/components/ui/pitch-loader'
import { cn } from '@/lib/utils'
import { getTeamLogoUrl } from '@/lib/footballApi'

const FUTURE_NUMERIC_KINDS = new Set(['future_yellow_cards', 'future_corners'])
const FUTURE_STAT_PROMPTS: Record<string, string> = {
  future_yellow_cards: 'Ile żółtych kartek padnie w meczu?',
  future_corners: 'Ile rzutów rożnych zobaczymy w meczu?',
}
const LEGACY_1X2_PROMPTS = new Set(['kto wygra mecz?', 'kto wygra mecz'])

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
  const [roundLabel, setRoundLabel] = React.useState<string | null>(null)
  const [questions, setQuestions] = React.useState<Q[]>([])
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, any>>({})
  const [matchMap, setMatchMap] = React.useState<Record<string, any>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const total = questions.length
  const currentStep = total > 0 ? Math.min(step, total - 1) : 0
  const q = total > 0 ? questions[currentStep] : null
  const value = q ? answers[q.id] : undefined
  const match = q?.match_id ? matchMap[q.match_id] : null
  const matchRoundLabel = match?.round_label ?? roundLabel ?? null
  const homeName = match?.home_team ?? ''
  const awayName = match?.away_team ?? ''
  const homeBadge = match?.home_team_external_id ? getTeamLogoUrl(match.home_team_external_id) : null
  const awayBadge = match?.away_team_external_id ? getTeamLogoUrl(match.away_team_external_id) : null
  const homeInitials = getInitials(homeName)
  const awayInitials = getInitials(awayName)
  const matchKickoffDate = React.useMemo(
    () => (match?.kickoff_at ? new Date(match.kickoff_at) : null),
    [match?.kickoff_at],
  )
  const matchHasStarted = matchKickoffDate ? matchKickoffDate.getTime() <= Date.now() : false
  const matchesArray = React.useMemo(() => Object.values(matchMap || {}), [matchMap])
  const earliestMatchKickoffTs = React.useMemo(() => {
    const ts = (matchesArray as any[])
      .map(m => (m?.kickoff_at ? new Date(m.kickoff_at).getTime() : null))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    if (!ts.length) return null
    return Math.min(...ts)
  }, [matchesArray])
  const roundDeadlineTs = React.useMemo(
    () => (deadline ? new Date(deadline).getTime() : null),
    [deadline],
  )
  const quizLockTs = React.useMemo(() => {
    const values = [roundDeadlineTs, earliestMatchKickoffTs].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value),
    )
    if (!values.length) return null
    return Math.min(...values)
  }, [roundDeadlineTs, earliestMatchKickoffTs])
  const quizLocked = quizLockTs !== null && quizLockTs <= Date.now()
  const quizLockLabel = quizLockTs ? new Date(quizLockTs).toLocaleString('pl-PL') : null
  const bettingInfo = React.useMemo(() => {
    if (!quizLockTs) return null
    return quizLockTs <= Date.now()
      ? `Typowanie zamknięte ${quizLockLabel ?? ''}`.trim()
      : `Koniec obstawiania: ${quizLockLabel}`
  }, [quizLockTs, quizLockLabel])
  const isAnswered = q ? isQuestionAnswered(q.kind, value) : false

  React.useEffect(() => {
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const s = getSupabase()
        const matchSelect =
          'id,home_team,away_team,kickoff_at,home_team_external_id,away_team_external_id,round_label'

        const quizPromise = s
          .from('quizzes')
          .select('title,round_id')
          .eq('id', id)
          .maybeSingle()

        const questionsPromise = s
          .from('quiz_questions')
          .select('id,kind,prompt,options,order_index,match_id')
          .eq('quiz_id', id)
          .order('order_index', { ascending: true })

        const userPromise = s.auth.getUser()

        const [
          {
            data: { user },
          },
          { data: qz, error: quizErr },
          { data: qs, error: qErr },
        ] = await Promise.all([userPromise, quizPromise, questionsPromise])

        if (quizErr) throw quizErr
        if (qErr) throw qErr

        if (qz?.title) setTitle(qz.title)
        setQuestions(qs || [])

        const nextMatchMap: Record<string, any> = {}

        if (qz?.round_id) {
          const { data: r, error: roundErr } = await s
            .from('rounds')
            .select('id,deadline_at,label')
            .eq('id', qz.round_id)
            .maybeSingle()
          if (roundErr) throw roundErr

          setDeadline(r?.deadline_at ?? null)
          setRoundLabel((r as any)?.label ?? null)

          if (r?.id) {
            const { data: ms, error: matchErr } = await s.from('matches').select(matchSelect).eq('round_id', r.id)
            if (matchErr) throw matchErr

            ;(ms || []).forEach((m: any) => {
              if (m?.id) nextMatchMap[m.id] = m
            })
          }
        }

        const questionMatchIds = Array.from(
          new Set((qs || []).map(q => q.match_id).filter((mid): mid is string => Boolean(mid))),
        )
        const missingMatchIds = questionMatchIds.filter(mid => !nextMatchMap[mid])

        if (missingMatchIds.length) {
          const { data: ms, error: matchErr } = await s.from('matches').select(matchSelect).in('id', missingMatchIds)
          if (matchErr) throw matchErr
          ;(ms || []).forEach((m: any) => {
            if (m?.id) nextMatchMap[m.id] = m
          })
        }

        setMatchMap(nextMatchMap)

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
              storedAnswers.forEach((a) => {
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


  function choose(questionId: string, value: any) {
    if (quizLocked) return
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  async function submit() {
    if (submitting || quizLocked) {
      if (quizLocked) {
        alert('Typowanie zostało już zamknięte. Nie możesz edytować odpowiedzi po rozpoczęciu meczu.')
      }
      return
    }
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

      router.replace('/app/results')
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('Nie udało się wysłać odpowiedzi. Spróbuj ponownie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden app-surface-bg">
      {submitting && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="rounded-[28px] border border-white/10 bg-[rgba(14,16,30,0.9)] px-10 py-8 text-center text-white shadow-[0_22px_55px_rgba(0,0,0,0.65)]">
            <PitchLoader />
            <p className="mt-4 text-xs uppercase tracking-[0.4em] text-white/70">
              Przesyłamy odpowiedzi…
            </p>
          </div>
        </div>
      )}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] items-start justify-center px-4 pt-6 pb-6 text-white sm:px-6 sm:pt-10 md:px-8">
        <div className="w-full max-w-[900px]">
          <div className="animate-gradient-border mx-auto mb-5 w-full max-w-[640px] sm:mb-6">
            <div className="gradient-border-inner relative overflow-hidden px-4 py-4 shadow-[0_25px_60px_rgba(5,5,10,0.45)] sm:px-8 sm:py-5">
              <Image
                src="/icon/soc.webp"
                alt=""
                width={360}
                height={260}
                priority
                aria-hidden="true"
                className="pointer-events-none select-none absolute top-1/2 right-[-8px] w-[92px] -translate-y-1/2 opacity-80 drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] sm:right-[-4px] sm:w-[125px]"
              />
              <div className="text-center">
                <div className="font-headline tracking-wider text-lg uppercase">{title || 'Wiktoryna'}</div>
                {roundLabel && <div className="mt-1 text-sm uppercase tracking-wide text-white/80">{roundLabel}</div>}
                {bettingInfo && <div className="mt-1 text-sm opacity-80">{bettingInfo}</div>}
              </div>
            </div>
          </div>

          {quizLocked && (
            <div className="mx-auto mb-6 max-w-[640px] rounded-2xl border border-white/10 bg-red-500/10 px-6 py-5 text-center text-sm text-red-200">
              Typowanie zamknięte. Mecz wystartował {quizLockLabel}.
            </div>
          )}

          {loading && (
            <div className="mx-auto flex max-w-[640px] flex-col items-center gap-4 rounded-[22px] border border-white/5 bg-white/5 px-6 py-10 text-center text-white/80">
              <PitchLoader />
              <p className="text-sm uppercase tracking-[0.4em]">Ładujemy pytania…</p>
            </div>
          )}

          {!loading && error && (
            <div className="mx-auto max-w-[640px] rounded-[22px] border border-red-500/30 bg-red-500/10 px-6 py-6 text-center text-sm text-red-100">
              {error}
            </div>
          )}

          {!loading && !error && !q && (
            <div className="mx-auto max-w-[640px] rounded-[22px] border border-white/10 bg-white/5 px-6 py-6 text-center text-sm text-white/80">
              Ten quiz nie ma jeszcze pytań. Wróć później.
            </div>
          )}

          {!loading && !error && q && (
            <>
              {total > 0 && (
                <div className="mb-4 sm:mb-5">
                  <div className="mb-1 flex justify-center gap-1.5 sm:gap-2">
                    {Array.from({ length: Math.min(total, 10) }).map((_, idx) => {
                      const segmentCount = Math.min(total, 10)
                      const activeIndex =
                        segmentCount === 1
                          ? 0
                          : Math.round((currentStep / Math.max(total - 1, 1)) * (segmentCount - 1))
                      const isDone = idx < activeIndex
                      const isActive = idx === activeIndex
                      const base = 'h-[3px] rounded-full transition-colors duration-200 w-7 sm:w-9 md:w-10'
                      const tone = isActive ? 'bg-[hsl(var(--accent))]' : isDone ? 'bg-white/30' : 'bg-white/10'
                      return <div key={idx} className={`${base} ${tone}`} />
                    })}
                  </div>
              <div className="text-center text-sm opacity-90 sm:text-base">
                    Pytanie {currentStep + 1} z {total}
                  </div>
                </div>
              )}

              {(q.kind === 'future_1x2' || q.kind === 'future_score' || FUTURE_NUMERIC_KINDS.has(q.kind)) && match && (
                <div className="mx-auto mb-5 flex max-w-[720px] flex-col gap-4 rounded-[32px] border border-white/10 bg-[rgba(10,12,24,0.82)] px-4 py-5 text-center shadow-[0_25px_60px_rgba(4,5,13,0.65)] sm:px-6">
                  <div className="flex w-full items-center justify-between gap-2 sm:gap-6">
                    <TeamBadgeVisual label={homeName} badge={homeBadge} fallback={homeInitials} />
                    <div className="flex flex-col items-center gap-1 text-white">
                      <div className="text-2xl font-extrabold tracking-[0.35em] text-white sm:text-3xl">VS</div>
                      {matchRoundLabel && (
                        <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
                          {matchRoundLabel}
                        </div>
                      )}
                      {matchKickoffDate && (
                        <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-white/80">
                          {matchHasStarted
                            ? `Mecz w trakcie · start ${matchKickoffDate.toLocaleString('pl-PL')}`
                            : matchKickoffDate.toLocaleString('pl-PL')}
                        </div>
                      )}
                    </div>
                    <TeamBadgeVisual label={awayName} badge={awayBadge} fallback={awayInitials} />
                  </div>
                </div>
              )}

              <h2 className="text-center font-headline text-2xl font-extrabold drop-shadow sm:text-3xl md:text-4xl mb-4">
                {getDisplayPrompt(q)}
              </h2>

              {(() => {
                const isChoice = Array.isArray(q.options) || q.kind === 'future_1x2'
                const isNumeric = q.kind === 'history_numeric' || FUTURE_NUMERIC_KINDS.has(q.kind)
                if (isChoice) {
                  const showTeamMeta = q.kind !== 'future_1x2'
                  const choiceOptions = Array.isArray(q.options) ? q.options : ['1', 'X', '2']
                  return (
                    <div className="mx-auto flex max-w-[720px] flex-wrap justify-center gap-3 sm:gap-4">
                      {choiceOptions.map((opt: any, idx: number) => {
                        const teamMeta = showTeamMeta
                          ? getOptionTeamMeta(
                              opt,
                              homeName,
                              awayName,
                              homeBadge,
                              awayBadge,
                              homeInitials,
                              awayInitials,
                            )
                          : null
                        return (
                          <button
                            key={`${q.id}-${idx}`}
                            onClick={() => choose(q.id, opt)}
                            className={cn(
                              'group relative min-w-[120px] flex-1 rounded-2xl border border-white/10 px-4 py-3 text-center font-semibold uppercase tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
                              value === opt
                                ? 'bg-[linear-gradient(135deg,rgba(255,102,51,0.95),rgba(187,155,255,0.9))] text-slate-950 shadow-[0_18px_45px_rgba(255,102,51,0.45)]'
                                : 'bg-[rgba(13,16,28,0.85)] text-white/85 hover:border-white/30 hover:bg-[rgba(22,25,40,0.95)]',
                            )}
                            disabled={quizLocked}
                          >
                            <span className="flex flex-col items-center gap-2">
                              {teamMeta ? (
                                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 p-2 shadow-[0_12px_30px_rgba(3,4,12,0.65)]">
                                  {teamMeta.badge ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={teamMeta.badge} alt={teamMeta.name} className="h-full w-full object-contain" />
                                  ) : (
                                    <span className="text-sm font-bold text-white">{teamMeta.fallback}</span>
                                  )}
                                </span>
                              ) : null}
                              <span>{renderOptionLabel(opt)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                }
                if (q.kind === 'future_score') {
                  return <ScorePicker value={value as any} onChange={(v: any) => choose(q.id, v)} options={q.options as any} />
                }
                if (isNumeric) {
                  return <NumericPicker value={value as number} onChange={(v: number) => choose(q.id, v)} options={q.options as any} />
                }
                return <div className="text-center text-sm text-white/70">Nieobsługiwany тип pytania</div>
              })()}

              <div className="mx-auto mt-6 flex max-w-[700px] items-center justify-between gap-3 sm:mt-7">
                <Button
                  variant="secondary"
                  className="rounded-full px-6 shadow-[0_12px_35px_rgba(4,5,15,0.55)]"
                  disabled={currentStep === 0}
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                >
                  Poprzednie
                </Button>
                {currentStep < total - 1 ? (
                  <Button
                    className="rounded-full px-8 shadow-[0_22px_50px_rgba(255,102,51,0.45)]"
                    onClick={() => setStep(s => Math.min(total - 1, s + 1))}
                    disabled={!isAnswered || submitting || quizLocked}
                  >
                    Następne
                  </Button>
                ) : (
                  <Button
                    className="rounded-full px-8 shadow-[0_22px_50px_rgba(255,102,51,0.45)]"
                    onClick={submit}
                    disabled={!isAnswered || submitting || quizLocked}
                  >
                    {submitting ? 'Wysyłanie…' : 'Prześlij'}
                  </Button>
                )}
              </div>
            </>
          )}
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
  const sliderRange = Math.max(max - min, 1)
  const fillPercent = Math.min(100, Math.max(0, ((v - min) / sliderRange) * 100))
  const sliderGradient = `linear-gradient(90deg, rgba(255,102,51,0.95) 0%, rgba(187,155,255,0.95) ${fillPercent}%, rgba(255,255,255,0.15) ${fillPercent}%, rgba(255,255,255,0.08) 100%)`

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
        onChange={e => onChange(Number(e.target.value))}
        className="numeric-range w-full"
        style={{ backgroundImage: sliderGradient }}
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

function getInitials(label?: string) {
  if (!label) return '??'
  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  const condensed = parts || label.slice(0, 2).toUpperCase()
  return condensed.slice(0, 3) || '??'
}

function isQuestionAnswered(kind: string, value: any) {
  if (value === null || typeof value === 'undefined') return false
  if (kind === 'future_score') {
    return typeof value?.home === 'number' && typeof value?.away === 'number'
  }
  if (kind === 'history_numeric') {
    return typeof value === 'number'
  }
  if (FUTURE_NUMERIC_KINDS.has(kind)) {
    return typeof value === 'number'
  }
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return String(value).trim() !== ''
}

function renderOptionLabel(opt: any) {
  const text = getOptionText(opt)
  if (text) return text
  return typeof opt === 'string' ? opt : JSON.stringify(opt)
}

type OptionTeamMeta = {
  badge: string | null
  fallback: string
  name: string
}

function getOptionTeamMeta(
  opt: any,
  homeName: string,
  awayName: string,
  homeBadge: string | null,
  awayBadge: string | null,
  homeInitials: string,
  awayInitials: string,
): OptionTeamMeta | null {
  const optionText = getOptionText(opt)
  if (!optionText) return null

  const alignment = resolveTeamAlignment(opt, optionText, homeName, awayName)

  if (alignment === 'home' && homeName) {
    return {
      badge: homeBadge,
      fallback: homeInitials || getInitials(homeName),
      name: homeName,
    }
  }
  if (alignment === 'away' && awayName) {
    return {
      badge: awayBadge,
      fallback: awayInitials || getInitials(awayName),
      name: awayName,
    }
  }
  return null
}

function resolveTeamAlignment(opt: any, optionText: string, homeName: string, awayName: string): 'home' | 'away' | null {
  const normalizedText = normalizeLabel(optionText)
  const normalizedHome = normalizeLabel(homeName)
  const normalizedAway = normalizeLabel(awayName)

  if (normalizedHome && normalizedText && normalizedText.includes(normalizedHome)) return 'home'
  if (normalizedAway && normalizedText && normalizedText.includes(normalizedAway)) return 'away'

  const normalizedValue = normalizeLabel(getOptionValue(opt))
  const normalizedCompact = normalizedText?.replace(/\s+/g, '')
  const normalizedValueCompact = normalizedValue?.replace(/\s+/g, '')

  const homeSynonyms = ['1', 'home', 'gospodarz', 'dom', 'host', 'h']
  const awaySynonyms = ['2', 'away', 'gosc', 'goscie', 'guest', 'goście']

  if (
    (normalizedCompact && homeSynonyms.includes(normalizedCompact)) ||
    (normalizedValueCompact && homeSynonyms.includes(normalizedValueCompact))
  ) {
    return 'home'
  }
  if (
    (normalizedCompact && awaySynonyms.includes(normalizedCompact)) ||
    (normalizedValueCompact && awaySynonyms.includes(normalizedValueCompact))
  ) {
    return 'away'
  }

  return null
}

function getOptionText(opt: any): string {
  if (typeof opt === 'string') return opt
  if (typeof opt?.label === 'string') return opt.label
  if (typeof opt?.name === 'string') return opt.name
  if (typeof opt?.title === 'string') return opt.title
  if (typeof opt?.team === 'string') return opt.team
  if (typeof opt?.club === 'string') return opt.club
  if (typeof opt?.option === 'string') return opt.option
  if (typeof opt?.value === 'string') return opt.value
  return ''
}

function getOptionValue(opt: any): string {
  if (typeof opt === 'string') return opt
  if (typeof opt?.value === 'string') return opt.value
  if (typeof opt?.id === 'string') return opt.id
  return ''
}

function normalizeLabel(label?: string | null): string {
  if (!label) return ''
  return label
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function getDisplayPrompt(question: Q | null) {
  if (!question) return ''
  const raw = question.prompt?.trim() ?? ''
  if (FUTURE_NUMERIC_KINDS.has(question.kind)) {
    const fallback = FUTURE_STAT_PROMPTS[question.kind] ?? 'Podaj wartość'
    if (!raw) return fallback
    const normalized = raw.toLowerCase()
    if (LEGACY_1X2_PROMPTS.has(normalized)) return fallback
    return raw
  }
  return raw || 'Pytanie'
}
