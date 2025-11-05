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

type Kind = 'history_single'|'history_numeric'|'future_1x2'|'future_score'

export default function AdminQuestionsBank() {
  const { toast } = useToast()
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [leagues, setLeagues] = React.useState<any[]>([])
  const [activeLeague, setActiveLeague] = React.useState<string | null>(null)
  const [rounds, setRounds] = React.useState<any[]>([])
  const [matches, setMatches] = React.useState<any[]>([])

  const [kind, setKind] = React.useState<Kind>('history_single')
  const [prompt, setPrompt] = React.useState('')
  const [options, setOptions] = React.useState<string[]>([''])
  const [matchId, setMatchId] = React.useState<string>('')
  const [quizzes, setQuizzes] = React.useState<any[]>([])
  const [assign, setAssign] = React.useState<{ id: string|null; quiz_id: string }>({ id: null, quiz_id: '' })

  React.useEffect(() => { load(); loadQuizzes(); loadLeagues() }, [])
  React.useEffect(() => { if (activeLeague) { loadRoundsAndMatches(activeLeague) } }, [activeLeague])

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

  async function loadRoundsAndMatches(leagueId: string) {
    try {
      const s = getSupabase()
      const { data: rs } = await s.from('rounds').select('id,label').eq('league_id', leagueId)
      setRounds(rs || [])
      const ids = (rs||[]).map((r:any)=>r.id)
      if (ids.length) {
        const { data: ms } = await s.from('matches').select('id,home_team,away_team,kickoff_at,round_id').in('round_id', ids)
        setMatches(ms || [])
      } else {
        setMatches([])
      }
    } catch {}
  }

  // Quick generator: adds a small package of future questions (1X2 + wynik)
  async function addSamplePackage() {
    try {
      if (!activeLeague) { toast({ title: 'Wybierz ligę', variant: 'destructive' as any }); return }
      if (matches.length === 0) { toast({ title: 'Brak meczów w wybranej lidze', variant: 'destructive' as any }); return }
      const upcoming = [...matches].sort((a:any,b:any)=> new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
        .filter((m:any)=> {
          const t = new Date(m.kickoff_at).getTime();
          return isFinite(t) && (t > Date.now() - 3*24*60*60*1000) // nie dalej niż 3 dni wstecz
        })
        .slice(0, 3)
      if (upcoming.length === 0) { toast({ title: 'Brak nadchodzących meczów do utworzenia pytań', variant: 'destructive' as any }); return }
      const s = getSupabase()
      const base = (items[items.length-1]?.order_index ?? -1) + 1
      let order = base
      const payload: any[] = []
      for (const m of upcoming) {
        payload.push({ quiz_id: null, kind: 'future_1x2', prompt: `Kto wygra? ${m.home_team} vs ${m.away_team}`, options: ['1','X','2'], match_id: m.id, order_index: order++ })
        payload.push({ quiz_id: null, kind: 'future_score', prompt: `Jaki będzie wynik? ${m.home_team} vs ${m.away_team}`, options: { min_home: 0, max_home: 10, min_away: 0, max_away: 10 }, match_id: m.id, order_index: order++ })
      }
      const { error } = await s.from('quiz_questions').insert(payload)
      if (error) throw error
      toast({ title: `Dodano ${payload.length} pytań do banku` })
      await load()
    } catch (e:any) {
      toast({ title: 'Błąd dodawania', description: e?.message ?? '', variant: 'destructive' as any })
    }
  }

  // Add sample history questions for testing
  async function addSampleHistory() {
    try {
      if (!activeLeague) { toast({ title: 'Wybierz ligę', variant: 'destructive' as any }); return }
      const s = getSupabase()
      const base = (items[items.length-1]?.order_index ?? -1) + 1
      let order = base
      const payload: any[] = [
        { quiz_id: null, kind: 'history_single', prompt: 'Która drużyna zdobyła mistrzostwo Polski w 2023 roku?', options: ['Lech Poznań', 'Legia Warszawa', 'Raków Częstochowa', 'Pogoń Szczecin'], match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_single', prompt: 'Ile goli padło w finale Pucharu Polski 2022?', options: ['1', '2', '3', '4'], match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_numeric', prompt: 'Ile punktów zdobył lider Ekstraklasy w sezonie 2022/2023?', options: { min: 70, max: 90, step: 1 }, match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_single', prompt: 'Który piłkarz został królem strzelców Ekstraklasy w 2023?', options: ['Bartosz Śpiączka', 'Ivi López', 'Marc Gual', 'Jesus Imaz'], match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_single', prompt: 'Która drużyna spadła z Ekstraklasy w 2023?', options: ['Wisła Kraków', 'Lechia Gdańsk', 'Cracovia', 'Śląsk Wrocław'], match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_numeric', prompt: 'Ile bramek strzelił Robert Lewandowski w sezonie 2022/2023?', options: { min: 30, max: 50, step: 1 }, match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_single', prompt: 'Która drużyna awansowała do Ekstraklasy w 2023?', options: ['ŁKS Łódź', 'Górnik Łęczna', 'Stal Rzeszów', 'Zagłębie Sosnowiec'], match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_single', prompt: 'Ile żółtych kartek otrzymał średnio mecz w Ekstraklasie 2023?', options: ['mniej niż 3', '3-4', '4-5', 'więcej niż 5'], match_id: null, order_index: order++ },
        { quiz_id: null, kind: 'history_numeric', prompt: 'Ile drużyn uczestniczyło w Ekstraklasie w sezonie 2022/2023?', options: { min: 16, max: 20, step: 1 }, match_id: null, order_index: order++ },
      ]
      const { error } = await s.from('quiz_questions').insert(payload)
      if (error) throw error
      toast({ title: `Dodano ${payload.length} pytań historycznych do banku` })
      await load()
    } catch (e:any) {
      toast({ title: 'Błąd dodawania', description: e?.message ?? '', variant: 'destructive' as any })
    }
  }

  function reset() { setKind('history_single'); setPrompt(''); setOptions(['']); setMatchId('') }
  function updateOption(i:number, v:string) { setOptions(prev=>prev.map((x,idx)=>idx===i?v:x)) }
  function removeOption(i:number) { setOptions(prev=>prev.filter((_,idx)=>idx!==i)) }

  async function add() {
    try {
      const s = getSupabase()
      let opts: any = null
      if (kind === 'history_single' || kind === 'future_1x2') {
        const o = options.map(o=>o.trim()).filter(Boolean)
        opts = o.length ? o : (kind==='future_1x2' ? ['1','X','2'] : null)
      }
      const order = (items[items.length-1]?.order_index ?? -1) + 1
      const payload: any = { quiz_id: null, kind, prompt, options: opts, match_id: matchId || null, order_index: order }
      // optionally attach league_id if column exists (safe fallback)
      try { (payload as any).league_id = activeLeague } catch {}
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addSamplePackage}>Dodaj pakiet przykładowych pytań</Button>
          <Button variant="outline" size="sm" onClick={addSampleHistory}>Dodaj pytania historyczne</Button>
        </div>
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
                  <SelectItem value="future_1x2">1X2 (przyszłość)</SelectItem>
                  <SelectItem value="history_numeric">Wartość liczbowa</SelectItem>
                  <SelectItem value="future_score">Dokładny wynik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(kind==='future_1x2'||kind==='future_score') && (
              <div className="md:col-span-2">
                <Label>Mecze — wybierz kartą (liga: {leagues.find(x=>x.id===activeLeague)?.name || '—'})</Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-auto pr-1">
                  {matches.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Brak meczów dla wybranej ligi.</div>
                  ) : matches.map((m:any)=> (
                    <button key={m.id} onClick={()=>setMatchId(m.id)} className={`flex items-center justify-between rounded-xl px-3 py-2 text-left ${matchId===m.id ? 'bg-primary text-primary-foreground' : 'bg-muted/20 hover:bg-muted/30'}`}>
                      <span>{m.home_team} vs {m.away_team}</span>
                      <span className="text-xs opacity-80">{new Date(m.kickoff_at).toLocaleString('pl-PL')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <NotchedInput borderless label={'Treść pytania'} value={prompt} onChange={(e:any)=>setPrompt(e.target.value)} />
            </div>
          </div>

          {(kind==='history_single'||kind==='future_1x2') && (
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
            items
              .filter((q)=> {
                if (!activeLeague) return true
                if (q.match_id) {
                  const m = matches.find((mm:any)=>mm.id===q.match_id)
                  return !!m
                }
                // pytania ogólne bez meczu — pokażemy je zawsze
                return true
              })
              .map((q)=> (
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
    case 'history_numeric': return 'Wartość liczbowa'
    case 'future_1x2': return '1X2 (przyszłość)'
    case 'future_score': return 'Dokładny wynik'
    default: return k
  }
}
