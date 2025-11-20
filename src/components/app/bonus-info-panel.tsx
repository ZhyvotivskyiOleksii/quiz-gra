"use client";

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Flame, Info, Sparkles } from 'lucide-react'

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
  const eligibleBrackets = (current?.brackets || []).filter((row) => Number(row.correct_answers) >= 5)

  if (!current) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-[rgba(16,18,34,0.94)] px-5 py-6 text-white shadow-[0_25px_60px_rgba(5,5,10,0.65)]">
        <p className="text-sm text-white/70">Brak danych o bonusach.</p>
      </div>
    )
  }

  return (
    <aside className="relative w-full overflow-hidden rounded-[40px] border border-white/5 bg-white/5/15 px-6 py-6 text-white shadow-[0_25px_65px_rgba(3,4,15,0.45)] backdrop-blur-sm lg:min-w-[360px] lg:max-w-[480px]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(147,51,234,0.25),transparent_70%)] blur-[100px]" />
        <div className="absolute bottom-[-40px] right-[-30px] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.25),transparent_75%)] blur-[100px]" />
      </div>
      <div className="relative flex items-center justify-between border-b border-white/10 pb-6">
        <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-10 opacity-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon/Rectangle.svg" alt="" className="h-full w-full object-contain" />
        </div>
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

      <div className="relative mt-4 space-y-4 text-sm leading-relaxed text-white/85">
        <div className="rounded-2xl bg-gradient-to-r from-[#ff8a4c]/50 via-[#8b5cf6]/50 to-[#22d3ee]/50 p-[1px] shadow-[0_15px_40px_rgba(0,0,0,0.45)]">
          <div className="flex items-start gap-3 rounded-[22px] bg-[#0f1326]/95 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80">
              <Info className="h-4 w-4" />
            </div>
            <p>
              Odpowiadasz na <strong>6 pytań</strong>. Po zakończeniu spotkań automatycznie uzupełniamy wyniki, liczymy
              <strong className="ml-1">total_correct</strong> i dzielimy pulę między zwycięzców danego progu. Im więcej trafień, tym wyższa nagroda.
            </p>
          </div>
        </div>
        <div className="rounded-[32px] border border-white/10 bg-white/5/20 px-1 py-1">
          <div className="grid grid-cols-[1fr,auto] gap-2 rounded-[30px] px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70">
            <span className="font-semibold text-white/80">Trafienia</span>
            <span className="text-right text-white/60">Pula</span>
          </div>
          {eligibleBrackets.length === 0 ? (
            <div className="px-4 py-3 text-sm text-white/70">Brak zdefiniowanych progów.</div>
          ) : (
            eligibleBrackets.map((row, idx) => (
              <div
                key={`${current.quizId}-${row.correct_answers}`}
                className="grid grid-cols-[1fr,auto] items-center gap-2 border-t border-white/10 px-4 py-3 text-sm text-white first:border-t-0"
              >
                <span className="flex items-center gap-3 text-white/90">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full shadow-[0_8px_18px_rgba(0,0,0,0.3)]',
                      rowAccent(idx),
                    )}
                  >
                    <Flame className="h-3.5 w-3.5 text-white" />
                  </span>
                  {row.correct_answers} poprawnych
                </span>
                <span className="text-right font-semibold">{formatCurrency(row.pool)}</span>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-white/70">
          Każdy próg dzielimy po równo pomiędzy graczy z tym samym wynikiem. Możesz zgarnąć kilka progów jednocześnie, jeśli trafisz więcej odpowiedzi.
        </p>
      </div>
    </aside>
  )
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString('pl-PL')} zł`
}

function rowAccent(index: number) {
  const palettes = [
    'bg-gradient-to-br from-[#fb7185] via-[#f97316] to-[#fde68a]',
    'bg-gradient-to-br from-[#34d399] via-[#22d3ee] to-[#818cf8]',
    'bg-gradient-to-br from-[#a855f7] via-[#ec4899] to-[#f43f5e]',
    'bg-gradient-to-br from-[#facc15] via-[#fb923c] to-[#f472b6]',
  ]
  return palettes[index % palettes.length]
}
