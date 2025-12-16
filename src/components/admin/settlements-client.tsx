'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { RefreshCcw, Loader2, AlertTriangle } from 'lucide-react'
import type { AdminSettlementRow, PendingSettlementTarget } from '@/lib/admin/fetchSettlements'

type SettlementsClientProps = {
  initialRows: AdminSettlementRow[]
  initialPending: PendingSettlementTarget[]
}

type SettlementsResponse = {
  ok?: boolean
  rows?: AdminSettlementRow[]
  pending?: PendingSettlementTarget[]
}

type QuizSettlementSummary = {
  quizId: string
  quizTitle: string
  processed: number
  winners: number
  totalPrize: number
  topPoints: number | null
  settledAt: string | null
}

export function SettlementsClient({ initialRows, initialPending }: SettlementsClientProps) {
  const [rows, setRows] = React.useState<AdminSettlementRow[]>(initialRows)
  const [pending, setPending] = React.useState<PendingSettlementTarget[]>(initialPending)
  const [settling, setSettling] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [singleSettling, setSingleSettling] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  const numberFormatter = React.useMemo(() => new Intl.NumberFormat('pl-PL'), [])
  const currencyFormatter = React.useMemo(
    () => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )
  const summaries = React.useMemo(() => summarizeSettlements(rows), [rows])

  const loadSettlements = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/admin/settlements', { credentials: 'include' })
      if (!resp.ok) {
        throw new Error('Nie udało się pobrać rozliczeń')
      }
      const payload = (await resp.json()) as SettlementsResponse
      if (!payload?.ok || !Array.isArray(payload.rows)) {
        throw new Error('Nie udało się pobrać rozliczeń')
      }
      setRows(payload.rows)
      setPending(Array.isArray(payload.pending) ? payload.pending : [])
      return payload
    } catch (err) {
      console.error('Failed to load settlements', err)
      toast({
        title: 'Nie udało się pobrać rozliczeń',
        description: 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleAutoSettle = React.useCallback(async () => {
    console.log('[AutoSettle] Starting auto-settle all quizzes')
    setSettling(true)
    try {
      const res = await fetch('/api/admin/auto-settle-session', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      console.log('[AutoSettle] Response:', { status: res.status, data })
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to settle quizzes')
      }

      const summary = {
        attempted: data.attempted || 0,
        settled: Array.isArray(data.settled) ? data.settled.length : 0,
        skipped: Array.isArray(data.skipped) ? data.skipped : [],
      }
      
      console.log('[AutoSettle] Summary:', summary)

      let description = ''
      if (summary.settled > 0) {
        description = `Zamknięto ${summary.settled} quiz${summary.settled === 1 ? '' : 'ów'}.`
        if (summary.skipped.length > 0) {
          description += ` Pominęto ${summary.skipped.length} (sprawdź konsolę).`
        }
      } else {
        description = 'Sprawdź, czy deadline minął oraz czy pytania future mają ustawione wyniki.'
        if (summary.skipped.length > 0) {
          console.log('[AutoSettle] Skipped reasons:', summary.skipped)
        }
      }

      toast({
        title: summary.settled ? 'Rozliczono quizy' : 'Brak quizów do rozliczenia',
        description,
      })

      // Wait a bit for database to update, then reload settlements
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadSettlements()
    } catch (err: any) {
      console.error('[AutoSettle] Error:', err)
      toast({
        title: 'Błąd rozliczenia',
        description: err?.message || 'Nie udało się rozliczyć quizów',
        variant: 'destructive',
      })
    } finally {
      setSettling(false)
    }
  }, [toast, loadSettlements])

  const handleManualSettle = React.useCallback(
    async (quizId: string) => {
      console.log('[Settlement] Starting manual settle for quiz:', quizId)
      setSingleSettling(quizId)
      try {
        const resp = await fetch('/api/admin/settlements', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizId }),
        })
        const data = await resp.json().catch(() => ({}))
        console.log('[Settlement] Response:', { status: resp.status, data })
        
        if (!resp.ok || !data?.ok) {
          const errorMessage = data?.message || data?.error || 'Nie udało się rozliczyć quizu'
          if (data?.error === 'pending_future_questions') {
            throw new Error('Nie wszystkie pytania "future" mają ustawione wyniki. Najpierw rozstrzygnij mecze.')
          }
          throw new Error(errorMessage)
        }
        toast({ title: 'Quiz rozliczony', description: 'Wyniki zostały przeliczone.' })
        await loadSettlements()
      } catch (err: any) {
        console.error('[Settlement] Error:', err)
        toast({
          title: 'Błąd rozliczenia',
          description: err?.message || 'Nie udało się rozliczyć quizu',
          variant: 'destructive',
        })
      } finally {
        setSingleSettling(null)
      }
    },
    [toast, loadSettlements],
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quizy oczekujące na rozliczenie</CardTitle>
              <CardDescription>Rundy po deadlinie, które nadal mają status „draft/published”.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak rund do rozliczenia.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((quiz) => {
                const deadlineLabel =
                  quiz.deadline_at && hydrated
                    ? formatDistanceToNow(new Date(quiz.deadline_at), { addSuffix: true, locale: pl })
                    : quiz.deadline_at ?? '—'
                const futureResolved = quiz.future_total - quiz.future_pending
                const futureStatus =
                  quiz.future_total > 0 ? `${futureResolved}/${quiz.future_total} rozstrzygniętych` : 'Brak pytań przyszłościowych'
                return (
                  <div key={quiz.quiz_id} className="rounded-xl border border-white/10 bg-card/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{quiz.quiz_title}</div>
                        <div className="text-xs text-muted-foreground">
                          Runda: {quiz.round_label || '—'} • Deadline: {deadlineLabel}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                            {futureStatus}
                          </span>
                          <span>Zgłoszenia: {quiz.submissions}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary/20 text-primary-foreground/80">
                          {quiz.round_status ?? 'draft'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-2"
                          disabled={settling || loading || singleSettling === quiz.quiz_id}
                          onClick={() => handleManualSettle(quiz.quiz_id)}
                        >
                          {singleSettling === quiz.quiz_id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Rozliczamy…
                            </>
                          ) : (
                            'Rozlicz teraz'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rozliczenia</CardTitle>
              <CardDescription>Ostatnie rozstrzygnięcia quizów i wypłaty nagród.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSettlements}
                disabled={loading || settling}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Odśwież
              </Button>
              <Button
                variant="secondary"
                onClick={handleAutoSettle}
                disabled={settling || loading}
                className="gap-2"
              >
                {settling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rozliczam…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Rozlicz wszystkie
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak jeszcze rozliczonych quizów.</p>
          ) : (
            <div className="space-y-3">
              {summaries.map((summary) => {
                const settledAgo =
                  summary.settledAt && hydrated
                    ? formatDistanceToNow(new Date(summary.settledAt), { addSuffix: true, locale: pl })
                    : summary.settledAt
                      ? new Date(summary.settledAt).toLocaleString('pl-PL')
                      : '—'
                return (
                  <div key={summary.quizId} className="rounded-xl border border-white/10 bg-card/80 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{summary.quizTitle}</div>
                        <div className="text-xs text-muted-foreground">Rozliczono {settledAgo}</div>
                      </div>
                      <Badge className="bg-primary/20 text-primary-foreground/80">
                        Wygrani: {numberFormatter.format(summary.winners)}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <SummaryStat label="Zgłoszenia" value={numberFormatter.format(summary.processed)} />
                      <SummaryStat label="Przegrani" value={numberFormatter.format(summary.processed - summary.winners)} />
                      <SummaryStat
                        label="Suma nagród"
                        value={`${currencyFormatter.format(summary.totalPrize ?? 0)} zł`}
                      />
                      <SummaryStat
                        label="Najlepszy wynik"
                        value={
                          typeof summary.topPoints === 'number'
                            ? `${numberFormatter.format(summary.topPoints)} pkt`
                            : '—'
                        }
                      />
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

function summarizeSettlements(rows: AdminSettlementRow[]): QuizSettlementSummary[] {
  const map = new Map<string, QuizSettlementSummary>()
  rows.forEach((row) => {
    if (!row.quiz_id) return
    const key = row.quiz_id
    const summary =
      map.get(key) ??
      {
        quizId: key,
        quizTitle: row.quizzes?.title ?? 'Quiz',
        processed: 0,
        winners: 0,
        totalPrize: 0,
        topPoints: null,
        settledAt: row.submitted_at ?? null,
      }

    summary.processed += 1
    if ((row.prize_awarded ?? 0) > 0) {
      summary.winners += 1
    }
    summary.totalPrize += row.prize_awarded ?? 0
    if (typeof row.points === 'number') {
      summary.topPoints = summary.topPoints === null ? row.points : Math.max(summary.topPoints, row.points)
    }
    if (!summary.settledAt || (row.submitted_at && row.submitted_at > summary.settledAt)) {
      summary.settledAt = row.submitted_at
    }
    map.set(key, summary)
  })

  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.settledAt ? Date.parse(a.settledAt) : 0
    const bTime = b.settledAt ? Date.parse(b.settledAt) : 0
    return bTime - aTime
  })
}

function SummaryStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
