"use client";
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import NotchedInput from '@/components/ui/notched-input'
import { getSupabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Bank pytań oparty o quiz_questions z quiz_id = null
// W banku trzymamy tylko pytania historyczne (bez przyszłych typów)
type Kind = 'history_single' | 'history_numeric'

export default function AdminQuestionsBank() {
  const { toast } = useToast()
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [leagues, setLeagues] = React.useState<any[]>([])
  const [activeLeague, setActiveLeague] = React.useState<string | null>(null)

  const [kind, setKind] = React.useState<Kind>('history_single')
  const [prompt, setPrompt] = React.useState('')
  const [options, setOptions] = React.useState<string[]>([''])
  const [quizzes, setQuizzes] = React.useState<any[]>([])
  const [assign, setAssign] = React.useState<{ id: string|null; quiz_id: string }>({ id: null, quiz_id: '' })

  React.useEffect(() => { load(); loadQuizzes(); loadLeagues() }, [])

  async function load() {
    setLoading(true)
    try {
      const s = getSupabase()
      const { data } = await s
        .from('quiz_questions')
        .select('id,kind,prompt,options,match_id,order_index')
        .is('quiz_id', null)
        .order('order_index', { ascending: true })
      setItems(data || [])
    } finally { setLoading(false) }
  }

  async function loadQuizzes() {
    try {
      const s = getSupabase()
      const { data } = await s
        .from('rounds')
        .select('id,label,leagues(name,code),quizzes(id,title)')
        .order('deadline_at', { ascending: false })
        .limit(100)
      const flat: any[] = []
      ;(data||[]).forEach((r:any)=>{
        (r.quizzes||[]).forEach((q:any)=>{
          flat.push({ id: q.id, title: q.title, label: r.label, league: r.leagues?.name })
        })
      })
      setQuizzes(flat)
    } catch {}
  }

  async function loadLeagues() {
    try {
      const s = getSupabase()
      const { data } = await s.from('leagues').select('id,name,code').order('name')
      setLeagues(data || [])
      if (!activeLeague && (data||[])[0]) setActiveLeague((data as any)[0].id)
    } catch {}
  }

  // (Opcjonalnie: możemy później dodać generator paczek historycznych,
  // ale domyślnie pytania w banku dodajemy ręcznie.)

  function reset() { setKind('history_single'); setPrompt(''); setOptions(['']) }
  function updateOption(i:number, v:string) { setOptions(prev=>prev.map((x,idx)=>idx===i?v:x)) }
  function removeOption(i:number) { setOptions(prev=>prev.filter((_,idx)=>idx!==i)) }

  async function add() {
    try {
      const s = getSupabase()
      let opts: any = null
      if (kind === 'history_single') {
        const o = options.map(o=>o.trim()).filter(Boolean)
        opts = o.length ? o : null
      }
      const order = (items[items.length-1]?.order_index ?? -1) + 1
      const payload: any = { quiz_id: null, kind, prompt, options: opts, match_id: null, order_index: order }
      const { error } = await s.from('quiz_questions').insert(payload)
      if (error) throw error
      toast({ title: 'Dodano pytanie do banku' })
      reset(); await load()
    } catch (e:any) { toast({ title: 'Błąd', description: e?.message ?? '', variant: 'destructive' as any }) }
  }

  async function del(id:string) { const s = getSupabase(); await s.from('quiz_questions').delete().eq('id', id); await load() }

  async function assignToQuiz() {
    if (!assign.id || !assign.quiz_id) { toast({ title: 'Wybierz pytanie i wiktorynę', variant: 'destructive' as any }); return }
    try {
      const s = getSupabase()
      // find last index in that quiz
      const { data: maxArr } = await s.from('quiz_questions').select('order_index').eq('quiz_id', assign.quiz_id).order('order_index', { ascending: false }).limit(1)
      const next = (maxArr?.[0]?.order_index ?? -1) + 1
      // clone from bank
      const q = items.find(x=>x.id===assign.id)
      const payload: any = { quiz_id: assign.quiz_id, kind: q.kind, prompt: q.prompt, options: q.options, match_id: q.match_id || null, order_index: next }
      const { error } = await s.from('quiz_questions').insert(payload)
      if (error) throw error
      setAssign({ id: null, quiz_id: '' })
      toast({ title: 'Przypisano pytanie do wiktoryny' })
    } catch (e:any) { toast({ title: 'Błąd', description: e?.message ?? '', variant: 'destructive' as any }) }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold uppercase">Bank pytań</h1>
      </div>

      {/* Leagues horizontal tabs */}
      {leagues.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {leagues.map((l:any) => (
            <button
              key={l.id}
              onClick={()=>setActiveLeague(l.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${activeLeague===l.id ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted/60'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Nowe pytanie</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Rodzaj pytania</Label>
              <Select value={kind} onValueChange={(v)=>setKind(v as Kind)}>
                <SelectTrigger id="kind" className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                  <SelectValue placeholder="Wybierz rodzaj" />
                </SelectTrigger>
                <SelectContent className="text-sm">
                  <SelectItem value="history_single">Jednokrotny wybór</SelectItem>
                  <SelectItem value="history_numeric">Wartość liczbowa (historia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <NotchedInput borderless label={'Treść pytania'} value={prompt} onChange={(e:any)=>setPrompt(e.target.value)} />
            </div>
          </div>

          {kind==='history_single' && (
            <div>
              <Label>Opcje odpowiedzi</Label>
              <div className="space-y-2 mt-1">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={opt} onChange={(e)=>updateOption(i,e.target.value)} className="flex-1 h-9 rounded-md bg-muted/20 px-3 py-2 border-0 ring-0 focus:outline-none" />
                    <Button size="sm" variant="secondary" onClick={()=>removeOption(i)} className="h-9">Usuń</Button>
                  </div>
                ))}
              </div>
              <Button size="sm" className="mt-2 h-9" variant="outline" onClick={()=>setOptions([...options,''])}>Dodaj opcję</Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" className="h-9" variant="secondary" onClick={reset}>Wyczyść</Button>
            <Button size="sm" className="h-9" onClick={add} disabled={!prompt}>Dodaj do banku</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista pytań</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Ładowanie…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Brak pytań w banku.</div>
          ) : (
            // Show pytania powiązane z aktualną ligą (po match_id i rundzie)
            items.map((q)=> (
              <div key={q.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{kindLabel(q.kind)}</div>
                  <div className="opacity-80">{q.prompt}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select className="rounded-md bg-muted/20 px-3 py-2 border-0 ring-0" value={assign.id===q.id?assign.quiz_id:''} onChange={(e)=>setAssign({ id: q.id, quiz_id: e.target.value })}>
                    <option value="">— do wiktoryny —</option>
                    {quizzes.map((z)=> (
                      <option key={z.id} value={z.id}>{z.league ? z.league+' — ' : ''}{z.label} • {z.title}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={assignToQuiz} disabled={assign.id!==q.id || !assign.quiz_id}>Przypisz</Button>
                  <Button size="sm" variant="destructive" onClick={()=>del(q.id)}>Usuń</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function kindLabel(k: string) {
  switch (k) {
    case 'history_single': return 'Jednokrotny wybór'
    case 'history_numeric': return 'Wartość liczbowa (historia)'
    default: return k
  }
}
