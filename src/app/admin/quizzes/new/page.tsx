"use client";
import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  fetchLeagueFixtures,
  fetchLeagueResults,
  mapLeagueToApiId,
  type ScoreBusterMatch,
  type ScoreBusterTeam,
  getTeamLogoUrl,
} from '@/lib/footballApi'
import { eventTimestamp, matchKey, toKickoffIso } from '@/lib/matchUtils'
import {
  normalizePrizeBrackets,
  seedPrizeBrackets,
  sumPrizePools,
  generateBracketRowId,
  matchesDefaultBracketStructure,
  distributePrizeByDefaultRatios,
  type PrizeBracketRow,
} from '@/lib/prizeBrackets'
import { buildHistoryQuestionFromEntry, type HistoryBankEntry, type HistoryQuestionTemplate } from '@/lib/historyBank'
import { LoaderOverlay } from '@/components/ui/pitch-loader'

const FUTURE_STAT_KINDS = ['future_yellow_cards', 'future_corners'] as const
type FutureStatKind = (typeof FUTURE_STAT_KINDS)[number]
type SlotKind = 'history_single' | 'history_numeric' | 'future_1x2' | 'future_score' | FutureStatKind

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

export default function NewQuizPage() {
  const router = useRouter()
  const UPCOMING_WINDOW_MS = 1000 * 60 * 60 * 24 * 35
  const UPCOMING_MATCH_LIMIT = 20
  const [leagues, setLeagues] = React.useState<{id:string;name:string;code:string}[]>([])
  const [leaguesLoading, setLeaguesLoading] = React.useState(true)
  const [leaguesError, setLeaguesError] = React.useState<string | null>(null)
  const [leagueId, setLeagueId] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [labelTouched, setLabelTouched] = React.useState(false)
  const [startsAt, setStartsAt] = React.useState('')
  const [deadlineAt, setDeadlineAt] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState<string | undefined>(undefined)
  const [prize, setPrize] = React.useState('')
  const [prizeBrackets, setPrizeBrackets] = React.useState<PrizeBracketRow[]>(() => seedPrizeBrackets())
  const [publishNow, setPublishNow] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  // Matches by selected league (for future questions)
  const [matches, setMatches] = React.useState<ScoreBusterMatch[]>([])
  const [matchesLeagueId, setMatchesLeagueId] = React.useState<string | null>(null)
  const [matchesLoading, setMatchesLoading] = React.useState(false)
  const [matchesSource, setMatchesSource] = React.useState<'fixtures' | 'results' | null>(null)
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
    bank_entry_id?: string | null
    auto_prompt?: boolean
    meta?: {
      scoreLabel?: string | null
    }
  }
  const [slots, setSlots] = React.useState<Slot[]>([
    { kind: 'history_single', prompt: defaultPrompt('history_single'), options: [''], bank_entry_id: null },
    { kind: 'history_single', prompt: defaultPrompt('history_single'), options: [''], bank_entry_id: null },
    {
      kind: 'history_numeric',
      prompt: defaultPrompt('history_numeric'),
      numeric: getDefaultNumericConfig('history_numeric'),
      bank_entry_id: null,
    },
  ])
  // Predictions: 3 manual future questions
  const AUTO_PREDICTION_SEQUENCE: SlotKind[] = ['future_1x2', 'future_yellow_cards', 'future_score']
  const [predictions, setPredictions] = React.useState<Slot[]>(() => [
    createDefaultPrediction('future_1x2', 0),
    createDefaultPrediction('future_yellow_cards', 1),
    createDefaultPrediction('future_score', 2),
  ])
  const activeMatches = matchesLeagueId === leagueId ? matches : []
  const findMatchById = React.useCallback(
    (id?: string | null) => {
      if (!id) return null
      return activeMatches.find((m) => m.id === id) || null
    },
    [activeMatches],
  )
  const [selectedMatchId, setSelectedMatchId] = React.useState<string | null>(null)
  const [matchesCollapsed, setMatchesCollapsed] = React.useState(false)
  const selectedMatch = selectedMatchId ? activeMatches.find((m) => m.id === selectedMatchId) : null
  const prizeBracketsTotal = React.useMemo(() => sumPrizePools(prizeBrackets), [prizeBrackets])
  const [historyAutoLoading, setHistoryAutoLoading] = React.useState(false)
  const globalLoading = saving || (leaguesLoading && !leagues.length)
  const loaderMessage = saving ? 'Tworzymy nową wiktorynę…' : 'Ładujemy dane ligi…'

  function createDefaultPrediction(kind: SlotKind, index: number, match?: ScoreBusterMatch | null): Slot {
    return {
      kind,
      prompt: getFuturePrompt(kind, index, match),
      options: kind === 'future_1x2' ? ['1', 'X', '2'] : undefined,
      score: kind === 'future_score' ? { min_home: 0, max_home: 10, min_away: 0, max_away: 10 } : undefined,
      numeric: isFutureStatKind(kind) ? getDefaultNumericConfig(kind) : undefined,
      auto_prompt: true,
    }
  }

  function addPrizeBracketRow() {
    setPrizeBrackets((prev) => [
      ...prev,
      {
        id: generateBracketRowId(),
        correct: (prev[prev.length - 1]?.correct ?? 1) + 1,
        pool: 0,
      },
    ])
  }

  function updatePrizeBracketRow(id: string, field: keyof Omit<PrizeBracketRow, 'id'>, value: number) {
    setPrizeBrackets((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  function removePrizeBracketRow(id: string) {
    setPrizeBrackets((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.id !== id)
    })
  }

  const handlePrizeChange = React.useCallback((value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '')
    setPrize(sanitized)
  }, [])

  React.useEffect(() => { loadLeagues() }, [])

  React.useEffect(() => {
    const total = Number(prize)
    if (!Number.isFinite(total) || total <= 0) return
    setPrizeBrackets((prev) => {
      if (!matchesDefaultBracketStructure(prev)) return prev
      const next = distributePrizeByDefaultRatios(prev, total)
      const changed = next.some((row, idx) => row.pool !== prev[idx].pool)
      return changed ? next : prev
    })
  }, [prize])

  async function loadLeagues() {
    setLeaguesLoading(true)
    setLeaguesError(null)
    try {
      const res = await fetch('/api/admin/leagues', { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Nie udało się pobrać lig.')
      }
      const rows = Array.isArray(payload?.data) ? (payload.data as { id: string; name: string; code: string }[]) : []
      setLeagues(rows)
      if (!rows.length) {
        setLeaguesError('Brak lig w bazie. Dodaj je najpierw w panelu administracyjnym.')
      }
    } catch (err) {
      console.error('loadLeagues error', err)
      setLeagues([])
      setLeaguesError('Nie udało się pobrać lig. Spróbuj ponownie.')
    } finally {
      setLeaguesLoading(false)
    }
  }

  React.useEffect(() => {
    if (leagueId && leagues.length) loadMatchesForLeague(leagueId)
  }, [leagueId, leagues])
  React.useEffect(() => {
    setSelectedMatchId(null)
    setMatchesCollapsed(false)
    setLabelTouched(false)
  }, [leagueId])

  React.useEffect(() => {
    if (!leagueId || leagues.length === 0) {
      setTitle('')
      setLabel('')
      return
    }
    const league = leagues.find((l) => l.id === leagueId)
    const autoTitle = league?.name || ''
    setTitle(autoTitle)
    let cancelled = false
    ;(async () => {
      try {
        const suggested = await suggestLabelForLeague(leagueId)
        if (!cancelled) setLabel(suggested)
      } catch {
        if (!cancelled) setLabel('Kolejka 1')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [leagueId, leagues])

  React.useEffect(() => {
    if (selectedMatch?.round && !labelTouched) {
      setLabel(`Kolejka ${selectedMatch.round}`)
    }
  }, [selectedMatch?.round, labelTouched])

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
        setMatchesError('Brak przypisanego ID w ScoreBuster dla tej ligi.')
        return
      }
      const usedKeys = await fetchUsedMatchKeys(lid)
      const fixtures = filterMatchesByUsed(await fetchLeagueFixtures(apiId), usedKeys)
      const curatedUpcoming = curateUpcomingMatches(fixtures, UPCOMING_WINDOW_MS, UPCOMING_MATCH_LIMIT)
      if (curatedUpcoming.length) {
        setMatches(curatedUpcoming)
        setSelectedMatchId(null)
        setMatchesCollapsed(false)
        autoScheduleTimes(curatedUpcoming)
        setMatchesLeagueId(lid)
        setMatchesSource('fixtures')
        setMatchesError(null)
        setMatchesInfo(`Najbliższe ${curatedUpcoming.length} mecze.`)
        return
      }
      const results = filterMatchesByUsed(await fetchLeagueResults(apiId), usedKeys)
      const recent = curateRecentResults(results, UPCOMING_MATCH_LIMIT)
      if (recent.length) {
        setMatches(recent)
        setSelectedMatchId(null)
        setMatchesCollapsed(false)
        setMatchesLeagueId(lid)
        setMatchesSource('results')
        setMatchesError(null)
        setMatchesInfo('Brak zaplanowanych meczów — pokazuję ostatnie wyniki.')
      } else {
        setMatches([])
        setMatchesLeagueId(lid)
        setMatchesSource(null)
        setMatchesError('API ScoreBuster nie zwróciło żadnych meczów dla tej ligi.')
      }
    } catch (err) {
      console.error('loadMatchesForLeague error', err)
      setMatches([])
      setMatchesLeagueId(lid)
      setMatchesSource(null)
      setMatchesError('Nie udało się pobrać meczów z ScoreBuster API.')
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

  async function randomizeHistoryFromBank() {
    if (historyAutoLoading) return
    setHistoryAutoLoading(true)
    try {
      const s = getSupabase()
      const { data, error } = await s
        .from('history_question_bank')
        .select('id,template,home_team,away_team,home_score,away_score,played_at,payload')
        .eq('status', 'ready')
        .order('played_at', { ascending: false, nullsLast: false })
        .limit(20)
      if (error) throw error
      if (!data?.length) {
        alert('Brak gotowych pytań w banku.')
        return
      }
      const shuffled = [...data].sort(() => Math.random() - 0.5)
      const templatePriority: HistoryQuestionTemplate[] = ['winner_1x2', 'total_goals', 'total_yellow_cards', 'total_corners']
      const buckets = shuffled.reduce((acc, entry) => {
        const key = entry.template as HistoryQuestionTemplate
        acc[key] = acc[key] || []
        acc[key]!.push(entry)
        return acc
      }, {} as Record<HistoryQuestionTemplate, HistoryBankEntry[] | undefined>)
      const usedTemplates = new Set<HistoryQuestionTemplate>()
      const pickEntryForIndex = (): HistoryBankEntry | undefined => {
        const prioritized = [...templatePriority.filter(t => !usedTemplates.has(t)), ...templatePriority]
        for (const tmpl of prioritized) {
          const bucket = buckets[tmpl]
          if (bucket?.length) {
            const chosen = bucket.shift()
            if (chosen) usedTemplates.add(tmpl)
            return chosen
          }
        }
        for (const bucket of Object.values(buckets)) {
          if (bucket?.length) {
            return bucket.shift()
          }
        }
        return undefined
      }

      setSlots((prev) =>
        prev.map((slot, idx) => {
          const entry = pickEntryForIndex() ?? (shuffled[idx] as HistoryBankEntry | undefined)
          if (!entry) return { ...slot, bank_entry_id: null, meta: undefined }
          const generated = buildHistoryQuestionFromEntry(entry)
          if (!generated) return { ...slot, bank_entry_id: null, meta: undefined }
          if (generated.kind === 'history_single') {
            const optionsArray = Array.isArray(generated.options) ? generated.options : ['1', 'X', '2']
            return {
              ...slot,
              kind: 'history_single',
              prompt: generated.prompt,
              options: optionsArray,
              numeric: undefined,
              correct: generated.correct,
              bank_entry_id: entry.id,
              meta: generated.meta,
            }
          }
          const numericOptions = generated.options || { min: 0, max: 6, step: 1 }
          return {
            ...slot,
            kind: 'history_numeric',
            prompt: generated.prompt,
            numeric: numericOptions,
            options: undefined,
            correct: generated.correct,
            bank_entry_id: entry.id,
            meta: generated.meta,
          }
        }),
      )
    } catch (err: any) {
      console.error('randomizeHistoryFromBank', err)
      alert(err?.message || 'Nie udało się wylosować pytań.')
    } finally {
      setHistoryAutoLoading(false)
    }
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
      const leagueMeta = leagues.find((l) => l.id === leagueId)
      const safeTitle = title || leagueMeta?.name || 'Wiktoryna'
      let insert: any = { round_id: round!.id, title: safeTitle }
      if (imageUrl) insert.image_url = imageUrl
      if (prize) insert.prize = Number(prize)
      let quizRes = await s.from('quizzes').insert(insert).select('id').single()
      if (quizRes.error) {
        // Fallback if columns (image_url/prize) don't exist yet
        quizRes = await s.from('quizzes').insert({ round_id: round!.id, title }).select('id').single()
      }
      const quiz = quizRes.data
      const normalizedBrackets = normalizePrizeBrackets(prizeBrackets)
      if (!normalizedBrackets.length) {
        throw new Error('Dodaj co najmniej jeden próg nagród z dodatnią pulą.')
      }
      const bracketPayload = normalizedBrackets.map((bracket) => ({
        quiz_id: quiz!.id,
        correct_answers: bracket.correct_answers,
        pool: bracket.pool,
      }))
      const { error: bracketsError } = await s.from('quiz_prize_brackets').insert(bracketPayload as any)
      if (bracketsError) throw bracketsError
      // Validate: 3 history (manual or random) + 3 predictions (manual)
      const historyQuestions = slots
      if (historyQuestions.length !== 3) throw new Error('Ustaw 3 pytania historyczne')
      if (predictions.length !== 3) throw new Error('Ustaw 3 pytania predykcyjne')
      const all = [
        ...historyQuestions.map(s=>({ kind:s.kind, prompt:s.prompt, options:s.options, numeric: s.numeric, match_id:s.match_id, correct: s.correct })),
        ...predictions.map(s=>({ kind:s.kind, prompt:s.prompt, options:s.options, match_id:s.match_id, score: s.score, correct: null }))
      ]

      const matchIdMap = await ensureRoundMatches(round!.id, all)
      const payload = all.map((sl:any, idx:number) => {
        let options: any = null
        if (sl.kind === 'history_single' || sl.kind === 'future_1x2') options = sl.options || null
        if (sl.kind === 'history_numeric') options = sl.numeric || getDefaultNumericConfig('history_numeric')
        if (isFutureStatKind(sl.kind)) options = sl.numeric || getDefaultNumericConfig(sl.kind)
        if (sl.kind === 'future_score') options = sl.score || sl.options || { min_home: 0, max_home: 10, min_away: 0, max_away: 10 }
        const prompt = sl.prompt && sl.prompt.trim().length ? sl.prompt : defaultPrompt(sl.kind)
        const autoCorrect = requiresExternalMatch(sl.kind)
        const correctValue = autoCorrect ? null : (typeof sl.correct === 'undefined' ? null : sl.correct)
        if (requiresExternalMatch(sl.kind) && !sl.match_id) {
          throw new Error('Wybierz mecz dla każdego pytania przyszłościowego.')
        }
        const match_id = shouldAttachMatch(sl.kind) ? normalizeMatchId(sl.match_id, matchIdMap) : null
        if (requiresExternalMatch(sl.kind) && !match_id) {
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
      const bankIds = Array.from(new Set(
        slots
          .map((slot) => slot.bank_entry_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ))
      if (bankIds.length) {
        await s
          .from('history_question_bank')
          .update({ status: 'used', used_in_quiz_id: quiz!.id, used_at: new Date().toISOString() })
          .in('id', bankIds)
      }
      router.push(`/admin/quizzes/${quiz!.id}`)
    } finally {
      setSaving(false)
    }
  }

  function setKind(i:number, k: SlotKind) {
    setSlots(prev =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        const needsNumeric = k === 'history_numeric' || isFutureStatKind(k)
        return {
          ...s,
          kind: k,
          prompt: s.prompt?.trim().length ? s.prompt : defaultPrompt(k),
          options:
            k === 'history_single'
              ? (Array.isArray(s.options) && s.options.length ? s.options : [''])
              : k === 'future_1x2'
                ? ['1', 'X', '2']
                : undefined,
          match_id: shouldAttachMatch(k) ? s.match_id || null : null,
          numeric: needsNumeric ? s.numeric || getDefaultNumericConfig(k) : undefined,
          score: k === 'future_score' ? s.score || { min_home: 0, max_home: 10, min_away: 0, max_away: 10 } : undefined,
          correct: k === 'history_single' || k === 'history_numeric' ? null : undefined,
          bank_entry_id: k.startsWith('history') ? s.bank_entry_id ?? null : null,
        }
      }),
    )
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
  const normalizePredictionSlotForKind = React.useCallback(
    (slot: Slot, idx: number, kind: SlotKind): Slot => {
      const needsNumeric = isFutureStatKind(kind)
      const shouldLinkMatch = shouldAttachMatch(kind)
      const fallbackMatchId = shouldLinkMatch ? (slot.match_id || selectedMatchId || null) : null
      const matchData = shouldLinkMatch ? findMatchById(fallbackMatchId) : null
      const lockedPrompt = shouldLockPrompt(kind)
      const basePrompt = getFuturePrompt(kind, idx, matchData)
      const prompt =
        lockedPrompt || slot.auto_prompt !== false
          ? basePrompt
          : slot.prompt?.trim().length
            ? slot.prompt
            : basePrompt
      return {
        ...slot,
        kind,
        prompt,
        options: kind === 'future_1x2' ? ['1', 'X', '2'] : undefined,
        match_id: fallbackMatchId,
        numeric: needsNumeric ? slot.numeric || getDefaultNumericConfig(kind) : undefined,
        score:
          kind === 'future_score'
            ? slot.score || { min_home: 0, max_home: 10, min_away: 0, max_away: 10 }
            : undefined,
        correct: kind === slot.kind ? slot.correct : null,
        auto_prompt: lockedPrompt ? true : slot.auto_prompt,
      }
    },
    [findMatchById, selectedMatchId],
  )

  function setPredictionKind(i:number, k: SlotKind) {
    setPredictions(prev =>
      prev.map((s, idx) => (idx === i ? normalizePredictionSlotForKind(s, idx, k) : s)),
    )
  }
  function updatePrediction(i:number, data: Partial<Slot>) {
    setPredictions(prev =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        let next: Slot = { ...s, ...data }
        const isLocked = shouldLockPrompt(next.kind)
        if (isLocked) {
          next.prompt = getFuturePrompt(next.kind, idx, findMatchById(next.match_id))
          next.auto_prompt = true
        }
        if (typeof data.prompt !== 'undefined' && !isLocked) {
          next.auto_prompt = false
        }
        const matchChanged = Object.prototype.hasOwnProperty.call(data, 'match_id')
        if (matchChanged && next.auto_prompt !== false && shouldAttachMatch(next.kind)) {
          const match = findMatchById(next.match_id)
          next.prompt = getFuturePrompt(next.kind, idx, match)
          next.auto_prompt = true
        }
        return next
      }),
    )
  }
  function addPredictionOption(i:number) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: [...(s.options||[]), ''] }) : s)) }
  function setPredictionOption(i:number, j:number, v:string) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).map((o,k)=> k===j ? v : o) }) : s)) }
  function removePredictionOption(i:number, j:number) { setPredictions(prev => prev.map((s,idx)=> idx===i ? ({ ...s, options: (s.options||[]).filter((_,k)=>k!==j) }) : s)) }
  function autoFillPredictions() {
    if (!activeMatches.length) return
    const chosen = selectedMatchId
      ? activeMatches.find((m) => m.id === selectedMatchId)
      : activeMatches[0]
    if (!chosen) return
    setPredictions((prev) =>
      prev.map((slot, idx) => {
        const targetKind = AUTO_PREDICTION_SEQUENCE[idx % AUTO_PREDICTION_SEQUENCE.length] ?? slot.kind
        const prepared = slot.kind === targetKind ? slot : normalizePredictionSlotForKind(slot, idx, targetKind)
        if (shouldLockPrompt(prepared.kind)) {
          return {
            ...prepared,
            match_id: chosen.id,
            prompt: getFuturePrompt(prepared.kind, idx, chosen),
            auto_prompt: true,
          }
        }
        if (prepared.auto_prompt === false) {
          return { ...prepared, match_id: chosen.id }
        }
        return {
          ...prepared,
          match_id: chosen.id,
          prompt: getFuturePrompt(prepared.kind, idx, chosen),
          auto_prompt: true,
        }
      }),
    )
    if (!selectedMatchId) {
      setSelectedMatchId(chosen.id)
    }
    setMatchesCollapsed(true)
  }

  function handleMatchPick(match: ScoreBusterMatch) {
    setSelectedMatchId(match.id)
    setMatchesCollapsed(true)
    scheduleDeadlineForMatch(match)
    setPredictions((prev) =>
      prev.map((slot, idx) => {
        const targetKind = AUTO_PREDICTION_SEQUENCE[idx % AUTO_PREDICTION_SEQUENCE.length] ?? slot.kind
        const prepared = slot.kind === targetKind ? slot : normalizePredictionSlotForKind(slot, idx, targetKind)
        if (shouldLockPrompt(prepared.kind)) {
          return {
            ...prepared,
            match_id: match.id,
            prompt: getFuturePrompt(prepared.kind, idx, match),
            auto_prompt: true,
          }
        }
        if (prepared.auto_prompt === false) {
          return { ...prepared, match_id: match.id }
        }
        return {
          ...prepared,
          match_id: match.id,
          prompt: getFuturePrompt(prepared.kind, idx, match),
          auto_prompt: true,
        }
      }),
    )
  }

  function autoScheduleTimes(list: ScoreBusterMatch[]) {
    if (!list.length) return
    scheduleDeadlineForMatch(list[0])
  }

  function scheduleDeadlineForMatch(match?: ScoreBusterMatch | null) {
    if (!match) return
    const ts = eventTimestamp(match)
    if (!ts) return
    const deadlineTs = new Date(ts.getTime() - 15 * 60 * 1000)
    setDeadlineAt(toInputValue(deadlineTs))
    if (!startsAt) {
      const now = new Date()
      setStartsAt(toInputValue(now < ts ? now : ts))
    }
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

    const byId = new Map(matches.map((m) => [m.id, m]))
    const s = getSupabase()
    const { data: existing } = await s
      .from('matches')
      .select('id,home_team,away_team,kickoff_at,round_label,external_match_id')
      .eq('round_id', roundId)

    const keyToId = new Map<string, string>()
    const externalToId = new Map<string, string>()
    ;(existing || []).forEach((row: any) => {
      keyToId.set(matchKey(row.home_team, row.away_team, row.kickoff_at), row.id)
      if (row.external_match_id) {
        externalToId.set(row.external_match_id, row.id)
      }
    })

    const pending: { eventId: string; event: ScoreBusterMatch; kickoff: string }[] = []
    const mapping: Record<string, string> = {}

    for (const externalId of requiredExternal) {
      const direct = externalToId.get(externalId)
      if (direct) {
        mapping[externalId] = direct
        continue
      }
      const event = byId.get(externalId)
      if (!event) {
        throw new Error('Wybrany mecz nie jest już dostępny. Odśwież listę spotkań i wybierz ponownie.')
      }
      const kickoffIso = toKickoffIso(event)
      const key = matchKey(event.homeTeam.name, event.awayTeam.name, kickoffIso)
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
        external_match_id: event.id,
        home_team: event.homeTeam.name || 'Gospodarze',
        home_team_external_id: event.homeTeam.id ? String(event.homeTeam.id) : null,
        away_team: event.awayTeam.name || 'Goście',
        away_team_external_id: event.awayTeam.id ? String(event.awayTeam.id) : null,
        kickoff_at: kickoff,
        round_label: event.round ? `Kolejka ${event.round}` : null,
      }))
      const { data, error } = await s
        .from('matches')
        .insert(insertPayload)
        .select('id,home_team,away_team,kickoff_at,round_label,external_match_id')
      if (error) throw error
      if (!data) throw new Error('Nie udało się zapisać meczów dla quizu.')
      data.forEach((row: any, idx: number) => {
        const ref = pending[idx]
        mapping[ref.eventId] = row.id
        keyToId.set(matchKey(row.home_team, row.away_team, row.kickoff_at), row.id)
        if (row.external_match_id) {
          externalToId.set(row.external_match_id, row.id)
        }
      })
    }

    return mapping
  }

  async function fetchUsedMatchKeys(leagueId: string): Promise<Set<string>> {
    try {
      const s = getSupabase()
      const { data } = await s
        .from('matches')
        .select('home_team,away_team,kickoff_at,rounds!inner(league_id)')
        .eq('rounds.league_id', leagueId)
      const keys = new Set<string>()
      for (const row of data || []) {
        keys.add(matchKey(row.home_team, row.away_team, row.kickoff_at))
      }
      return keys
    } catch (err) {
      console.error('fetchUsedMatchKeys error', err)
      return new Set<string>()
    }
  }

function filterMatchesByUsed(matches: ScoreBusterMatch[] | undefined, used: Set<string>) {
  if (!matches || matches.length === 0 || used.size === 0) return matches || []
  return matches.filter((match) => {
    const key = matchKey(match.homeTeam.name, match.awayTeam.name, toKickoffIso(match))
    return !used.has(key)
  })
}

function curateUpcomingMatches(matches: ScoreBusterMatch[] | undefined, windowMs: number, limit: number) {
  if (!matches || matches.length === 0) return []
  const now = Date.now()
  const windowLimit = now + windowMs
  const enriched = matches
    .map((match) => {
      const ts = eventTimestamp(match)
      return ts
        ? {
            match,
            time: ts.getTime(),
          }
        : null
    })
    .filter((entry): entry is { match: ScoreBusterMatch; time: number } => Boolean(entry))
  if (!enriched.length) return []

  let upcoming = enriched.filter((item) => item.time >= now && item.time <= windowLimit)
  if (!upcoming.length) {
    upcoming = enriched.filter((item) => item.time >= now)
  }
  if (!upcoming.length) return []

  return upcoming
    .sort((a, b) => a.time - b.time)
    .slice(0, limit)
    .map((item) => item.match)
}

function curateRecentResults(matches: ScoreBusterMatch[] | undefined, limit: number) {
  if (!matches || matches.length === 0) return []
  const now = Date.now()
  return matches
    .map((match) => {
      const ts = eventTimestamp(match)
      return ts ? { match, time: ts.getTime() } : null
    })
    .filter((entry): entry is { match: ScoreBusterMatch; time: number } => {
      if (!entry) return false
      return entry.time <= now
    })
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map((item) => item.match)
}

  return (
    <>
      <LoaderOverlay show={globalLoading} message={loaderMessage} />
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
                      <div className="text-sm font-semibold">Mecze ligi (ScoreBuster)</div>
                      {matchesSource && (
                        <p className="text-xs text-muted-foreground">
                          {matchesSource === 'fixtures' ? 'Nadchodzące spotkania' : 'Ostatnie rozegrane mecze'}
                        </p>
                      )}
                    </div>
                    {matchesLoading && <span className="text-xs text-muted-foreground animate-pulse">Ładowanie…</span>}
                  </div>
                  {matchesError && <p className="text-xs text-destructive">{matchesError}</p>}
                  {!matchesError && matchesInfo && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{matchesInfo}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {matchesCollapsed && selectedMatch
                      ? 'Wybrany mecz przypisano do wszystkich pytań przyszłościowych.'
                      : 'Kliknij mecz, aby przypisać go do pytań przyszłościowych.'}
                  </div>
                  {matchesCollapsed && selectedMatch ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-emerald-400 bg-emerald-500/5 px-3 py-4 text-sm">
                        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                          <TeamRow team={selectedMatch.homeTeam} />
                          <div className="flex flex-col items-center justify-center gap-1 min-w-[130px] text-xs text-muted-foreground">
                            <span className="uppercase tracking-[0.3em] text-[10px]">Start</span>
                            <span className="text-sm font-semibold text-white">
                              {formatMatchDate(selectedMatch)}
                            </span>
                            {selectedMatch.round && (
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
                                Kolejka {selectedMatch.round}
                              </span>
                            )}
                            {matchesSource === 'results' && (typeof selectedMatch.homeTeam.score === 'number' || typeof selectedMatch.awayTeam.score === 'number') && (
                              <span className="text-base font-bold text-white">
                                {(typeof selectedMatch.homeTeam.score === 'number' ? selectedMatch.homeTeam.score : '-') +
                                  ':' +
                                  (typeof selectedMatch.awayTeam.score === 'number' ? selectedMatch.awayTeam.score : '-')}
                              </span>
                            )}
                          </div>
                          <TeamRow team={selectedMatch.awayTeam} />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={()=>setMatchesCollapsed(false)}>
                        Zmień mecz
                      </Button>
                    </div>
                  ) : (
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
                      {!matchesLoading && activeMatches.slice(0, 8).map((m) => {
                        const isSelected = selectedMatchId === m.id
                        return (
                          <div
                            key={m.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleMatchPick(m)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleMatchPick(m)
                              }
                            }}
                            className={`rounded-2xl border px-3 py-4 text-sm transition cursor-pointer ${
                              isSelected
                                ? 'border-emerald-400 bg-emerald-500/10'
                                : 'border-border/40 bg-background/80 hover:border-emerald-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                              <TeamRow team={m.homeTeam} />
                              <div className="flex flex-col items-center justify-center gap-1 min-w-[130px] text-xs text-muted-foreground">
                                <span className="uppercase tracking-[0.3em] text-[10px]">Start</span>
                                <span className="text-sm font-semibold text-white">
                                  {formatMatchDate(m)}
                                </span>
                                {m.round && (
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
                                    Kolejka {m.round}
                                  </span>
                                )}
                                {matchesSource === 'results' && (typeof m.homeTeam.score === 'number' || typeof m.awayTeam.score === 'number') && (
                                  <span className="text-base font-bold text-white">
                                    {(typeof m.homeTeam.score === 'number' ? m.homeTeam.score : '-') +
                                      ':' +
                                      (typeof m.awayTeam.score === 'number' ? m.awayTeam.score : '-')}
                                  </span>
                                )}
                              </div>
                              <TeamRow team={m.awayTeam} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label>Tytuł wiktoryny</Label>
                <div className="mt-1 h-11 rounded-xl border border-border/40 bg-muted/20 px-4 flex items-center text-sm text-muted-foreground">
                  {title || '— wybierz ligę —'}
                </div>
              </div>
          <NotchedInput
            borderless
            label={'Etykieta rundy/etapu (np. "14 kolejka")'}
            value={label}
            onChange={(e:any)=>{ setLabel(e.target.value); setLabelTouched(true) }}
          />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DateTimeField label="Początek publikacji" value={startsAt} onChange={setStartsAt} className="w-full" />
                <div>
                  <Label>Deadline odpowiedzi</Label>
                  <div className="mt-1 h-11 rounded-xl border border-border/40 bg-muted/20 px-4 flex items-center text-sm text-muted-foreground">
                    {deadlineAt ? formatInputDisplay(deadlineAt) : 'Ustawi się automatycznie po wyborze meczu'}
                  </div>
                </div>
              </div>
              <NotchedInput
                borderless
                inputMode="numeric"
                pattern="[0-9]*"
                label={'Nagroda (zł)'}
                value={prize}
                onChange={(e:any)=>handlePrizeChange(e.target.value)}
              />
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
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Historia — 3 pytania</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={randomizeHistoryFromBank}
                disabled={historyAutoLoading}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {historyAutoLoading ? 'Losuję…' : 'Losuj z banku'}
              </Button>
            </div>
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
                  {sl.meta?.scoreLabel && (
                    <p className="text-xs text-white/60">
                      Wynik meczu: <span className="font-semibold text-white">{sl.meta.scoreLabel}</span>
                    </p>
                  )}
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
              const selectedMatch = activeMatches.find((m) => m.id === pr.match_id)
              const promptValue = shouldLockPrompt(pr.kind)
                ? pr.prompt || getFuturePrompt(pr.kind, i, findMatchById(pr.match_id))
                : pr.prompt
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
                          <SelectItem value="future_yellow_cards">Żółte kartki (łączna liczba)</SelectItem>
                          <SelectItem value="future_corners">Rzuty rożne (łączna liczba)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <NotchedInput
                      borderless
                      label={'Treść pytania'}
                      value={promptValue ?? ''}
                      disabled={shouldLockPrompt(pr.kind)}
                      onChange={(e:any)=>updatePrediction(i,{ prompt: e.target.value })}
                    />
                    <div>
                      <Label>Mecz</Label>
                      <Select value={pr.match_id || ''} onValueChange={(v)=>updatePrediction(i,{ match_id: v || null })}>
                        <SelectTrigger className="mt-1 h-9 w-full rounded-md bg-muted/20 border-0 ring-0 focus:ring-0">
                          <SelectValue placeholder="— wybierz mecz —" />
                        </SelectTrigger>
                        <SelectContent className="text-sm max-h-[280px]">
                          {activeMatches.slice(0, 20).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.homeTeam.name} vs {m.awayTeam.name} • {formatMatchDate(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedMatch && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(selectedMatch.round ? `Runda ${selectedMatch.round}` : 'Mecz ligowy')} • {selectedMatch.homeTeam.name} vs {selectedMatch.awayTeam.name}
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
                  {isFutureStatKind(pr.kind) && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <NotchedInput
                        borderless
                        type="number"
                        label={'Min'}
                        value={pr.numeric?.min ?? getDefaultNumericConfig(pr.kind)?.min ?? 0}
                        onChange={(e:any)=>updatePrediction(i,{ numeric: { ...(pr.numeric||{}), min: parseInt(e.target.value||'0'), max: pr.numeric?.max ?? getDefaultNumericConfig(pr.kind)?.max ?? 10, step: pr.numeric?.step ?? 1 } })}
                      />
                      <NotchedInput
                        borderless
                        type="number"
                        label={'Max'}
                        value={pr.numeric?.max ?? getDefaultNumericConfig(pr.kind)?.max ?? 10}
                        onChange={(e:any)=>updatePrediction(i,{ numeric: { ...(pr.numeric||{}), max: parseInt(e.target.value||'10'), min: pr.numeric?.min ?? getDefaultNumericConfig(pr.kind)?.min ?? 0, step: pr.numeric?.step ?? 1 } })}
                      />
                      <NotchedInput
                        borderless
                        type="number"
                        label={'Krok'}
                        value={pr.numeric?.step ?? 1}
                        onChange={(e:any)=>updatePrediction(i,{ numeric: { ...(pr.numeric||{}), step: parseInt(e.target.value||'1'), min: pr.numeric?.min ?? getDefaultNumericConfig(pr.kind)?.min ?? 0, max: pr.numeric?.max ?? getDefaultNumericConfig(pr.kind)?.max ?? 10 } })}
                      />
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
    </>
  )
}

function kindLabel(k: string) {
  switch (k) {
    case 'history_single': return 'Jednokrotny wybór'
    case 'history_numeric': return 'Wartość liczbowa'
    case 'future_1x2': return '1X2 (przyszłość)'
    case 'future_score': return 'Dokładny wynik'
    case 'future_yellow_cards': return 'Żółte kartki (przyszłość)'
    case 'future_corners': return 'Rzuty rożne (przyszłość)'
    default: return k
  }
}

function defaultPrompt(k: SlotKind) {
  switch (k) {
    case 'history_single': return 'Wybierz poprawną odpowiedź'
    case 'history_numeric': return 'Podaj wartość'
    case 'future_1x2': return FUTURE_1X2_PROMPT_VARIANTS[0].replace('{MATCH}', 'tym meczu').replace('{HOME}', 'gospodarze').replace('{AWAY}', 'goście')
    case 'future_score': return FUTURE_SCORE_PROMPT_VARIANTS[0].replace('{MATCH}', 'tym meczu').replace('{HOME}', 'gospodarze').replace('{AWAY}', 'goście')
    case 'future_yellow_cards': return FUTURE_STAT_PROMPT_VARIANTS.future_yellow_cards.replace('{MATCH}', 'tym meczu')
    case 'future_corners': return FUTURE_STAT_PROMPT_VARIANTS.future_corners.replace('{MATCH}', 'tym meczu')
    default: return 'Podaj wartość'
  }
}

const FUTURE_1X2_PROMPT_VARIANTS = [
  'Kto wygra mecz {MATCH}?',
  'Która drużyna zgarnie komplet punktów w starciu {MATCH}?',
  'Czy {HOME} okaże się lepszy od {AWAY}?',
]

const FUTURE_SCORE_PROMPT_VARIANTS = [
  'Jaki będzie dokładny wynik meczu {MATCH}?',
  'Podaj końcowy rezultat pojedynku {MATCH}.',
]

const FUTURE_STAT_PROMPT_VARIANTS: Record<FutureStatKind, string> = {
  future_yellow_cards: 'Ile żółtych kartek padnie w meczu {MATCH}?',
  future_corners: 'Ile rzutów rożnych zobaczymy w meczu {MATCH}?',
}

function getFuturePrompt(kind: SlotKind, index: number, match?: ScoreBusterMatch | null): string {
  switch (kind) {
    case 'future_1x2': {
      const tpl = FUTURE_1X2_PROMPT_VARIANTS[index % FUTURE_1X2_PROMPT_VARIANTS.length]
      return formatFuturePrompt(tpl, match)
    }
    case 'future_score': {
      const tpl = FUTURE_SCORE_PROMPT_VARIANTS[index % FUTURE_SCORE_PROMPT_VARIANTS.length]
      return formatFuturePrompt(tpl, match)
    }
    case 'future_yellow_cards':
    case 'future_corners': {
      const tpl = FUTURE_STAT_PROMPT_VARIANTS[kind]
      return formatFuturePrompt(tpl, match)
    }
    default:
      return defaultPrompt(kind)
  }
}

function formatFuturePrompt(template: string, match?: ScoreBusterMatch | null) {
  const home = match?.homeTeam?.name?.trim().length ? match.homeTeam.name : 'gospodarze'
  const away = match?.awayTeam?.name?.trim().length ? match.awayTeam.name : 'goście'
  const label = match ? `${home} vs ${away}` : 'tym meczu'
  return template.replace(/{MATCH}/g, label).replace(/{HOME}/g, home).replace(/{AWAY}/g, away)
}

function isFutureStatKind(kind: SlotKind | string | undefined): kind is FutureStatKind {
  if (!kind) return false
  return (FUTURE_STAT_KINDS as readonly string[]).includes(kind as any)
}

function shouldLockPrompt(kind: SlotKind) {
  return isFutureStatKind(kind)
}

function getDefaultNumericConfig(kind: SlotKind) {
  if (kind === 'history_numeric') {
    return { min: 0, max: 6, step: 1 }
  }
  if (isFutureStatKind(kind)) {
    const base = FUTURE_STAT_DEFAULTS[kind].numeric
    return { ...base }
  }
  return undefined
}

function defaultSlot(): { kind: 'history_single'; prompt: string; options: string[]; bank_entry_id: string | null } {
  return { kind: 'history_single', prompt: '', options: [''], bank_entry_id: null }
}

function move<T>(arr: T[], idx: number, delta: number): T[] {
  const out = [...arr]
  const t = idx + delta
  if (t < 0 || t >= out.length) return out
  const [a] = out.splice(idx,1)
  out.splice(t,0,a)
  return out
}

function formatMatchDate(match: ScoreBusterMatch) {
  const ts = eventTimestamp(match)
  if (ts && !Number.isNaN(ts.getTime())) {
    return ts.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  return match.kickoff || 'TBA'
}

function TeamRow({ team }: { team?: ScoreBusterTeam | null }) {
  const label = (team?.name || '—').trim()
  const logo = team?.id ? getTeamLogoUrl(team.id, 'small') : null
  return (
    <div className="flex flex-col items-center text-center gap-1 min-w-[110px]">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-muted/60 border border-white/10 shadow-inner flex items-center justify-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={label} className="h-12 w-12 object-contain drop-shadow-lg" />
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
  return kind === 'history_numeric' || kind === 'future_1x2' || kind === 'future_score' || isFutureStatKind(kind)
}

function requiresExternalMatch(kind: SlotKind): boolean {
  return kind === 'future_1x2' || kind === 'future_score' || isFutureStatKind(kind)
}

function normalizeMatchId(raw: string | null | undefined, mapping: Record<string, string>): string | null {
  if (!raw) return null
  if (isUuid(raw)) return raw
  return mapping[raw] || null
}

async function suggestLabelForLeague(leagueId: string) {
  const s = getSupabase()
  const { count, error } = await s
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)
  if (error) throw error
  const next = (count ?? 0) + 1
  return `Kolejka ${next}`
}

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatInputDisplay(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
