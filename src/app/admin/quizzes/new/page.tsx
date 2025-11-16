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
import { DateTimeField } from '@/components/ui/datetime-field'
import { fetchNextEvents, fetchPastEvents, mapLeagueToApiId, type TheSportsDbEvent, toTinyBadge } from '@/lib/footballApi'
import { matchKey, toKickoffIso } from '@/lib/matchUtils'

type SlotKind = 'history_single'|'history_numeric'|'future_1x2'|'future_score'

export default function NewQuizPage() {
  const router = useRouter()
  const [leagues, setLeagues] = React.useState<{id:string;name:string;code:string}[]>([])
  const [leaguesLoading, setLeaguesLoading] = React.useState(true)
  const [leaguesError, setLeaguesError] = React.useState<string | null>(null)
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
  const [matches, setMatches] = React.useState<TheSportsDbEvent[]>([])
  const [matchesLeagueId, setMatchesLeagueId] = React.useState<string | null>(null)
  const [matchesLoading, setMatchesLoading] = React.useState(false)
  const [matchesSource, setMatchesSource] = React.useState<'next' | 'past' | null>(null)
  const [matchesError, setMatchesError] = React.useState<string | null>(null)
  const [matchesInfo, setMatchesInfo] = React.useState<string | null>(null)
  // Manual history slots (3) + auto future selection (3)
  type Slot = {
    kind: SlotKind
    prompt: string
    options?: string[]
    match_id?: string | null
    numeric?: { min: number; max: number; step: number }
    score?: { min_home: number; max_home: number; min_away: number; max_away: number }
    correct?: any
  }
  const [slots, setSlots] = React.useState<Slot[]>([
    { kind: 'history_single', prompt: '', options: [''] },
    { kind: 'history_single', prompt: '', options: [''] },
    { kind: 'history_numeric', prompt: 'Ile goli padło w meczu?', numeric: { min: 0, max: 6, step: 1 } },
  ])
  // Predictions: 3 manual future questions
  const [predictions, setPredictions] = React.useState<Slot[]>([
    { kind: 'future_1x2', prompt: '', options: ['1','X','2'] },
    { kind: 'future_1x2', prompt: '', options: ['1','X','2'] },
    { kind: 'future_score', prompt: '', score: { min_home: 0, max_home: 10, min_away: 0, max_away: 10 } },
  ])
  const activeMatches = matchesLeagueId === leagueId ? matches : []

  React.useEffect(() => { loadLeagues() }, [])

  async function loadLeagues() {
    setLeaguesLoading(true)
    setLeaguesError(null)
    try {
      const s = getSupabase()
      const { data, error } = await s.from('leagues').select('id,name,code').order('name')
      if (error) throw error
      setLeagues(data || [])
      if (!data?.length) {
        setLeaguesError('Brak lig w bazie. Dodaj je najpierw w panelu administracyjnym.')
      }
    } catch (err) {
      console.error('loadLeagues error', err)
      setLeagues([])
      setLeaguesError('Nie udało się pobrać lig z Supabase.')
    } finally {
      setLeaguesLoading(false)
    }
  }

  React.useEffect(() => {
    if (leagueId && leagues.length) loadMatchesForLeague(leagueId)
  }, [leagueId, leagues])

  async function loadMatchesForLeague(lid: string) {
    setMatchesLoading(true)
    setMatchesInfo(null)
    setMatchesError(null)
    setMatchesSource(null)
    setMatchesLeagueId(null)
    try {
      const league = leagues.find((l)=> l.id === lid)
      if (!league) {
        setMatches([])
        setMatchesLeagueId(lid)
        setMatchesError('Nie znaleziono ligi w bazie.')
        return
      }
      const apiId = mapLeagueToApiId(league?.name, league?.code)
      if (!apiId) {
        setMatches([])
        setMatchesLeagueId(lid)
        setMatchesError('Brak przypisanego ID w TheSportsDB dla tej ligi.')
        return
      }
      let events = await fetchNextEvents(apiId)
      let source: 'next' | 'past' = 'next'
      if (!events?.length) {
        events = await fetchPastEvents(apiId)
        source = 'past'
      }
      if (events?.length) {
        setMatches(events)
        setMatchesLeagueId(lid)
        setMatchesSource(source)
        setMatchesError(null)
        setMatchesInfo(source === 'past' ? 'Brak nadchodzących spotkań — pokazuję ostatnie mecze.' : null)
      } else {
        setMatches([])
        setMatchesLeagueId(lid)
        setMatchesSource(null)
        setMatchesError('API nie zwróciło żadnych meczów dla tej ligi.')
      }
    } catch (err) {
      console.error('loadMatchesForLeague error', err)
      setMatches([])
      setMatchesLeagueId(lid)
      setMatchesSource(null)
      setMatchesError('Nie udało się pobrać meczów z TheSportsDB.')
    } finally {
      setMatchesLoading(false)
    }
  }

  function setHistoryCorrect(index:number, value:any) {
    setSlots(prev => prev.map((s, idx) => {
      if (idx !== index) return s
      return { ...s, correct: value }
    }))
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
      const historyQuestions = slots
      if (historyQuestions.length !== 3) throw new Error('Ustaw 3 pytania historyczne')
      if (predictions.length !== 3) throw new Error('Ustaw 3 pytania predykcyjne')
      const all = [
        ...historyQuestions.map(s=>({ kind:s.kind, prompt:s.prompt, options:s.options, match_id:s.match_id, correct: s.correct })),
        ...predictions.map(s=>({ kind:s.kind, prompt:s.prompt, options:s.options, match_id:s.match_id, score: s.score, correct: null }))
      ]

      const matchIdMap = await ensureRoundMatches(round!.id, all)
      const payload = all.map((sl:any, idx:number) => {
        let options: any = null
        if (sl.kind === 'history_single' || sl.kind === 'future_1x2') options = sl.options || null
        if (sl.kind === 'history_numeric') options = sl.numeric || { min: 0, max: 6, step: 1 }
        if (sl.kind === 'future_score') options = sl.score || sl.options || { min_home: 0, max_home: 10, min_away: 0, max_away: 10 }
        const prompt = sl.prompt && sl.prompt.trim().length ? sl.prompt : defaultPrompt(sl.kind)
        const autoCorrect = requiresExternalMatch(sl.kind)
        const correctValue = autoCorrect ? null : (typeof sl.correct === 'undefined' ? null : sl.correct)
        if ((sl.kind === 'future_1x2' || sl.kind === 'future_score') && !sl.match_id) {
          throw new Error('Wybierz mecz dla każdego pytania przyszłościowego.')
        }
        const match_id = shouldAttachMatch(sl.kind) ? normalizeMatchId(sl.match_id, matchIdMap) : null
        if ((sl.kind === 'future_1x2' || sl.kind === 'future_score') && !match_id) {
          throw new Error('Nie udało się powiązać pytania z wybranym meczem. Spróbuj ponownie po odświeżeniu listy spotkań.')
        }
        return {
          quiz_id: quiz!.id,
          kind: sl.kind,
          prompt,
          options,
          order_index: idx,
          match_id,
          correct: correctValue,
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
      correct: (k==='history_single'||k==='history_numeric') ? null : undefined,
    }) : s))
  }
  function updateSlot(i:number, data: Partial<Slot>) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, ...data }) : s)) }
  function addOption(i:number) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: [...(s.options||[]), ''] }) : s)) }
  function setOption(i:number, j:number, v:string) { setSlots(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).map((o,k)=> k===j ? v : o) }) : s)) }
  function removeOption(i:number, j:number) {
    setSlots(prev => prev.map((s,idx)=> {
      if (idx !== i) return s
      const opts = (s.options || []).slice()
      const removed = opts.splice(j,1)[0]
      const next: Slot = { ...s, options: opts }
      if (removed && next.correct === removed) next.correct = null
      return next
    }))
  }
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
      correct: null,
    }) : s))
  }
  function updatePrediction(i:number, data: Partial<Slot>) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, ...data }) : s)) }
  function addPredictionOption(i:number) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: [...(s.options||[]), ''] }) : s)) }
  function setPredictionOption(i:number, j:number, v:string) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).map((o,k)=> k===j ? v : o) }) : s)) }
  function removePredictionOption(i:number, j:number) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).filter((_,k)=>k!==j) }) : s)) }
  function autoFillPredictions() {
    if (!activeMatches.length) return
    setPredictions(prev =>
      prev.map((slot, idx) => {
        const match = activeMatches[idx] || activeMatches[0]
        return {
          ...slot,
          prompt: slot.prompt || (slot.kind === 'future_score' ? 'Jaki będzie dokładny wynik?' : 'Kto wygra mecz?'),
          match_id: match?.idEvent || null,
        }
      }),
    )
  }

  async function ensureRoundMatches(roundId: string, items: { kind: SlotKind; match_id?: string | null }[]) {
    const requiredExternal = Array.from(new Set(
      items
        .filter((item) => requiresExternalMatch(item.kind))
        .map((item) => item.match_id)
        .filter((id): id is string => Boolean(id) && !isUuid(id))
    ))
    if (!requiredExternal.length) return {}

    if (!matches.length) {
      throw new Error('Brak danych meczów. Odśwież listę spotkań i spróbuj ponownie.')
    }

    const byId = new Map(matches.map((m) => [m.idEvent, m]))
    const s = getSupabase()
    const { data: existing } = await s
      .from('matches')
      .select('id,home_team,away_team,kickoff_at')
      .eq('round_id', roundId)

    const keyToId = new Map<string, string>()
    ;(existing || []).forEach((row: any) => {
      keyToId.set(matchKey(row.home_team, row.away_team, row.kickoff_at), row.id)
    })

    const pending: { eventId: string; event: TheSportsDbEvent; kickoff: string }[] = []
    const mapping: Record<string, string> = {}

    for (const externalId of requiredExternal) {
      const event = byId.get(externalId)
      if (!event) {
        throw new Error('Wybrany mecz nie jest już dostępny. Odśwież listę spotkań i wybierz ponownie.')
      }
      const kickoffIso = toKickoffIso(event)
      const key = matchKey(event.strHomeTeam, event.strAwayTeam, kickoffIso)
      const existingId = keyToId.get(key)
      if (existingId) {
        mapping[externalId] = existingId
      } else {
        pending.push({ eventId: externalId, event, kickoff: kickoffIso })
      }
    }

    if (pending.length) {
      const insertPayload = pending.map(({ event, kickoff }) => ({
        round_id: roundId,
        home_team: event.strHomeTeam || 'Gospodarze',
        away_team: event.strAwayTeam || 'Goście',
        kickoff_at: kickoff,
      }))
      const { data, error } = await s
        .from('matches')
        .insert(insertPayload)
        .select('id,home_team,away_team,kickoff_at')
      if (error) throw error
      if (!data) throw new Error('Nie udało się zapisać meczów dla quizu.')
      data.forEach((row: any, idx: number) => {
        const ref = pending[idx]
        mapping[ref.eventId] = row.id
        keyToId.set(matchKey(row.home_team, row.away_team, row.kickoff_at), row.id)
      })
    }

    return mapping
  }

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
                <Select value={leagueId} onValueChange={setLeagueId} disabled={leaguesLoading || (!!leaguesError && !leagues.length)}>
                  <SelectTrigger className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                    <SelectValue placeholder="— wybierz ligę —" />
                  </SelectTrigger>
                  <SelectContent className="text-sm max-h-[280px]">
                    {leagues.map((l)=> (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <p className={leaguesError ? 'text-destructive' : 'text-muted-foreground'}>
                    {leaguesLoading && 'Ładuję listę lig…'}
                    {!leaguesLoading && leaguesError && leaguesError}
                    {!leaguesLoading && !leaguesError && leagues.length === 0 && 'Brak lig do wyboru.'}
                    {!leaguesLoading && !leaguesError && leagues.length > 0 && `${leagues.length} lig dostępnych.`}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-3 text-xs"
                    onClick={loadLeagues}
                    disabled={leaguesLoading}
                  >
                    Odśwież
                  </Button>
                </div>
              </div>
              {leagueId && (
                <div className="rounded-2xl border border-border/50 bg-muted/10 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Mecze ligi (TheSportsDB)</div>
                      {matchesSource && (
                        <p className="text-xs text-muted-foreground">
                          {matchesSource === 'next' ? 'Nadchodzące spotkania' : 'Ostatnie rozegrane mecze'}
                        </p>
                      )}
                    </div>
                    {matchesLoading && <span className="text-xs text-muted-foreground animate-pulse">Ładowanie…</span>}
                  </div>
                  {matchesError && <p className="text-xs text-destructive">{matchesError}</p>}
                  {!matchesError && matchesInfo && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{matchesInfo}</p>
                  )}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {matchesLoading && (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                        ))}
                      </div>
                    )}
                    {!matchesLoading && activeMatches.length === 0 && !matchesError && (
                      <p className="text-xs text-muted-foreground">Brak danych do wyświetlenia.</p>
                    )}
                    {!matchesLoading && activeMatches.slice(0, 8).map((m) => (
                      <div key={m.idEvent} className="rounded-2xl border border-border/40 bg-background/80 px-3 py-4 text-sm">
                        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                          <TeamRow name={m.strHomeTeam} badge={m.strHomeTeamBadge} />
                          <div className="flex flex-col items-center justify-center gap-1 min-w-[130px] text-xs text-muted-foreground">
                            <span className="uppercase tracking-[0.3em] text-[10px]">Start</span>
                            <span className="text-sm font-semibold text-white">
                              {formatEventDate(m)}
                            </span>
                            {matchesSource === 'past' && (m.intHomeScore || m.intAwayScore) && (
                              <span className="text-base font-bold text-white">
                                {(m.intHomeScore ?? '-') + ':' + (m.intAwayScore ?? '-')}
                              </span>
                            )}
                          </div>
                          <TeamRow name={m.strAwayTeam} badge={m.strAwayTeamBadge} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <NotchedInput borderless label={'Tytuł wiktoryny'} value={title} onChange={(e:any)=>setTitle(e.target.value)} />
              <NotchedInput borderless label={'Etykieta rundy/etapu (np. "14 kolejka")'} value={label} onChange={(e:any)=>setLabel(e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DateTimeField label="Początek publikacji" value={startsAt} onChange={setStartsAt} className="w-full" />
                <DateTimeField label="Deadline odpowiedzi" value={deadlineAt} onChange={setDeadlineAt} className="w-full" />
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
            <CardTitle>Historia — 3 pytania</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {slots.map((sl, i) => (
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
                      {(sl.options||['']).map((opt, j)=> {
                        const isCorrect = sl.correct === opt
                        return (
                          <div
                            key={j}
                            className={`flex items-center gap-2 rounded-md border px-2 py-1 transition ${isCorrect ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border/40 bg-muted/10'}`}
                          >
                            <input
                              value={opt}
                              onChange={(e)=>setOption(i,j,e.target.value)}
                              className="flex-1 rounded-md bg-transparent px-2 py-1 border-0 ring-0 focus:outline-none"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant={isCorrect ? 'default' : 'outline'}
                              onClick={()=>setHistoryCorrect(i,opt)}
                              className={isCorrect ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}
                            >
                              {isCorrect ? '✓ Poprawna' : 'Ustaw jako poprawną'}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={()=>removeOption(i,j)}>Usuń</Button>
                          </div>
                        )
                      })}
                    </div>
                    {sl.correct && (
                      <p className="text-xs text-emerald-400 mt-1">Aktualna odpowiedź poprawna: {sl.correct}</p>
                    )}
                    <Button size="sm" className="mt-2" variant="outline" onClick={()=>addOption(i)}>Dodaj opcję</Button>
                  </div>
                )}
                {sl.kind==='history_numeric' && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <NotchedInput borderless type="number" label={'Min'} value={sl.numeric?.min ?? 0} onChange={(e:any)=>updateSlot(i,{ numeric: { ...(sl.numeric||{}), min: parseInt(e.target.value||'0'), max: sl.numeric?.max ?? 6, step: sl.numeric?.step ?? 1 } })} />
                    <NotchedInput borderless type="number" label={'Max'} value={sl.numeric?.max ?? 6} onChange={(e:any)=>updateSlot(i,{ numeric: { ...(sl.numeric||{}), max: parseInt(e.target.value||'6'), min: sl.numeric?.min ?? 0, step: sl.numeric?.step ?? 1 } })} />
                    <NotchedInput borderless type="number" label={'Krok'} value={sl.numeric?.step ?? 1} onChange={(e:any)=>updateSlot(i,{ numeric: { ...(sl.numeric||{}), step: parseInt(e.target.value||'1'), min: sl.numeric?.min ?? 0, max: sl.numeric?.max ?? 6 } })} />
                    <NotchedInput borderless type="number" label={'Wartość'} value={sl.correct ?? ''} onChange={(e:any)=>setHistoryCorrect(i, e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Predykcje — 3 pytania</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={autoFillPredictions}
                disabled={matchesLoading || activeMatches.length === 0}
                className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white hover:from-emerald-600 hover:to-lime-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Auto-uzupełnij
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {predictions.map((pr, i) => {
              const selectedMatch = activeMatches.find((m) => m.idEvent === pr.match_id)
              return (
                <div key={i} className="rounded-lg border border-border/40 p-3 space-y-3">
                  <div className="text-sm font-medium">Predykcja #{i+1}</div>
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
                    <div>
                      <Label>Mecz</Label>
                      <Select value={pr.match_id || ''} onValueChange={(v)=>updatePrediction(i,{ match_id: v || null })}>
                        <SelectTrigger className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                          <SelectValue placeholder="— wybierz mecz —" />
                        </SelectTrigger>
                        <SelectContent className="text-sm max-h-[280px]">
                          {activeMatches.slice(0, 20).map((m) => (
                            <SelectItem key={m.idEvent} value={m.idEvent}>
                              {m.strHomeTeam} vs {m.strAwayTeam} • {m.strTimestamp ? new Date(m.strTimestamp).toLocaleString('pl-PL') : m.dateEvent}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedMatch && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedMatch.strLeague} • {selectedMatch.strHomeTeam} vs {selectedMatch.strAwayTeam}
                        </p>
                      )}
                    </div>
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
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground text-center mb-6">Po zakończeniu quizu pytania przyszłości zostaną rozliczone automatycznie na podstawie wyników meczów. Upewnij się, że wszystkie 6 pytań jest poprawnie ustawionych.</div>

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

function formatEventDate(event: TheSportsDbEvent) {
  if (event.strTimestamp) {
    const ts = new Date(event.strTimestamp)
    if (!Number.isNaN(ts.getTime())) {
      return ts.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
  }
  if (event.dateEvent && event.strTime) {
    return `${event.dateEvent} ${event.strTime.slice(0,5)}`
  }
  return event.dateEvent || 'TBA'
}

function TeamRow({ name, badge }: { name?: string | null; badge?: string | null }) {
  const label = (name || '—').trim()
  const tiny = badge ? toTinyBadge(badge) : null
  return (
    <div className="flex flex-col items-center text-center gap-1 min-w-[110px]">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-muted/60 border border-white/10 shadow-inner flex items-center justify-center">
        {tiny ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tiny} alt={label} className="h-12 w-12 object-contain drop-shadow-lg" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground text-base font-semibold grid place-items-center">
            {label.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      </div>
      <span className="text-sm font-medium leading-tight max-w-[120px] truncate">{label}</span>
    </div>
  )
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value?: string | null): boolean {
  return !!value && UUID_REGEX.test(value)
}

function shouldAttachMatch(kind: SlotKind): boolean {
  return kind === 'future_1x2' || kind === 'future_score' || kind === 'history_numeric'
}

function requiresExternalMatch(kind: SlotKind): boolean {
  return kind === 'future_1x2' || kind === 'future_score'
}

function normalizeMatchId(raw: string | null | undefined, mapping: Record<string, string>): string | null {
  if (!raw) return null
  if (isUuid(raw)) return raw
  return mapping[raw] || null
}
