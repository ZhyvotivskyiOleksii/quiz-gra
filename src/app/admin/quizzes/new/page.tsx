"use client";
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import NotchedInput from '@/components/ui/notched-input'
import { Label } from '@/components/ui/label'
import ImageUploader from '@/components/admin/image-uploader'
import Link from 'next/link'
import { Timer, Settings2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function NewQuizPage() {
  const router = useRouter()
  const [leagues, setLeagues] = React.useState<{id:string;name:string;code:string}[]>([])
  const [leagueId, setLeagueId] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [startsAt, setStartsAt] = React.useState('')
  const [deadlineAt, setDeadlineAt] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState<string | undefined>(undefined)
  const [prize, setPrize] = React.useState('')
  const [publishNow, setPublishNow] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  // Matches by selected league (for future questions)
  const [matches, setMatches] = React.useState<any[]>([])
  // Manual history slots (3) + auto future selection (3)
  type SlotKind = 'history_single'|'history_numeric'|'future_1x2'|'future_score'
  type Slot = {
    kind: SlotKind
    prompt: string
    options?: string[]
    match_id?: string | null
    numeric?: { min: number; max: number; step: number }
    score?: { min_home: number; max_home: number; min_away: number; max_away: number }
  }
  const [slots, setSlots] = React.useState<Slot[]>([
    { kind: 'history_single', prompt: '', options: [''] },
    { kind: 'history_single', prompt: '', options: [''] },
    { kind: 'history_numeric', prompt: 'Ile goli padło w meczu?', numeric: { min: 0, max: 6, step: 1 } },
  ])
  type BankQ = { id:string; kind: SlotKind; prompt:string; options:any; match_id:string }
  const [futurePool, setFuturePool] = React.useState<BankQ[]>([])
  const [futureSel, setFutureSel] = React.useState<BankQ[]>([])
  // New: history pool for random selection
  const [historyPool, setHistoryPool] = React.useState<BankQ[]>([])
  const [historySel, setHistorySel] = React.useState<BankQ[]>([])
  // Predictions: 3 manual future questions
  const [predictions, setPredictions] = React.useState<Slot[]>([
    { kind: 'future_1x2', prompt: '', options: ['1','X','2'] },
    { kind: 'future_1x2', prompt: '', options: ['1','X','2'] },
    { kind: 'future_score', prompt: '', score: { min_home: 0, max_home: 10, min_away: 0, max_away: 10 } },
  ])

  React.useEffect(() => {
    (async () => {
      const s = getSupabase();
      const { data } = await s.from('leagues').select('id,name,code').order('name')
      setLeagues(data || [])
    })()
  }, [])

  React.useEffect(() => { if (leagueId) loadMatchesForLeague(leagueId) }, [leagueId])
  React.useEffect(() => { buildFuturePool(); buildHistoryPool() }, [matches])

  async function loadMatchesForLeague(lid: string) {
    try {
      const s = getSupabase()
      const { data: rs } = await s.from('rounds').select('id,label,deadline_at,starts_at').eq('league_id', lid)
      const roundIds = (rs || []).map((r:any)=> r.id)
      if (roundIds.length === 0) { setMatches([]); return }
      const { data: ms } = await s
        .from('matches')
        .select('id,home_team,away_team,kickoff_at,round_id')
        .in('round_id', roundIds)
        .order('kickoff_at', { ascending: true })
      // Optional time filter: if dates chosen, restrict to that window
      let list = ms || []
      if (startsAt && deadlineAt) {
        const a = new Date(startsAt).getTime()
        const b = new Date(deadlineAt).getTime()
        list = list.filter((m:any) => { const t = new Date(m.kickoff_at).getTime(); return t >= a && t <= b })
      }
      setMatches(list)
    } catch { setMatches([]) }
  }

  async function buildFuturePool() {
    try {
      const s = getSupabase()
      const { data } = await s
        .from('quiz_questions')
        .select('id,kind,prompt,options,match_id')
        .is('quiz_id', null)
        .in('kind', ['future_1x2','future_score'])
      const pool = (data||[]).filter((q:any)=> q.match_id && matches.some((m:any)=> m.id===q.match_id)) as any
      setFuturePool(pool)
      if (pool.length) pickRandomFuture(pool)
    } catch { setFuturePool([]) }
  }

  async function buildHistoryPool() {
    try {
      const s = getSupabase()
      const { data } = await s
        .from('quiz_questions')
        .select('id,kind,prompt,options,match_id')
        .not('quiz_id', 'is', null)
        .in('kind', ['history_single','history_numeric'])
      const pool = (data||[]).filter((q:any)=> !q.match_id || matches.some((m:any)=> m.id===q.match_id)) as any
      setHistoryPool(pool)
      if (pool.length) pickRandomHistory(pool)
    } catch { setHistoryPool([]) }
  }

  function pickRandomFuture(pool: BankQ[] = futurePool) {
    const ids = new Set<string>()
    const sel: BankQ[] = []
    const arr = [...pool]
    for (let attempts = 0; attempts < 300 && sel.length < 3 && arr.length; attempts++) {
      const i = Math.floor(Math.random()*arr.length)
      const it = arr.splice(i,1)[0]
      if (ids.has(it.match_id)) continue
      ids.add(it.match_id)
      sel.push(it)
    }
    setFutureSel(sel)
  }
  function replaceOneFuture(index:number) {
    const rest = futurePool.filter(p => !futureSel.some(s => s.id===p.id))
    if (!rest.length) return
    const pick = rest[Math.floor(Math.random()*rest.length)]
    setFutureSel(prev => prev.map((s,i)=> i===index ? pick : s))
  }

  function pickRandomHistory(pool: BankQ[] = historyPool) {
    const sel: BankQ[] = []
    const arr = [...pool]
    for (let attempts = 0; attempts < 300 && sel.length < 3 && arr.length; attempts++) {
      const i = Math.floor(Math.random()*arr.length)
      const it = arr.splice(i,1)[0]
      sel.push(it)
    }
    setHistorySel(sel)
  }
  function replaceOneHistory(index:number) {
    const rest = historyPool.filter(p => !historySel.some(s => s.id===p.id))
    if (!rest.length) return
    const pick = rest[Math.floor(Math.random()*rest.length)]
    setHistorySel(prev => prev.map((s,i)=> i===index ? pick : s))
  }

  async function create() {
    setSaving(true)
    try {
      const s = getSupabase()
      const tz = 'Europe/Warsaw'
      const { data: round, error: rerr } = await s
        .from('rounds')
        .insert({ league_id: leagueId, label, starts_at: startsAt, deadline_at: deadlineAt, timezone: tz, status: publishNow ? 'published' : 'draft' })
        .select('id')
        .single()
      if (rerr) throw rerr
      let insert: any = { round_id: round!.id, title }
      if (imageUrl) insert.image_url = imageUrl
      if (prize) insert.prize = Number(prize)
      let quizRes = await s.from('quizzes').insert(insert).select('id').single()
      if (quizRes.error) {
        // Fallback if columns (image_url/prize) don't exist yet
        quizRes = await s.from('quizzes').insert({ round_id: round!.id, title }).select('id').single()
      }
      const quiz = quizRes.data
      // Validate: 3 history (manual or random) + 3 predictions (manual)
          const historyQuestions = historySel.length > 0 ? historySel : slots
          if (historyQuestions.length !== 3) throw new Error('Ustaw 3 pytania historyczne (ręcznie lub losowo)')
          if (predictions.length !== 3) throw new Error('Ustaw 3 pytania predykcyjne')
          const all = [
            ...historyQuestions.map(s=>({ kind:s.kind, prompt:s.prompt, options:s.options, match_id:s.match_id })),
            ...predictions.map(s=>({ kind:s.kind, prompt:s.prompt, options:s.options, match_id:s.match_id }))
          ]
      const payload = all.map((sl:any, idx:number) => {
        let options: any = null
        if (sl.kind === 'history_single' || sl.kind === 'future_1x2') options = sl.options || null
        if (sl.kind === 'history_numeric') options = sl.numeric || { min: 0, max: 6, step: 1 }
        if (sl.kind === 'future_score') options = sl.score || sl.options || { min_home: 0, max_home: 10, min_away: 0, max_away: 10 }
        const prompt = sl.prompt && sl.prompt.trim().length ? sl.prompt : defaultPrompt(sl.kind)
        return {
          quiz_id: quiz!.id,
          kind: sl.kind,
          prompt,
          options,
          order_index: idx,
          match_id: (sl.kind === 'future_1x2' || sl.kind === 'future_score' || sl.kind === 'history_numeric') ? (sl.match_id || null) : null,
        }
      })
      await s.from('quiz_questions').insert(payload as any)
      router.push(`/admin/quizzes/${quiz!.id}`)
    } finally {
      setSaving(false)
    }
  }

  function setKind(i:number, k: SlotKind) {
    setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, kind: k, // reset defaults per type
      prompt: k==='future_1x2' ? 'Kto wygra mecz?' : k==='future_score' ? 'Jaki będzie dokładny wynik?' : s.prompt,
      options: (k==='history_single'||k==='future_1x2') ? (k==='future_1x2' ? ['1','X','2'] : (s.options||[''])) : undefined,
      match_id: (k==='future_1x2'||k==='future_score'||k==='history_numeric') ? (s.match_id||null) : null,
      numeric: k==='history_numeric' ? (s.numeric || { min:0, max:6, step:1 }) : undefined,
      score: k==='future_score' ? (s.score || { min_home:0, max_home:10, min_away:0, max_away:10 }) : undefined,
    }) : s))
  }
  function updateSlot(i:number, data: Partial<Slot>) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, ...data }) : s)) }
  function addOption(i:number) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: [...(s.options||[]), ''] }) : s)) }
  function setOption(i:number, j:number, v:string) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).map((o,k)=> k===j ? v : o) }) : s)) }
  function removeOption(i:number, j:number) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).filter((_,k)=>k!==j) }) : s)) }
  function moveSlot(i:number, delta:number) { setSlots(prev => move(prev, i, delta)) }
  function removeSlot(i:number) { setSlots(prev => { const arr = prev.filter((_,idx)=> idx!==i); while (arr.length<3) arr.push(defaultSlot()); return arr }) }

  // For predictions
  function setPredictionKind(i:number, k: SlotKind) {
    setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, kind: k,
      prompt: k==='future_1x2' ? 'Kto wygra mecz?' : k==='future_score' ? 'Jaki będzie dokładny wynik?' : s.prompt,
      options: (k==='history_single'||k==='future_1x2') ? (k==='future_1x2' ? ['1','X','2'] : (s.options||[''])) : undefined,
      match_id: (k==='future_1x2'||k==='future_score'||k==='history_numeric') ? (s.match_id||null) : null,
      numeric: k==='history_numeric' ? (s.numeric || { min:0, max:6, step:1 }) : undefined,
      score: k==='future_score' ? (s.score || { min_home:0, max_home:10, min_away:0, max_away:10 }) : undefined,
    }) : s))
  }
  function updatePrediction(i:number, data: Partial<Slot>) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, ...data }) : s)) }
  function addPredictionOption(i:number) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: [...(s.options||[]), ''] }) : s)) }
  function setPredictionOption(i:number, j:number, v:string) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).map((o,k)=> k===j ? v : o) }) : s)) }
  function removePredictionOption(i:number, j:number) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).filter((_,k)=>k!==j) }) : s)) }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
      {/* Top row: meta form + preview side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader><CardTitle>Nowa wiktoryna</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Liga</Label>
                <Select value={leagueId} onValueChange={setLeagueId}>
                  <SelectTrigger className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                    <SelectValue placeholder="— wybierz ligę —" />
                  </SelectTrigger>
                  <SelectContent className="text-sm max-h-[280px]">
                    {leagues.map((l)=> (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NotchedInput borderless label={'Tytuł wiktoryny'} value={title} onChange={(e:any)=>setTitle(e.target.value)} />
              <NotchedInput borderless label={'Etykieta rundy/etapu (np. "14 kolejka")'} value={label} onChange={(e:any)=>setLabel(e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NotchedInput borderless type="datetime-local" label={'Początek publikacji'} value={startsAt} onChange={(e:any)=>setStartsAt(e.target.value)} />
                <NotchedInput borderless type="datetime-local" label={'Deadline odpowiedzi'} value={deadlineAt} onChange={(e:any)=>setDeadlineAt(e.target.value)} />
              </div>
              <NotchedInput borderless type="number" label={'Nagroda (zł)'} value={prize} onChange={(e:any)=>setPrize(e.target.value)} />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={publishNow} onChange={(e)=>setPublishNow(e.target.checked)} />
                  Opublikuj od razu
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Podgląd karty</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#3a0d0d] via-[#5a0f0f] to-[#7a1313] p-0 shadow-xl min-h-[200px]">
                <div className="flex h-full">
                  <div className="relative w-[55%] min-h-[170px] md:min-h-[210px] overflow-hidden rounded-r-[40px]">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="podgląd" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/images/preview.webp" alt="podgląd" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <div className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] px-2 py-1 flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5" /> Do końca: {deadlineAt ? new Date(deadlineAt).toLocaleString('pl-PL') : '—'}
                    </div>
                  </div>
                  <div className="relative flex-1 p-5 sm:p-6 flex flex-col justify-center items-end text-right">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/75">Runda {label || '—'}</div>
                    <div className="mt-1 text-3xl md:text-4xl font-headline font-extrabold text-white drop-shadow">{title || 'Tytuł'}</div>
                    <div className="mt-2 text-xl font-extrabold text-yellow-300 drop-shadow">{prize ? Number(prize).toLocaleString('pl-PL') + ' zł' : ''}</div>
                    <div className="mt-3 self-end">
                      <Button asChild size="sm" variant="secondary" className="rounded-full">
                        <Link href="#"><Settings2 className="h-4 w-4 mr-2"/>Otwórz</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">Podgląd karty będzie zaktualizowany po zmianie obrazu.</div>
          <ImageUploader value={imageUrl} onChange={setImageUrl} />
        </div>
      </div>

      {/* Bottom row: questions side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Historia — 3 pytania</CardTitle>
              <Button size="sm" variant="outline" onClick={()=>pickRandomHistory()} className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600">Losuj z banku</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {historySel.length > 0 ? (
              <div className="space-y-2">
                {historySel.map((h, idx) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-sm">
                      <div className="font-medium">{kindLabel(h.kind)}</div>
                      <div className="opacity-80">{h.prompt}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={()=>replaceOneHistory(idx)}>Zamień</Button>
                  </div>
                ))}
              </div>
            ) : (
              slots.map((sl, i) => (
                <div key={i} className="rounded-lg border border-border/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Historia #{i+1}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={()=>moveSlot(i,-1)} disabled={i===0}>Góra</Button>
                      <Button size="sm" variant="secondary" onClick={()=>moveSlot(i,1)} disabled={i===slots.length-1}>Dół</Button>
                      <Button size="sm" variant="destructive" onClick={()=>removeSlot(i)}>Usuń</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>Rodzaj</Label>
                      <Select value={sl.kind} onValueChange={(v)=>setKind(i, v as SlotKind)}>
                        <SelectTrigger className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                          <SelectValue placeholder="Rodzaj" />
                        </SelectTrigger>
                        <SelectContent className="text-sm">
                          <SelectItem value="history_single">Jednokrotny wybór</SelectItem>
                          <SelectItem value="history_numeric">Wartość liczbowa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <NotchedInput borderless label={'Treść pytania'} value={sl.prompt} onChange={(e:any)=>updateSlot(i,{ prompt: e.target.value })} />
                  </div>
                  {sl.kind==='history_single' && (
                    <div className="mt-2">
                      <Label>Opcje</Label>
                      <div className="space-y-2 mt-1">
                        {(sl.options||['']).map((opt, j)=>(
                          <div key={j} className="flex items-center gap-2">
                            <input value={opt} onChange={(e)=>setOption(i,j,e.target.value)} className="flex-1 rounded-md bg-muted/20 px-3 py-2 border-0 ring-0" />
                            <Button size="sm" variant="secondary" onClick={()=>removeOption(i,j)}>Usuń</Button>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" className="mt-2" variant="outline" onClick={()=>addOption(i)}>Dodaj opcję</Button>
                    </div>
                  )}
                  {sl.kind==='history_numeric' && (
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <NotchedInput borderless type="number" label={'Min'} value={sl.numeric?.min ?? 0} onChange={(e:any)=>updateSlot(i,{ numeric: { ...(sl.numeric||{}), min: parseInt(e.target.value||'0'), max: sl.numeric?.max ?? 6, step: sl.numeric?.step ?? 1 } })} />
                      <NotchedInput borderless type="number" label={'Max'} value={sl.numeric?.max ?? 6} onChange={(e:any)=>updateSlot(i,{ numeric: { ...(sl.numeric||{}), max: parseInt(e.target.value||'6'), min: sl.numeric?.min ?? 0, step: sl.numeric?.step ?? 1 } })} />
                      <NotchedInput borderless type="number" label={'Krok'} value={sl.numeric?.step ?? 1} onChange={(e:any)=>updateSlot(i,{ numeric: { ...(sl.numeric||{}), step: parseInt(e.target.value||'1'), min: sl.numeric?.min ?? 0, max: sl.numeric?.max ?? 6 } })} />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Predykcje — 3 pytania</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {predictions.map((pr, i) => (
              <div key={i} className="rounded-lg border border-border/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Predykcja #{i+1}</div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Rodzaj</Label>
                    <Select value={pr.kind} onValueChange={(v)=>setPredictionKind(i, v as SlotKind)}>
                      <SelectTrigger className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                        <SelectValue placeholder="Rodzaj" />
                      </SelectTrigger>
                      <SelectContent className="text-sm">
                        <SelectItem value="future_1x2">1X2 (przyszłość)</SelectItem>
                        <SelectItem value="future_score">Dokładny wynik</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <NotchedInput borderless label={'Treść pytania'} value={pr.prompt} onChange={(e:any)=>updatePrediction(i,{ prompt: e.target.value })} />
                </div>
                {pr.kind==='future_1x2' && (
                  <div className="mt-2">
                    <Label>Opcje</Label>
                    <div className="space-y-2 mt-1">
                      {(pr.options||['']).map((opt, j)=>(
                        <div key={j} className="flex items-center gap-2">
                          <input value={opt} onChange={(e)=>setPredictionOption(i,j,e.target.value)} className="flex-1 rounded-md bg-muted/20 px-3 py-2 border-0 ring-0" />
                          <Button size="sm" variant="secondary" onClick={()=>removePredictionOption(i,j)}>Usuń</Button>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" className="mt-2" variant="outline" onClick={()=>addPredictionOption(i)}>Dodaj opcję</Button>
                  </div>
                )}
                {pr.kind==='future_score' && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <NotchedInput borderless type="number" label={'Min (gosp.)'} value={pr.score?.min_home ?? 0} onChange={(e:any)=>updatePrediction(i,{ score: { ...(pr.score||{}), min_home: parseInt(e.target.value||'0'), max_home: pr.score?.max_home ?? 10, min_away: pr.score?.min_away ?? 0, max_away: pr.score?.max_away ?? 10 } })} />
                    <NotchedInput borderless type="number" label={'Max (gosp.)'} value={pr.score?.max_home ?? 10} onChange={(e:any)=>updatePrediction(i,{ score: { ...(pr.score||{}), max_home: parseInt(e.target.value||'10'), min_home: pr.score?.min_home ?? 0, min_away: pr.score?.min_away ?? 0, max_away: pr.score?.max_away ?? 10 } })} />
                    <NotchedInput borderless type="number" label={'Min (goście)'} value={pr.score?.min_away ?? 0} onChange={(e:any)=>updatePrediction(i,{ score: { ...(pr.score||{}), min_away: parseInt(e.target.value||'0'), min_home: pr.score?.min_home ?? 0, max_home: pr.score?.max_home ?? 10, max_away: pr.score?.max_away ?? 10 } })} />
                    <NotchedInput borderless type="number" label={'Max (goście)'} value={pr.score?.max_away ?? 10} onChange={(e:any)=>updatePrediction(i,{ score: { ...(pr.score||{}), max_away: parseInt(e.target.value||'10'), min_home: pr.score?.min_home ?? 0, max_home: pr.score?.max_home ?? 10, min_away: pr.score?.min_away ?? 0 } })} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground text-center mb-6">Po zakończeniu quizu pytania przyszłości automatycznie trafią do banku jako pytania historyczne. Upewnij się, że wszystkie 6 pytań jest poprawnie ustawionych.</div>

      <div className="flex justify-center">
        <Button onClick={create} disabled={saving || !leagueId || !label || !startsAt || !deadlineAt || !title} size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 px-8">Utwórz wiktorynę</Button>
      </div>
    </div>
  )
}

function kindLabel(k: string) {
  switch (k) {
    case 'history_single': return 'Jednokrotny wybór'
    case 'history_numeric': return 'Wartość liczbowa'
    case 'future_1x2': return '1X2 (przyszłość)'
    case 'future_score': return 'Dokładny wynik'
    default: return k
  }
}

function defaultPrompt(k: 'history_single'|'history_numeric'|'future_1x2'|'future_score') {
  switch (k) {
    case 'history_single': return 'Wybierz poprawną odpowiedź'
    case 'history_numeric': return 'Podaj wartość'
    case 'future_1x2': return 'Kto wygra mecz?'
    case 'future_score': return 'Jaki będzie dokładny wynik?'
  }
}

function defaultSlot(): { kind: 'history_single'; prompt: string; options: string[] } {
  return { kind: 'history_single', prompt: '', options: [''] }
}

function move<T>(arr: T[], idx: number, delta: number): T[] {
  const out = [...arr]
  const t = idx + delta
  if (t < 0 || t >= out.length) return out
  const [a] = out.splice(idx,1)
  out.splice(t,0,a)
  return out
}
