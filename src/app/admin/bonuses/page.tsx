"use client";
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import NotchedInput from '@/components/ui/notched-input'
import { cn } from '@/lib/utils'
import {
  seedPrizeBrackets,
  generateBracketRowId,
  sumPrizePools,
  normalizePrizeBrackets,
  matchesDefaultBracketStructure,
  distributePrizeByDefaultRatios,
  type PrizeBracketRow,
} from '@/lib/prizeBrackets'

type QuizSummary = {
  id: string
  title: string
  prize: number | null
  rounds?: { label?: string | null } | null
}

export default function BonusesPage() {
  const searchParams = useSearchParams()
  const [quizzes, setQuizzes] = React.useState<QuizSummary[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const selectedIdRef = React.useRef<string | null>(null)
  const [brackets, setBrackets] = React.useState<PrizeBracketRow[]>(seedPrizeBrackets())
  const [loadingBrackets, setLoadingBrackets] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const prizeTotal = React.useMemo(() => sumPrizePools(brackets), [brackets])
  const queryQuizId = searchParams?.get('quiz')
  const selectedQuiz = quizzes.find((q) => q.id === selectedId) || null

  const loadQuizzes = React.useCallback(async () => {
    setLoadingQuizzes(true)
    setError(null)
    try {
      const s = getSupabase()
      const { data, error: qErr } = await s
        .from('quizzes')
        .select('id,title,prize,rounds(label)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (qErr) throw qErr
      const typed = (data || []) as QuizSummary[]
      setQuizzes(typed)
      setSelectedId((current) => {
        if (!typed.length) return null
        if (queryQuizId && typed.some((quiz) => quiz.id === queryQuizId)) {
          return queryQuizId
        }
        if (current && typed.some((quiz) => quiz.id === current)) {
          return current
        }
        return typed[0].id
      })
      if (!typed.length) {
        setBrackets(seedPrizeBrackets())
        setLoadingBrackets(false)
      }
    } catch (err: any) {
      setError(err?.message || 'Nie udało się pobrać wiktoryn')
    } finally {
      setLoadingQuizzes(false)
    }
  }, [queryQuizId])

  const loadBrackets = React.useCallback(async (quizId: string, quizContext?: QuizSummary | null) => {
    setLoadingBrackets(true)
    try {
      const s = getSupabase()
      const { data, error: bErr } = await s
        .from('quiz_prize_brackets')
        .select('id,correct_answers,pool')
        .eq('quiz_id', quizId)
        .order('correct_answers', { ascending: true })
      if (bErr) throw bErr
      const rows = (data || []).map((row: any) => ({
        id: row.id || generateBracketRowId(),
        correct: Number(row.correct_answers) || 0,
        pool: Number(row.pool) || 0,
      }))
      if (selectedIdRef.current !== quizId) return
      if (rows.length) {
        setBrackets(rows)
        return
      }
      const seeded = seedPrizeBrackets()
      const total = quizContext?.prize ?? quizzes.find((q) => q.id === quizId)?.prize ?? 0
      setBrackets(total > 0 ? distributePrizeByDefaultRatios(seeded, total) : seeded)
    } catch (err: any) {
      if (selectedIdRef.current === quizId) {
        setError(err?.message || 'Nie udało się pobrać bonusów')
      }
    } finally {
      if (selectedIdRef.current === quizId) {
        setLoadingBrackets(false)
      }
    }
  }, [quizzes])

  React.useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  React.useEffect(() => {
    loadQuizzes()
  }, [loadQuizzes])

  React.useEffect(() => {
    if (!queryQuizId) return
    setSelectedId((current) => {
      if (current === queryQuizId) return current
      return quizzes.some((quiz) => quiz.id === queryQuizId) ? queryQuizId : current
    })
  }, [queryQuizId, quizzes])

  React.useEffect(() => {
    if (!selectedQuiz) {
      setMessage(null)
      setError(null)
      setLoadingBrackets(false)
      return
    }
    setMessage(null)
    setError(null)
    loadBrackets(selectedQuiz.id, selectedQuiz)
  }, [selectedQuiz, loadBrackets])

  function addBracketRow() {
    setBrackets((prev) => [
      ...prev,
      {
        id: generateBracketRowId(),
        correct: (prev[prev.length - 1]?.correct ?? 1) + 1,
        pool: 0,
      },
    ])
  }

  function updateBracketRow(id: string, field: keyof Omit<PrizeBracketRow, 'id'>, value: number) {
    setBrackets((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  function removeBracketRow(id: string) {
    setBrackets((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)))
  }

  React.useEffect(() => {
    if (!selectedQuiz) return
    const total = selectedQuiz.prize ?? 0
    if (!Number.isFinite(total) || total <= 0) return
    setBrackets((prev) => {
      if (!matchesDefaultBracketStructure(prev)) return prev
      const next = distributePrizeByDefaultRatios(prev, total)
      const changed = next.some((row, idx) => row.pool !== prev[idx].pool)
      return changed ? next : prev
    })
  }, [selectedQuiz?.id, selectedQuiz?.prize])

  async function save() {
    if (!selectedQuiz) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = normalizePrizeBrackets(brackets)
      if (!payload.length) throw new Error('Dodaj co najmniej jeden próg z dodatnią pulą.')
      const s = getSupabase()
      await s.from('quiz_prize_brackets').delete().eq('quiz_id', selectedQuiz.id)
      const { error: insErr } = await s
        .from('quiz_prize_brackets')
        .insert(payload.map((row) => ({ quiz_id: selectedQuiz.id, ...row })) as any)
      if (insErr) throw insErr
      await loadBrackets(selectedQuiz.id, selectedQuiz)
      setMessage('Zapisano progi nagród')
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać bonusów')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-extrabold uppercase">Bonusy</h1>
        <p className="text-sm text-muted-foreground">Zarządzaj pulami nagród dla każdej wiktoryny.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">
        <Card className="max-h-[70vh] overflow-hidden">
          <CardHeader>
            <CardTitle>Wiktoryny</CardTitle>
            <CardDescription>Wybierz wiktorynę, aby edytować bonusy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
            {loadingQuizzes && <div className="text-sm text-muted-foreground">Ładowanie…</div>}
            {!loadingQuizzes && quizzes.length === 0 && (
              <div className="text-sm text-muted-foreground">Brak wiktoryn.</div>
            )}
            {quizzes.map((quiz) => {
              const isActive = selectedId === quiz.id
              return (
                <button
                  key={quiz.id}
                  onClick={() => setSelectedId(quiz.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-left transition',
                    isActive ? 'border-emerald-400 bg-emerald-500/10' : 'border-border/40 bg-muted/30 hover:border-emerald-400',
                  )}
                >
                  <div className="text-sm font-semibold text-foreground">{quiz.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {quiz.rounds?.label || '—'} • {quiz.prize ? `${quiz.prize.toLocaleString('pl-PL')} zł` : 'brak puli'}
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="min-h-[400px]">
          <CardHeader>
            <CardTitle>Konfiguracja bonusów</CardTitle>
            <CardDescription>
              {selectedQuiz ? (
                <>
                  Wiktoryna: <strong>{selectedQuiz.title}</strong>
                  {selectedQuiz.rounds?.label ? ` • ${selectedQuiz.rounds.label}` : ''}
                </>
              ) : (
                'Wybierz wiktorynę po lewej stronie'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</div>}
            {message && <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{message}</div>}
            {!selectedQuiz ? (
              <p className="text-sm text-muted-foreground">Wybierz wiktorynę, aby edytować bonusy.</p>
            ) : loadingBrackets ? (
              <div className="text-sm text-muted-foreground">Ładowanie bonusów…</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Suma pul: <span className="font-semibold text-white">{prizeTotal.toLocaleString('pl-PL')} zł</span>
                  </span>
                  {typeof selectedQuiz.prize === 'number' && selectedQuiz.prize > 0 && (
                    <span>
                      Pula wiktoryny: <span className="font-semibold text-white">{selectedQuiz.prize.toLocaleString('pl-PL')} zł</span>
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {brackets.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,1fr,auto]">
                      <NotchedInput
                        borderless
                        type="number"
                        label={`Poprawnych odpowiedzi #${idx + 1}`}
                        value={String(row.correct ?? '')}
                        onChange={(e:any)=>updateBracketRow(row.id, 'correct', Number(e.target.value ?? 0))}
                      />
                      <NotchedInput
                        borderless
                        type="number"
                        label={'Pula (zł)'}
                        value={String(row.pool ?? '')}
                        onChange={(e:any)=>updateBracketRow(row.id, 'pool', Number(e.target.value ?? 0))}
                      />
                      <div className="flex items-end justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-muted-foreground hover:text-white"
                          onClick={()=>removeBracketRow(row.id)}
                          disabled={brackets.length <= 1}
                        >
                          Usuń
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addBracketRow}>
                    Dodaj próg
                  </Button>
                  <Button type="button" size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Zapisuję…' : 'Zapisz progi nagród'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
