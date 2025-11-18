"use client"

import * as React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Gift, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'

type SubmissionSummary = {
  id: string
  quizTitle: string
  roundLabel?: string | null
  deadline?: string | null
  submittedAt: string | null
  imageUrl?: string | null
  prizePool?: number | null
  prizeAwarded?: number | null
  status: 'won' | 'lost' | 'pending'
  correct: number
  total: number
  points?: number | null
}

type QuestionDetail = {
  id: string
  prompt: string
  userAnswer: string
  correctAnswer: string | null
  status: 'correct' | 'wrong' | 'pending'
  matchLabel?: string | null
}

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: QuestionDetail[] }
  | { status: 'error'; message: string }

export function ResultsAccordion({ submissions }: { submissions: SubmissionSummary[] }) {
  const [filter, setFilter] = React.useState<'all' | 'won' | 'lost'>('all')
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [details, setDetails] = React.useState<Record<string, DetailState>>({})

  const filtered = React.useMemo(() => {
    if (filter === 'all') return submissions
    return submissions.filter((s) => s.status === filter)
  }, [filter, submissions])

  const handleToggle = async (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))

    if (!details[id] || details[id]?.status === 'idle') {
      setDetails((prev) => ({ ...prev, [id]: { status: 'loading' } }))
      try {
        const res = await fetch(`/api/results/${id}`)
        if (!res.ok) throw new Error('Nie udało się wczytać wyników')
        const data = await res.json()
        setDetails((prev) => ({ ...prev, [id]: { status: 'loaded', data: data.questions ?? [] } }))
      } catch (error: any) {
        setDetails((prev) => ({
          ...prev,
          [id]: { status: 'error', message: error?.message ?? 'Błąd wczytywania wyników' },
        }))
      }
    }
  }

  const tabs = [
    { value: 'all', label: 'Wszystkie rundy' },
    { value: 'won', label: 'Wygrane' },
    { value: 'lost', label: 'Przegrane' },
  ] as const

  return (
    <div className="space-y-6 max-w-[960px] mx-auto">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              filter === tab.value
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/80 hover:bg-white/20',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-12 text-center text-white/70">
          Brak wyników do wyświetlenia.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((submission) => {
            const detailState = details[submission.id]
            const state = detailState?.status ?? 'idle'
            const isOpen = openId === submission.id
            const canViewResults = submission.status !== 'pending'
            const stats: Array<{ label: string; value: string }> = [
              {
                label: 'Wynik',
                value: `${submission.correct} / ${submission.total}`,
              },
              {
                label: 'Data gry',
                value: submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleString('pl-PL', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—',
              },
            ]
            if (typeof submission.points === 'number') {
              stats.push({
                label: 'Punkty',
                value: `+${submission.points}`,
              })
            }
            if (typeof submission.prizeAwarded === 'number') {
              stats.push({
                label: 'Twoja nagroda',
                value:
                  submission.prizeAwarded > 0
                    ? `${submission.prizeAwarded.toLocaleString('pl-PL')} zł`
                    : '—',
              })
            }

            return (
              <div key={submission.id} className="space-y-4">
                <div className="overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-r from-[#15050c] via-[#250814] to-[#350d1f] text-white shadow-[0_35px_90px_rgba(0,0,0,0.5)]">
                  <div className="flex flex-col gap-6 lg:flex-row lg:gap-0">
                    <div className="relative h-[190px] w-full overflow-hidden bg-black lg:h-auto lg:min-h-[230px] lg:w-[45%] lg:rounded-r-[100px]">
                      <Image
                        src={submission.imageUrl || '/images/preview.webp'}
                        alt={submission.quizTitle}
                        fill
                        className="object-cover object-center"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent via-[#200716]/70 to-[#350d1f]" />
                      {typeof submission.prizeAwarded === 'number' && submission.prizeAwarded > 0 ? (
                        <div className="absolute left-5 top-5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white">
                          Wygrana {submission.prizeAwarded.toLocaleString('pl-PL')} zł
                        </div>
                      ) : submission.prizePool ? (
                        <div className="absolute left-5 top-5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          Pula {submission.prizePool.toLocaleString('pl-PL')} zł
                        </div>
                      ) : null}
                    </div>

                    <div className="relative flex flex-1 flex-col justify-between bg-[radial-gradient(160%_120%_at_80%_-20%,rgba(255,255,255,0.18),transparent_45%)] px-5 pb-5 pt-7 text-left lg:px-8 lg:py-9">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">
                              {submission.roundLabel ? `Runda kolejka ${submission.roundLabel}` : 'Runda'}
                            </p>
                            <div>
                              <h3 className="text-[26px] font-headline font-extrabold leading-tight md:text-[32px]">
                                {submission.quizTitle}
                              </h3>
                              {submission.deadline && (
                                <p className="text-sm text-white/70">
                                  {new Date(submission.deadline).toLocaleString('pl-PL')}
                                </p>
                              )}
                            </div>
                          </div>
                          <StatusPill status={submission.status} />
                        </div>

                        <div className="grid gap-5 text-sm text-white/85 sm:grid-cols-2 lg:grid-cols-3">
                          {stats.map((stat) => (
                            <div key={stat.label} className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{stat.label}</p>
                              <p
                                className={cn(
                                  'text-lg font-semibold leading-tight',
                                  stat.label === 'Punkty' ? 'text-emerald-300' : undefined,
                                  stat.label === 'Twoja nagroda' && stat.value !== '—'
                                    ? 'text-yellow-300'
                                    : undefined,
                                )}
                              >
                                {stat.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            disabled={!canViewResults}
                            className={cn(
                              'rounded-full px-7 text-sm font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.35)]',
                              canViewResults
                                ? isOpen
                                  ? 'bg-white text-black'
                                  : 'bg-[linear-gradient(115deg,#fa6c2c,#f97c64,#c372ff)] text-black/90'
                                : 'bg-white/10 text-white/50 cursor-not-allowed',
                            )}
                            onClick={() => {
                              if (canViewResults) handleToggle(submission.id)
                            }}
                          >
                            {canViewResults ? (
                              isOpen ? (
                                <>
                                  Ukryj wyniki <ChevronUp className="ml-1 h-4 w-4" />
                                </>
                              ) : (
                                <>
                                  Pokaż wyniki <ChevronDown className="ml-1 h-4 w-4" />
                                </>
                              )
                            ) : (
                              <>Wyniki wkrótce</>
                            )}
                          </Button>
                          {typeof submission.prizeAwarded === 'number' && submission.prizeAwarded > 0 && (
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white">
                              <Gift className="h-4 w-4" />
                              Wypłacono {submission.prizeAwarded.toLocaleString('pl-PL')} zł
                            </div>
                          )}
                        </div>
                        {!canViewResults && (
                          <p className="text-xs text-white/60">
                            Wyniki pojawią się po zakończeniu i rozliczeniu rundy.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {isOpen && canViewResults && (
                  <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
                    {state === 'loading' && (
                      <div className="flex items-center justify-center gap-2 text-white/70">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Wczytywanie…
                      </div>
                    )}

                    {state === 'error' && detailState?.status === 'error' && (
                      <div className="text-sm text-red-300">{detailState.message}</div>
                    )}

                    {state === 'loaded' && detailState?.status === 'loaded' && (
                      <div className="space-y-3">
                        {detailState.data.map((question: QuestionDetail, idx: number) => (
                          <div
                            key={question.id}
                            className="flex items-start gap-4 rounded-2xl bg-white/5 p-3"
                          >
                            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-sm font-semibold">
                              {idx + 1}
                            </div>
                            <div className="flex-1 space-y-1 text-sm">
                              {question.matchLabel && (
                                <p className="text-xs uppercase tracking-wide text-white/60">
                                  {question.matchLabel}
                                </p>
                              )}
                              <p className="font-semibold">{question.prompt}</p>
                              <p className="text-white">
                                Twoja odpowiedź: <span className="font-semibold">{question.userAnswer}</span>
                              </p>
                              {question.status === 'wrong' && question.correctAnswer && (
                                <p className="text-xs text-red-300">Poprawna odpowiedź: {question.correctAnswer}</p>
                              )}
                              {question.status === 'pending' && (
                                <p className="text-xs text-amber-300">Oczekuje na rozliczenie</p>
                              )}
                            </div>
                            <div className="mt-1">
                              {question.status === 'correct' && (
                                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                              )}
                              {question.status === 'wrong' && <XCircle className="h-6 w-6 text-red-400" />}
                              {question.status === 'pending' && <Clock className="h-6 w-6 text-yellow-300" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: SubmissionSummary['status'] }) {
  const base = 'rounded-full border px-4 py-1 text-xs font-semibold tracking-[0.2em]'
  if (status === 'won') {
    return <Badge className={cn(base, 'border-transparent bg-emerald-500/90 text-white tracking-[0.15em]')}>Wygrana</Badge>
  }
  if (status === 'lost') {
    return <Badge className={cn(base, 'border-transparent bg-red-500/80 text-white tracking-[0.15em]')}>Przegrana</Badge>
  }
  return (
    <Badge variant="outline" className={cn(base, 'border-white/35 bg-white/5 text-white')}>
      Oczekuje
    </Badge>
  )
}
