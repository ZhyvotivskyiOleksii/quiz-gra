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
  prize?: number | null
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
      } catch (e: any) {
        setDetails((prev) => ({
          ...prev,
          [id]: { status: 'error', message: e?.message ?? 'Błąd wczytywania wyników' },
        }))
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'all', label: 'Wszystkie rundy' },
          { value: 'won', label: 'Wygrane' },
          { value: 'lost', label: 'Przegrane' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as any)}
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
        filtered.map((submission) => {
          const isOpen = openId === submission.id
          const state = details[submission.id]?.status ?? 'idle'
          return (
            <div
              key={submission.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#220d19] via-[#381221] to-[#5c121f] text-white shadow-2xl"
            >
              <div className="flex flex-col lg:flex-row">
                <div className="relative h-48 w-full overflow-hidden lg:w-2/5">
                  <Image
                    src={submission.imageUrl || '/images/preview.webp'}
                    alt={submission.quizTitle}
                    fill
                    className="object-cover"
                  />
                  {submission.prize ? (
                    <div className="absolute left-4 top-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow">
                      {submission.prize.toLocaleString('pl-PL')} zł
                    </div>
                  ) : null}
                </div>
                <div className="flex-1 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                        {submission.roundLabel ? `Runda ${submission.roundLabel}` : 'Runda'}
                      </p>
                      <h3 className="mt-1 text-3xl font-headline font-extrabold">{submission.quizTitle}</h3>
                      {submission.deadline && (
                        <p className="text-sm text-white/70">
                          {new Date(submission.deadline).toLocaleString('pl-PL')}
                        </p>
                      )}
                    </div>
                    <StatusPill status={submission.status} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/85">
                    <div>
                      <span className="text-white/60">Wynik:</span> {submission.correct} / {submission.total}
                    </div>
                    <div>
                      <span className="text-white/60">Data gry:</span>{' '}
                      {submission.submittedAt
                        ? new Date(submission.submittedAt).toLocaleDateString('pl-PL')
                        : '—'}
                    </div>
                    {typeof submission.points === 'number' && (
                      <div>
                        <span className="text-white/60">Punkty:</span> {submission.points}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                      className="rounded-full bg-white text-black hover:bg-white/90"
                      onClick={() => handleToggle(submission.id)}
                    >
                      {isOpen ? (
                        <>
                          Ukryj wyniki <ChevronUp className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Pokaż wyniki <ChevronDown className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button variant="outline" className="rounded-full border-white/40 text-white hover:bg-white/10">
                      <Gift className="mr-2 h-4 w-4" />
                      Nagrody
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                      {state === 'loading' && (
                        <div className="flex items-center justify-center gap-2 text-white/70">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wczytywanie…
                        </div>
                      )}
                      {state === 'error' && (
                        <div className="text-sm text-red-300">
                          {details[submission.id]?.status === 'error' &&
                            (details[submission.id] as any).message}
                        </div>
                      )}
                      {state === 'loaded' && (
                        <div className="space-y-3">
                          {(details[submission.id] as any).data.map(
                            (question: QuestionDetail, idx: number) => (
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
                                    <p className="text-xs text-red-300">
                                      Poprawna odpowiedź: {question.correctAnswer}
                                    </p>
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
                                  {question.status === 'pending' && (
                                    <Clock className="h-6 w-6 text-yellow-300" />
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function StatusPill({ status }: { status: SubmissionSummary['status'] }) {
  if (status === 'won') {
    return <Badge className="bg-emerald-500/90 px-3 py-1 text-white">Wygrana</Badge>
  }
  if (status === 'lost') {
    return <Badge className="bg-red-500/90 px-3 py-1 text-white">Przegrana</Badge>
  }
  return <Badge variant="outline" className="border-white/40 px-3 py-1 text-white">Oczekuje</Badge>
}
