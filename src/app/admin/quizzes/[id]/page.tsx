"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import NotchedInput from '@/components/ui/notched-input'
import { DateTimeField } from '@/components/ui/datetime-field'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import ImageUploader from '@/components/admin/image-uploader'
import { sumPrizePools, type PrizeBracketRow } from '@/lib/prizeBrackets'

const FUTURE_STAT_KINDS = ['future_yellow_cards', 'future_corners'] as const
type FutureStatKind = (typeof FUTURE_STAT_KINDS)[number]
const FUTURE_STAT_DEFAULTS: Record<FutureStatKind, { prompt: string; numeric: { min: number; max: number; step: number } }> = {
  future_yellow_cards: {
    prompt: 'Ile żółtych kartek padnie w meczu?',
    numeric: { min: 0, max: 12, step: 1 },
  },
  future_corners: {
    prompt: 'Ile rzutów rożnych zobaczymy w meczu?',
    numeric: { min: 0, max: 20, step: 1 },
  },
}

type QuizRow = { id: string; title: string; round_id: string }
type RoundRow = {
  id: string; label: string; starts_at: string | null; deadline_at: string | null; timezone: string | null; status: 'draft'|'published'|'locked'|'settled';
  leagues?: { name?: string | null, code?: string | null } | null
}

export default function AdminQuizDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const router = useRouter()
  const [quiz, setQuiz] = React.useState<QuizRow | null>(null)
  const [round, setRound] = React.useState<RoundRow | null>(null)
  const [title, setTitle] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [startsAt, setStartsAt] = React.useState('')
  const [deadlineAt, setDeadlineAt] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [cardImage, setCardImage] = React.useState('')
  React.useEffect(() => {
    if (!imageUrl) {
      if (!cardImage || cardImage.startsWith('blob:')) return
      setCardImage('')
      return
    }
    if (cardImage === imageUrl) return
    if (cardImage && cardImage.startsWith('blob:')) return
    setCardImage(imageUrl)
  }, [imageUrl])
  const [prize, setPrize] = React.useState<string>('')
  const [prizeBrackets, setPrizeBrackets] = React.useState<PrizeBracketRow[]>([])
  const [saving, setSaving] = React.useState(false)
  // Questions state
  const [qs, setQs] = React.useState<any[]>([])
  const [qLoading, setQLoading] = React.useState(true)
  const [qKind, setQKind] = React.useState<'history_single'|'history_numeric'|'future_1x2'|'future_score'|FutureStatKind>('history_single')
  const [qPrompt, setQPrompt] = React.useState(defaultPrompt('history_single'))
  const [qOptions, setQOptions] = React.useState<string[]>([''])
  const [matches, setMatches] = React.useState<any[]>([])
  const [editing, setEditing] = React.useState<string | null>(null)
  const [editData, setEditData] = React.useState<any>({})
  const [showAddForm, setShowAddForm] = React.useState(false)
  const prizeBracketsTotal = React.useMemo(() => sumPrizePools(prizeBrackets), [prizeBrackets])
  const [settling, setSettling] = React.useState(false)
  const [historyAutoLoading, setHistoryAutoLoading] = React.useState(false)
  React.useEffect(() => {
    if (shouldLockPrompt(qKind)) {
      setQPrompt(defaultPrompt(qKind))
    }
  }, [qKind])

  async function load() {
    const s = getSupabase()
    const { data: q, error: qerr } = await s.from('quizzes').select('id,title,round_id,image_url,prize').eq('id', id).maybeSingle()
    if (qerr || !q) { toast({ title: 'Nie znaleziono wiktoryny', variant: 'destructive' as any }); return }
    setQuiz(q as QuizRow)
    setTitle((q as any).title || '')
    const initialImage = (q as any).image_url || ''
    setImageUrl(initialImage)
    setCardImage(initialImage)
    setPrize(((q as any).prize ?? '') as any)
    const { data: r } = await s.from('rounds').select('id,label,starts_at,deadline_at,timezone,status,leagues(name,code)').eq('id', (q as any).round_id).maybeSingle()
    if (r) {
      setRound(r as any)
      setLabel((r as any).label || '')
      setStartsAt((r as any).starts_at ? (r as any).starts_at.substring(0,16) : '')
      setDeadlineAt((r as any).deadline_at ? (r as any).deadline_at.substring(0,16) : '')
    }
    await loadPrizeBracketsData((q as any).id)
  }

  React.useEffect(() => { load() }, [id])
  React.useEffect(() => { loadQuestions() }, [quiz?.id])
  React.useEffect(() => { loadMatches() }, [round?.id])

  const handlePrizeChange = React.useCallback((value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '')
    setPrize(sanitized)
  }, [])

  async function loadQuestions() {
    if (!id) return
    setQLoading(true)
    try {
      const s = getSupabase()
      const { data } = await s
        .from('quiz_questions')
        .select('id,kind,prompt,options,order_index,match_id,correct')
        .eq('quiz_id', id)
        .order('order_index', { ascending: true })
      setQs(data || [])
    } finally { setQLoading(false) }
  }

  async function loadMatches() {
    if (!round?.id) return
    try {
      const s = getSupabase()
      const { data } = await s
        .from('matches')
        .select('id,home_team,away_team,kickoff_at')
        .eq('round_id', round.id)
        .order('kickoff_at', { ascending: true })
      setMatches(data || [])
    } catch {}
  }

  async function loadPrizeBracketsData(quizId: string) {
    try {
      const s = getSupabase()
      const { data } = await s
        .from('quiz_prize_brackets')
        .select('id,correct_answers,pool')
        .eq('quiz_id', quizId)
        .order('correct_answers', { ascending: true })
      const rows =
        (data || []).map((row: any, idx: number) => ({
          id: row.id || `bracket-${idx}-${row.correct_answers}`,
          correct: Number(row.correct_answers) || 0,
          pool: Number(row.pool) || 0,
        })) || []
      setPrizeBrackets(rows)
    } catch {
      setPrizeBrackets([])
    }
  }

  async function saveBasics() {
    if (!quiz || !round) return
    setSaving(true)
    try {
      const s = getSupabase()
      if (title !== quiz.title || imageUrl || prize !== '') {
        const upd: any = { title }
        if (imageUrl !== undefined) upd.image_url = imageUrl || null
        if (prize !== '') upd.prize = Number(prize)
        const { error } = await s.from('quizzes').update(upd).eq('id', quiz.id)
        if (error) throw error
      }
      const upd: any = {}
      if (label !== round.label) upd.label = label
      // Normalize to ISO without seconds; Supabase accepts both
      if (startsAt) upd.starts_at = startsAt
      if (deadlineAt) upd.deadline_at = deadlineAt
      if (Object.keys(upd).length) {
        const { error } = await s.from('rounds').update(upd).eq('id', round.id)
        if (error) throw error
      }
      toast({ title: 'Zapisano zmiany' })
      await load()
    } catch (e: any) {
      toast({ title: 'Błąd zapisu', description: e?.message ?? '', variant: 'destructive' as any })
    } finally { setSaving(false) }
  }

  async function togglePublish() {
    if (!round) return
    // Przy publikacji sprawdzamy, czy quiz ma co najmniej 3 pytania historyczne i 3 przyszłościowe
    if (round.status !== 'published') {
      const historyCount = qs.filter((q:any) => q.kind?.startsWith('history_')).length
      const futureCount = qs.filter((q:any) => q.kind?.startsWith('future_')).length
      if (historyCount < 3 || futureCount < 3) {
        toast({
          title: 'Za mało pytań w quizie',
          description: 'Dodaj co najmniej 3 pytania historyczne i 3 pytania dotyczące przyszłości przed publikacją.',
          variant: 'destructive' as any,
        })
        return
      }
    }
    setSaving(true)
    try {
      const s = getSupabase()
      const next = round.status === 'published' ? 'draft' : 'published'
      const { error } = await s.from('rounds').update({ status: next }).eq('id', round.id)
      if (error) throw error
      toast({ title: next === 'published' ? 'Opublikowano' : 'Wycofano publikację' })
      await load()
    } catch (e: any) {
      toast({ title: 'Błąd zmiany statusu', description: e?.message ?? '', variant: 'destructive' as any })
    } finally { setSaving(false) }
  }

  async function settleQuizScores() {
    if (!quiz) return
    setSettling(true)
    try {
      const s = getSupabase()
      const { error } = await s.rpc('settle_quiz', { p_quiz: quiz.id })
      if (error) throw error
      toast({ title: 'Wyniki zostały przeliczone' })
    } catch (e: any) {
      toast({ title: 'Błąd rozliczenia', description: e?.message ?? '', variant: 'destructive' as any })
    } finally {
      setSettling(false)
    }
  }

  // --- Questions helpers ---
  function resetNewQ() {
    setQKind('history_single')
    setQPrompt(defaultPrompt('history_single'))
    setQOptions([''])
  }
  function updateOption(i: number, v: string) {
    setQOptions((prev) => prev.map((x, idx) => (idx === i ? v : x)))
  }
  function removeOption(i: number) {
    setQOptions((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function addQuestion() {
    try {
      const s = getSupabase()
      let options: any = null
      if (qKind === 'history_single' || qKind === 'future_1x2') {
        const opts = (qOptions || []).map((o) => o.trim()).filter(Boolean)
        if (!opts.length) {
          if (qKind === 'future_1x2') options = ['Gospodarze', 'Remis', 'Goście']
          else return toast({ title: 'Dodaj co najmniej jedną opcję', variant: 'destructive' as any })
        } else options = opts
      }
      if (qKind === 'history_numeric') {
        options = getDefaultNumericOptions('history_numeric')
      }
      const order = (qs[qs.length - 1]?.order_index ?? -1) + 1
      const { error } = await s.from('quiz_questions').insert({
        quiz_id: id,
        kind: qKind,
        prompt: qPrompt,
        options,
        order_index: order,
        match_id: null,
      } as any)
      if (error) throw error
      resetNewQ()
      await loadQuestions()
      toast({ title: 'Dodano pytanie' })
    } catch (e: any) {
      toast({ title: 'Błąd', description: e?.message ?? '', variant: 'destructive' as any })
    }
  }

  async function addQuestionWithMatch() {
    // Wraps addQuestion to append selected match from editor state on create form
    if (qKind === 'future_1x2' || qKind === 'future_score' || isFutureStatKind(qKind)) {
      const mId = (editData as any)?.new_match_id || null
      if (!mId) {
        toast({ title: 'Wybierz mecz dla pytania', variant: 'destructive' as any })
        return
      }
      try {
        const s = getSupabase()
        const order = (qs[qs.length - 1]?.order_index ?? -1) + 1
        let options: any = null
        if (qKind === 'history_single' || qKind === 'future_1x2') {
          const opts = (qOptions || []).map((o) => o.trim()).filter(Boolean)
          options = opts.length ? opts : (qKind === 'future_1x2' ? ['1','X','2'] : null)
        }
        if (isFutureStatKind(qKind)) {
          options = getDefaultNumericOptions(qKind)
        }
        if (qKind === 'future_score') {
          options = { min_home: 0, max_home: 10, min_away: 0, max_away: 10 }
        }
        const promptValue = shouldLockPrompt(qKind) ? defaultPrompt(qKind) : qPrompt
        const { error } = await s.from('quiz_questions').insert({
          quiz_id: id,
          kind: qKind,
          prompt: promptValue,
          options,
          order_index: order,
          match_id: mId,
        } as any)
        if (error) throw error
        setEditData((d:any)=>({ ...d, new_match_id: '' }))
        resetNewQ()
        await loadQuestions()
        toast({ title: 'Dodano pytanie' })
      } catch (e:any) {
        toast({ title: 'Błąd', description: e?.message ?? '', variant: 'destructive' as any })
      }
      return
    }
    await addQuestion()
  }

  async function autoFillHistoryQuestions(amount = 3) {
    if (!quiz) return
    setHistoryAutoLoading(true)
    try {
      const res = await fetch('/api/admin/history-bank/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id, limit: amount }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Nie udało się wylosować pytań historycznych.')
      }
      toast({ title: `Dodano ${payload.inserted ?? amount} pytań historycznych` })
      await loadQuestions()
    } catch (err: any) {
      toast({ title: 'Błąd losowania', description: err?.message ?? '', variant: 'destructive' as any })
    } finally {
      setHistoryAutoLoading(false)
    }
  }

  function startEdit(q:any) {
    setEditing(q.id)
    const def: any = { prompt: shouldLockPrompt(q.kind) ? defaultPrompt(q.kind) : q.prompt, match_id: q.match_id || '' }
    if (q.kind === 'history_numeric' && q.options) {
      def.min = q.options?.min ?? 0
      def.max = q.options?.max ?? 6
      def.step = q.options?.step ?? 1
    }
    if (isFutureStatKind(q.kind) && q.options) {
      def.min = q.options?.min ?? getDefaultNumericOptions(q.kind).min
      def.max = q.options?.max ?? getDefaultNumericOptions(q.kind).max
      def.step = q.options?.step ?? 1
    }
    if (q.kind === 'future_score' && q.options) {
      def.min_home = q.options?.min_home ?? 0
      def.max_home = q.options?.max_home ?? 10
      def.min_away = q.options?.min_away ?? 0
      def.max_away = q.options?.max_away ?? 10
    }
    if (q.kind === 'future_1x2') {
      def.correct_choice = (q.correct as any) ?? ''
    }
    if (q.kind === 'future_score' && q.correct) {
      def.correct_home = (q.correct as any).home ?? ''
      def.correct_away = (q.correct as any).away ?? ''
    }
    setEditData(def)
  }

  async function saveEdit(idQ: string, kind: string) {
    try {
      const s = getSupabase()
      const upd: any = { prompt: shouldLockPrompt(kind) ? defaultPrompt(kind) : editData.prompt }
      if (kind === 'future_1x2' || kind === 'future_score' || isFutureStatKind(kind)) upd.match_id = editData.match_id || null
      if (kind === 'history_numeric') upd.options = { min: Number(editData.min ?? 0), max: Number(editData.max ?? 6), step: Number(editData.step ?? 1) }
      if (isFutureStatKind(kind)) {
        const defaults = getDefaultNumericOptions(kind)
        upd.options = {
          min: Number(editData.min ?? defaults.min),
          max: Number(editData.max ?? defaults.max),
          step: Number(editData.step ?? defaults.step),
        }
      }
      if (kind === 'future_score') upd.options = { min_home: Number(editData.min_home ?? 0), max_home: Number(editData.max_home ?? 10), min_away: Number(editData.min_away ?? 0), max_away: Number(editData.max_away ?? 10) }
      if (kind === 'future_1x2') {
        upd.correct = editData.correct_choice || null
      }
      if (kind === 'future_score') {
        if (editData.correct_home !== undefined && editData.correct_away !== undefined) {
          upd.correct = {
            home: Number(editData.correct_home ?? 0),
            away: Number(editData.correct_away ?? 0),
          }
        }
      }
      const { error } = await s.from('quiz_questions').update(upd).eq('id', idQ)
      if (error) throw error
      setEditing(null)
      await loadQuestions()
      toast({ title: 'Zapisano pytanie' })
    } catch (e:any) {
      toast({ title: 'Błąd zapisu', description: e?.message ?? '', variant: 'destructive' as any })
    }
  }

  async function removeQuestion(idQ: string) {
    const ok = typeof window !== 'undefined' ? window.confirm('Usunąć pytanie?') : true
    if (!ok) return
    const s = getSupabase()
    await s.from('quiz_questions').delete().eq('id', idQ)
    await loadQuestions()
  }

  async function moveQuestion(idQ: string, delta: number) {
    const idx = qs.findIndex((q) => q.id === idQ)
    if (idx < 0) return
    const target = idx + delta
    if (target < 0 || target >= qs.length) return
    const a = qs[idx], b = qs[target]
    const s = getSupabase()
    await s.from('quiz_questions').update({ order_index: b.order_index }).eq('id', a.id)
    await s.from('quiz_questions').update({ order_index: a.order_index }).eq('id', b.id)
    await loadQuestions()
  }

  async function deleteQuiz() {
    if (!quiz) return
    const ok = typeof window !== 'undefined' ? window.confirm('Usunąć tę wiktorynę? Tego nie można cofnąć.') : true
    if (!ok) return
    setSaving(true)
    try {
      const s = getSupabase()
      // 1) Answers (need submission ids)
      const { data: subs } = await s.from('quiz_submissions').select('id').eq('quiz_id', quiz.id)
      const subIds = (subs || []).map((x:any) => x.id)
      if (subIds.length > 0) {
        await s.from('quiz_answers').delete().in('submission_id', subIds)
      }
      // 2) Results
      await s.from('quiz_results').delete().eq('quiz_id', quiz.id)
      // 3) Questions
      await s.from('quiz_questions').delete().eq('quiz_id', quiz.id)
      // 4) Submissions
      await s.from('quiz_submissions').delete().eq('quiz_id', quiz.id)
      // 5) Quiz itself
      await s.from('quizzes').delete().eq('id', quiz.id)
      // 6) Remove round if empty
      const { data: others } = await s.from('quizzes').select('id').eq('round_id', (quiz as any).round_id).limit(1)
      if (!others || others.length === 0) {
        await s.from('rounds').delete().eq('id', (quiz as any).round_id)
      }
      toast({ title: 'Usunięto wiktorynę' })
      router.replace('/admin/quizzes')
    } catch (e: any) {
      toast({ title: 'Błąd usuwania', description: e?.message ?? '', variant: 'destructive' as any })
    } finally { setSaving(false) }
  }

  if (!quiz || !round) {
    return (
      <div className="mx-auto w-full max-w-[900px] p-6">Ładowanie…</div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold uppercase">Quiz: {quiz.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={settleQuizScores} disabled={settling}>
            {settling ? 'Rozliczam…' : 'Przelicz wyniki'}
          </Button>
          <Button variant="outline" onClick={saveBasics} disabled={saving}>Zapisz</Button>
          <Button onClick={togglePublish} disabled={saving}>
            {round.status === 'published' ? 'Wycofaj publikację' : 'Opublikuj'}
          </Button>
          <Button variant="destructive" onClick={deleteQuiz} disabled={saving}>Usuń</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NotchedInput borderless label={'Tytuł wiktoryny'} value={title} onChange={(e:any)=>setTitle(e.target.value)} />
          <ImageUploader value={imageUrl} onChange={setImageUrl as any} onPreviewChange={setCardImage} />
          <NotchedInput
            borderless
            inputMode="numeric"
            pattern="[0-9]*"
            label={'Nagroda (zł)'}
            value={String(prize ?? '')}
            onChange={(e:any)=>handlePrizeChange(e.target.value)}
          />
          <NotchedInput borderless label={'Etykieta rundy (np. "14 kolejka")'} value={label} onChange={(e:any)=>setLabel(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateTimeField label={'Start'} value={startsAt} onChange={setStartsAt} />
            <DateTimeField label={'Deadline'} value={deadlineAt} onChange={setDeadlineAt} />
          </div>
          <div className="text-sm text-muted-foreground">Liga: {round.leagues?.name || '—'} • Status: <span className="uppercase">{round.status}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Bonusy i pule nagród</CardTitle>
              <CardDescription>Zarządzanie bonusami przeniesiono do zakładki „Bonusy”.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={()=>router.push(`/admin/bonuses?quiz=${quiz.id}`)}
            >
              Otwórz bonusy
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <span>
              Liczba progów: <span className="font-semibold text-white">{prizeBrackets.length}</span>
            </span>
            <span>
              Suma pul: <span className="font-semibold text-white">{prizeBracketsTotal.toLocaleString('pl-PL')} zł</span>
            </span>
            {prize ? (
              <span>
                Pula wiktoryny: <span className="font-semibold text-white">{Number(prize || 0).toLocaleString('pl-PL')} zł</span>
              </span>
            ) : null}
          </div>
          {prizeBrackets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              Bonusy dla tej wiktoryny nie zostały jeszcze skonfigurowane. Przejdź do zakładki „Bonusy”, aby dodać progi.
            </div>
          ) : (
            <div className="space-y-2">
              {prizeBrackets.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">≥ {row.correct} poprawnych odpowiedzi</span>
                  <span className="font-semibold text-white">{row.pool.toLocaleString('pl-PL')} zł</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Pytania</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                <span>
                  Historyczne:{' '}
                  <span className={qs.filter((q:any)=>q.kind?.startsWith('history_')).length >= 3 ? 'text-emerald-400' : 'text-amber-400'}>
                    {qs.filter((q:any)=>q.kind?.startsWith('history_')).length}/3
                  </span>
                </span>
                <span className="ml-4">
                  Przyszłościowe:{' '}
                  <span className={qs.filter((q:any)=>q.kind?.startsWith('future_')).length >= 3 ? 'text-emerald-400' : 'text-amber-400'}>
                    {qs.filter((q:any)=>q.kind?.startsWith('future_')).length}/3
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={()=>autoFillHistoryQuestions()}
                disabled={historyAutoLoading}
              >
                {historyAutoLoading ? 'Losuję…' : 'Losuj historię'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={()=>setShowAddForm((v)=>!v)}
              >
                {showAddForm ? 'Ukryj formularz' : 'Dodaj pytanie ręcznie'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* List */}
          <div className="space-y-2">
            {qLoading ? (
              <div className="text-sm text-muted-foreground">Ładowanie…</div>
            ) : qs.length === 0 ? (
              <div className="text-sm text-muted-foreground">Brak pytań. Dodaj pierwsze pytanie poniżej.</div>
            ) : (
              qs.map((q:any, idx:number) => (
                <div key={q.id} className="rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm">
                      <div className="font-medium">#{idx+1} • {kindLabel(q.kind)}</div>
                      <div className="opacity-80">{q.prompt}</div>
                      {q.kind?.startsWith('future_') && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {q.correct
                            ? q.kind === 'future_score'
                              ? <>Poprawna odpowiedź: {(q.correct as any).home}:{(q.correct as any).away}</>
                              : <>Poprawna odpowiedź: {(q.correct as any)}</>
                            : <>Poprawna odpowiedź: <span className="italic">nie ustawiono</span></>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={()=>moveQuestion(q.id, -1)} disabled={idx===0}>Góra</Button>
                      <Button size="sm" variant="secondary" onClick={()=>moveQuestion(q.id, +1)} disabled={idx===qs.length-1}>Dół</Button>
                      <Button size="sm" variant="outline" onClick={()=>startEdit(q)}>Edytuj</Button>
                      <Button size="sm" variant="destructive" onClick={()=>removeQuestion(q.id)}>Usuń</Button>
                    </div>
                  </div>
                  {editing === q.id && (
                    <div className="border-t border-border/40 px-3 py-3 space-y-3">
                      <NotchedInput
                        borderless
                        label={'Treść pytania'}
                        value={shouldLockPrompt(q.kind) ? defaultPrompt(q.kind) : editData.prompt || ''}
                        disabled={shouldLockPrompt(q.kind)}
                        onChange={(e:any)=>setEditData((d:any)=>({ ...d, prompt: e.target.value }))}
                      />
                      {(q.kind === 'future_1x2' || q.kind === 'future_score' || isFutureStatKind(q.kind)) && (
                        <div>
                          <Label>Mecz</Label>
                          <select className="mt-1 w-full rounded-md bg-muted/20 px-3 py-2 border-0 ring-0 focus:outline-none" value={editData.match_id || ''} onChange={(e)=>setEditData((d:any)=>({ ...d, match_id: e.target.value || null }))}>
                            <option value="">— wybierz mecz —</option>
                            {matches.map((m:any)=> (
                              <option key={m.id} value={m.id}>{m.home_team} vs {m.away_team} • {new Date(m.kickoff_at).toLocaleString('pl-PL')}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {q.kind === 'history_numeric' && (
                        <div className="grid grid-cols-3 gap-3">
                          <NotchedInput borderless type="number" label={'Min'} value={editData.min ?? 0} onChange={(e:any)=>setEditData((d:any)=>({ ...d, min: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Max'} value={editData.max ?? 6} onChange={(e:any)=>setEditData((d:any)=>({ ...d, max: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Krok'} value={editData.step ?? 1} onChange={(e:any)=>setEditData((d:any)=>({ ...d, step: parseInt(e.target.value||'1') }))} />
                        </div>
                      )}
                      {isFutureStatKind(q.kind) && (
                        <div className="grid grid-cols-3 gap-3">
                          <NotchedInput borderless type="number" label={'Min'} value={editData.min ?? getDefaultNumericOptions(q.kind).min} onChange={(e:any)=>setEditData((d:any)=>({ ...d, min: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Max'} value={editData.max ?? getDefaultNumericOptions(q.kind).max} onChange={(e:any)=>setEditData((d:any)=>({ ...d, max: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Krok'} value={editData.step ?? 1} onChange={(e:any)=>setEditData((d:any)=>({ ...d, step: parseInt(e.target.value||'1') }))} />
                        </div>
                      )}
                      {q.kind === 'future_score' && (
                        <div className="grid grid-cols-4 gap-3">
                          <NotchedInput borderless type="number" label={'Min (gosp.)'} value={editData.min_home ?? 0} onChange={(e:any)=>setEditData((d:any)=>({ ...d, min_home: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Max (gosp.)'} value={editData.max_home ?? 10} onChange={(e:any)=>setEditData((d:any)=>({ ...d, max_home: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Min (goście)'} value={editData.min_away ?? 0} onChange={(e:any)=>setEditData((d:any)=>({ ...d, min_away: parseInt(e.target.value||'0') }))} />
                          <NotchedInput borderless type="number" label={'Max (goście)'} value={editData.max_away ?? 10} onChange={(e:any)=>setEditData((d:any)=>({ ...d, max_away: parseInt(e.target.value||'0') }))} />
                        </div>
                      )}
                      {q.kind === 'future_1x2' && (
                        <div>
                          <Label>Poprawna odpowiedź (po meczu)</Label>
                          <div className="mt-1 flex gap-3 text-sm">
                            {['1','X','2'].map((val) => (
                              <label key={val} className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  value={val}
                                  checked={editData.correct_choice === val}
                                  onChange={(e)=>setEditData((d:any)=>({ ...d, correct_choice: e.target.value }))}
                                  className="h-3 w-3"
                                />
                                <span>{val}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {q.kind === 'future_score' && (
                        <div className="grid grid-cols-2 gap-3">
                          <NotchedInput
                            borderless
                            type="number"
                            label={'Poprawny wynik — gospodarze'}
                            value={editData.correct_home ?? ''}
                            onChange={(e:any)=>setEditData((d:any)=>({ ...d, correct_home: e.target.value }))}
                          />
                          <NotchedInput
                            borderless
                            type="number"
                            label={'Poprawny wynik — goście'}
                            value={editData.correct_away ?? ''}
                            onChange={(e:any)=>setEditData((d:any)=>({ ...d, correct_away: e.target.value }))}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" onClick={()=>setEditing(null)}>Anuluj</Button>
                        <Button onClick={()=>saveEdit(q.id, q.kind)}>Zapisz</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add form (opcjonalnie, po kliknięciu przycisku) */}
          {showAddForm && (
            <div className="rounded-xl border border-border/40 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Rodzaj pytania</Label>
                  <select className="mt-1 w-full rounded-md bg-muted/20 px-3 py-2 border-0 ring-0 focus:outline-none" value={qKind} onChange={(e)=>setQKind(e.target.value as any)}>
                    <option value="history_single">Jednokrotny wybór</option>
                    <option value="future_1x2">1X2 (przyszłość)</option>
                    <option value="history_numeric">Wartość liczbowa</option>
                    <option value="future_score">Dokładny wynik</option>
                    <option value="future_yellow_cards">Żółte kartki (przyszłość)</option>
                    <option value="future_corners">Rzuty rożne (przyszłość)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <NotchedInput
                    borderless
                    label={'Treść pytania'}
                    value={shouldLockPrompt(qKind) ? defaultPrompt(qKind) : qPrompt}
                    disabled={shouldLockPrompt(qKind)}
                    onChange={(e:any)=>setQPrompt(e.target.value)}
                  />
                </div>
              </div>

              {(qKind === 'history_single' || qKind === 'future_1x2') && (
                <div className="mt-3">
                  <Label>Opcje odpowiedzi</Label>
                  <div className="space-y-2 mt-1">
                    {qOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={opt} onChange={(e)=>updateOption(i, e.target.value)} className="flex-1 rounded-md bg-muted/20 px-3 py-2 border-0 ring-0 focus:outline-none" />
                        <Button size="sm" variant="secondary" onClick={()=>removeOption(i)}>Usuń</Button>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="mt-2" variant="outline" onClick={()=>setQOptions([...qOptions, ''])}>Dodaj opcję</Button>
                </div>
              )}

              {(qKind === 'future_1x2' || qKind === 'future_score' || isFutureStatKind(qKind)) && matches.length > 0 && (
                <div className="mt-3">
                  <Label>Mecz (z rundy)</Label>
                  <select className="mt-1 w-full rounded-md bg-muted/20 px-3 py-2 border-0 ring-0 focus:outline-none" value={(editData as any).new_match_id || ''} onChange={(e)=>setEditData((d:any)=>({ ...d, new_match_id: e.target.value }))}>
                    <option value="">— wybierz mecz —</option>
                    {matches.map((m:any)=> (
                      <option key={m.id} value={m.id}>{m.home_team} vs {m.away_team} • {new Date(m.kickoff_at).toLocaleString('pl-PL')}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={resetNewQ}>Wyczyść</Button>
                <Button onClick={()=>addQuestionWithMatch()} disabled={!qPrompt}>Dodaj pytanie</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function kindLabel(k: string) {
  switch (k) {
    case 'history_single':
      return 'Jednokrotny wybór'
    case 'history_numeric':
      return 'Wartość liczbowa'
    case 'future_1x2':
      return '1X2 (przyszłość)'
    case 'future_score':
      return 'Dokładny wynik'
    case 'future_yellow_cards':
      return 'Żółte kartki (przyszłość)'
    case 'future_corners':
      return 'Rzuty rożne (przyszłość)'
    default:
      return k
  }
}

function defaultPrompt(kind: string) {
  switch (kind) {
    case 'history_single':
      return 'Wybierz poprawną odpowiedź'
    case 'history_numeric':
      return 'Podaj wartość'
    case 'future_1x2':
      return 'Kto wygra mecz?'
    case 'future_score':
      return 'Jaki będzie dokładny wynik?'
    case 'future_yellow_cards':
      return FUTURE_STAT_DEFAULTS.future_yellow_cards.prompt
    case 'future_corners':
      return FUTURE_STAT_DEFAULTS.future_corners.prompt
    default:
      return 'Podaj wartość'
  }
}

function shouldLockPrompt(kind?: string | null) {
  return isFutureStatKind(kind)
}

function isFutureStatKind(kind?: string | null): kind is FutureStatKind {
  if (!kind) return false
  return (FUTURE_STAT_KINDS as readonly string[]).includes(kind as any)
}

function getDefaultNumericOptions(kind: string) {
  if (kind === 'history_numeric') {
    return { min: 0, max: 6, step: 1 }
  }
  if (isFutureStatKind(kind)) {
    const base = FUTURE_STAT_DEFAULTS[kind].numeric
    return { ...base }
  }
  return { min: 0, max: 6, step: 1 }
}
