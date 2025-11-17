"use client";

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Flame, Info } from 'lucide-react'

export type BonusQuizSummary = {
  quizId: string
  title: string
  label?: string | null
  prize: number
  brackets: { correct_answers: number; pool: number }[]
}

export default function BonusInfoPanel({ quizzes }: { quizzes: BonusQuizSummary[] }) {
  const [activeId, setActiveId] = React.useState(quizzes[0]?.quizId || '')
  const current = quizzes.find((q) => q.quizId === activeId) || quizzes[0]

  if (!current) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-[rgba(16,18,34,0.94)] px-5 py-6 text-white shadow-[0_25px_60px_rgba(5,5,10,0.65)]">
        <p className="text-sm text-white/70">Brak danych o bonusach.</p>
      </div>
    )
  }

  return (
    <aside className="w-full rounded-[32px] border border-white/10 bg-[rgba(16,18,34,0.94)] px-6 py-6 text-white shadow-[0_25px_60px_rgba(5,5,10,0.65)] lg:min-w-[360px] lg:max-w-[480px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <div className="text-sm uppercase tracking-[0.32em] text-white/70">Bonusy</div>
          <div className="text-lg font-semibold">{current.title}</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-white/70 text-xs uppercase tracking-wide">Pula</div>
          <div className="text-xl font-bold text-white">{formatCurrency(current.prize)}</div>
        </div>
      </div>

      {quizzes.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quizzes.map((quiz) => (
            <button
              key={quiz.quizId}
              onClick={() => setActiveId(quiz.quizId)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition',
                quiz.quizId === current.quizId ? 'bg-[hsl(var(--accent))] text-slate-950' : 'bg-white/10 text-white/70 hover:bg-white/15',
              )}
            >
              {quiz.label || quiz.title}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-4 text-sm leading-relaxed text-white/80">
        <div className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 text-white/60 flex-shrink-0" />
          <p>
            Odpowiadasz na <strong>6 pytań</strong>. Po zakończeniu spotkań automatycznie uzupełniamy wyniki, liczymy
            <strong className="ml-1">total_correct</strong> i dzielimy pulę między zwycięzców danego progu. Im więcej trafień, tym wyższa nagroda.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10">
          <div className="grid grid-cols-[1fr,auto] gap-2 border-b border-white/15 px-4 py-2 text-xs uppercase tracking-wide text-white/60">
            <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> Trafienia</span>
            <span>Pula</span>
          </div>
          {current.brackets.length === 0 ? (
            <div className="px-4 py-3 text-sm text-white/70">Brak zdefiniowanych progów.</div>
          ) : (
            current.brackets.map((row) => (
              <div
                key={`${current.quizId}-${row.correct_answers}`}
                className="grid grid-cols-[1fr,auto] gap-2 px-4 py-2 text-sm text-white border-b border-white/5 last:border-b-0"
              >
                <span>{row.correct_answers} poprawnych</span>
                <span className="font-semibold">{formatCurrency(row.pool)}</span>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-white/60">
          Każdy próg dzielimy po równo pomiędzy graczy z tym samym wynikiem. Możesz zgarnąć kilka progów jednocześnie, jeśli trafisz więcej odpowiedzi.
        </p>
      </div>
    </aside>
  )
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString('pl-PL')} zł`
}
