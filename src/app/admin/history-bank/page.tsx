"use client";

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getSupabase } from '@/lib/supabaseClient'
import { fetchLeagueResults, mapLeagueToApiId, type ScoreBusterMatch } from '@/lib/footballApi'
import { buildHistoryQuestionFromEntry, type HistoryQuestionTemplate, type HistoryBankEntry } from '@/lib/historyBank'
import { RefreshCcw, Download, Archive } from 'lucide-react'

const LEAGUE_OPTIONS = [
  { label: 'PKO Ekstraklasa', code: 'EKSTRA', apiId: '899985' },
  { label: 'Premier League', code: 'EPL', apiId: '900326' },
  { label: 'La Liga', code: 'LALIGA', apiId: '901074' },
  { label: 'Serie A', code: 'SERIEA', apiId: '899984' },
  { label: 'Bundesliga', code: 'BUND', apiId: '899867' },
]

type BankRow = HistoryBankEntry & {
  status: string
  template: HistoryQuestionTemplate
  played_at: string | null
  created_at?: string | null
}

export default function HistoryBankPage() {
  const { toast } = useToast()
  const supabase = React.useMemo(() => getSupabase(), [])
  const [leagueOptions, setLeagueOptions] = React.useState(LEAGUE_OPTIONS)
  const [leagueOptionsLoading, setLeagueOptionsLoading] = React.useState(false)
  const [loadingBank, setLoadingBank] = React.useState(true)
  const [bankEntries, setBankEntries] = React.useState<BankRow[]>([])
  const [statusFilter, setStatusFilter] = React.useState<'all'|'ready'|'used'|'archived'>('ready')
  const [results, setResults] = React.useState<ScoreBusterMatch[]>([])
  const [resultsLoading, setResultsLoading] = React.useState(false)
  const [resultsError, setResultsError] = React.useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = React.useState<string>(LEAGUE_OPTIONS[0]?.apiId || '')
  const [importing, setImporting] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadBankEntries()
  }, [])

  React.useEffect(() => {
    loadLeagueOptions()
  }, [])

  async function loadLeagueOptions() {
    setLeagueOptionsLoading(true)
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('name,code')
        .order('name', { ascending: true })
      if (error) throw error
      const mapped =
        (data || [])
          .map((row) => {
            const apiId = mapLeagueToApiId(row.name, row.code)
            if (!apiId) return null
            return {
              label: row.name || row.code || apiId,
              apiId,
            }
          })
          .filter((row): row is { label: string; apiId: string } => Boolean(row)) || []
      const deduped = mapped.length
        ? Array.from(new Map(mapped.map((row) => [row.apiId, row])).values())
        : LEAGUE_OPTIONS
      setLeagueOptions(deduped)
      setSelectedLeague((prev) => {
        if (prev && deduped.some((row) => row.apiId === prev)) return prev
        return deduped[0]?.apiId || ''
      })
    } catch (err) {
      console.error('loadLeagueOptions', err)
      setLeagueOptions(LEAGUE_OPTIONS)
      setSelectedLeague((prev) => prev || LEAGUE_OPTIONS[0]?.apiId || '')
    } finally {
      setLeagueOptionsLoading(false)
    }
  }

  async function loadBankEntries() {
    setLoadingBank(true)
    try {
      const { data, error } = await supabase
        .from('history_question_bank')
        .select('id,match_identifier,template,home_team,away_team,home_score,away_score,played_at,status,league_code,source_kind,created_at')
        .order('played_at', { ascending: false, nullsLast: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setBankEntries((data || []) as BankRow[])
    } catch (err: any) {
      console.error('loadBankEntries', err)
      toast({ title: 'Błąd pobierania banku', description: err?.message ?? '', variant: 'destructive' as any })
      setBankEntries([])
    } finally {
      setLoadingBank(false)
    }
  }

  async function fetchResultsForLeague(leagueId: string) {
    if (!leagueId) {
      setResults([])
      setResultsError('Brak ligi z przypisanym ID ScoreBuster.')
      return
    }
    setResults([])
    setResultsError(null)
    setResultsLoading(true)
    try {
      const matches = await fetchLeagueResults(leagueId)
      const withScores = matches.filter(
        (m) => typeof m.homeTeam.score === 'number' && typeof m.awayTeam.score === 'number',
      )
      setResults(withScores)
      if (!withScores.length) {
        setResultsError('Brak zakończonych meczów w tym źródle.')
      }
    } catch (err: any) {
      console.error('fetch results', err)
      setResultsError(err?.message || 'Nie udało się pobrać wyników.')
    } finally {
      setResultsLoading(false)
    }
  }

  function buildRow(match: ScoreBusterMatch, template: HistoryQuestionTemplate) {
    if (typeof match.homeTeam.score !== 'number' || typeof match.awayTeam.score !== 'number') {
      throw new Error('score_missing')
    }
    return {
      match_identifier: `${match.leagueId}:${match.id}`,
      template,
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      home_score: match.homeTeam.score,
      away_score: match.awayTeam.score,
      played_at: match.kickoff,
      league_code: match.leagueId,
      source_kind: 'api',
      status: 'ready',
      payload: {
        round: match.round,
        leagueId: match.leagueId,
      },
    }
  }

  async function importMatch(match: ScoreBusterMatch, template: HistoryQuestionTemplate) {
    try {
      setImporting(`${match.id}-${template}`)
      const row = buildRow(match, template)
      const { error } = await supabase
        .from('history_question_bank')
        .upsert(row as any, { onConflict: 'match_identifier,template' })
      if (error) throw error
      toast({ title: 'Dodano mecz do banku' })
      await loadBankEntries()
    } catch (err: any) {
      console.error('importMatch', err)
      toast({ title: 'Błąd importu', description: err?.message ?? '', variant: 'destructive' as any })
    } finally {
      setImporting(null)
    }
  }

  async function archiveEntry(id: string) {
    try {
      const { error } = await supabase
        .from('history_question_bank')
        .update({ status: 'archived' })
        .eq('id', id)
      if (error) throw error
      setBankEntries((prev) => prev.map((row) => (row.id === id ? { ...row, status: 'archived' } : row)))
      toast({ title: 'Zarchiwizowano wpis' })
    } catch (err: any) {
      toast({ title: 'Błąd aktualizacji', description: err?.message ?? '', variant: 'destructive' as any })
    }
  }

  const filteredEntries =
    statusFilter === 'all'
      ? bankEntries
      : bankEntries.filter((row) => row.status === statusFilter)

  function templateLabel(template: HistoryQuestionTemplate) {
    switch (template) {
      case 'winner_1x2':
        return 'Zwycięzca meczu'
      case 'total_goals':
        return 'Suma goli'
      default:
        return template
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-extrabold uppercase">Bank pytań historycznych</h1>
        <p className="text-sm text-muted-foreground">
          Wczytuj wyniki meczów i losuj gotowe pytania do nowych wiktoryn.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Wyniki z ScoreBuster</CardTitle>
              <CardDescription>Wybierz ligę i załaduj ostatnie mecze.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedLeague}
                onValueChange={(val) => setSelectedLeague(val)}
                disabled={leagueOptionsLoading || !leagueOptions.length}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={leagueOptionsLoading ? 'Ładuję…' : 'Liga'} />
                </SelectTrigger>
                <SelectContent>
                  {leagueOptions.length ? (
                    leagueOptions.map((opt) => (
                      <SelectItem key={opt.apiId} value={opt.apiId}>
                        {opt.label}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Brak lig z mapowaniem ScoreBuster.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={() => fetchResultsForLeague(selectedLeague)}
                disabled={!selectedLeague || resultsLoading}
              >
                {resultsLoading ? 'Ładuję…' : 'Pobierz wyniki'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {resultsError && (
              <p className="text-sm text-red-300">{resultsError}</p>
            )}
            {!resultsLoading && !results.length && !resultsError && (
              <p className="text-sm text-muted-foreground">
                {selectedLeague
                  ? 'Brak danych. Wybierz ligę i kliknij „Pobierz wyniki”.'
                  : 'Dodaj ligę w panelu i przypisz jej ID ScoreBuster, aby pobrać wyniki.'}
              </p>
            )}
            {resultsLoading && (
              <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 animate-spin" /> Pobieram…
              </p>
            )}
            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-2">
              {results.map((match) => {
                const disabled = typeof match.homeTeam.score !== 'number' || typeof match.awayTeam.score !== 'number'
                return (
                  <div
                    key={`${match.leagueId}:${match.id}`}
                    className="rounded-2xl border border-border/50 bg-muted/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground">
                          {match.homeTeam.name} vs {match.awayTeam.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {match.homeTeam.score}:{match.awayTeam.score} •{' '}
                          {match.round ? `Kolejka ${match.round}` : '—'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={disabled || importing === `${match.id}-winner_1x2`}
                          onClick={() => importMatch(match, 'winner_1x2')}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Zwycięzca
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={disabled || importing === `${match.id}-total_goals`}
                          onClick={() => importMatch(match, 'total_goals')}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Suma goli
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Wpisy w banku</CardTitle>
              <CardDescription>Gotowe pytania historyczne, które można losować do quizu.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready">Gotowe</SelectItem>
                  <SelectItem value="used">Wykorzystane</SelectItem>
                  <SelectItem value="archived">Archiwum</SelectItem>
                  <SelectItem value="all">Wszystkie</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={loadBankEntries} disabled={loadingBank}>
                <RefreshCcw className={cn('h-4 w-4', loadingBank && 'animate-spin')} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {loadingBank && <p className="text-sm text-muted-foreground">Ładuję…</p>}
            {!loadingBank && !filteredEntries.length && (
              <p className="text-sm text-muted-foreground">Brak wpisów w wybranym statusie.</p>
            )}
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border/50 bg-card/40 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">
                      {entry.home_team} vs {entry.away_team}{' '}
                      <span className="text-muted-foreground">
                        ({entry.home_score}:{entry.away_score})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.played_at ? new Date(entry.played_at).toLocaleString('pl-PL') : '—'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="uppercase">{entry.status}</Badge>
                    <Badge variant="secondary">{templateLabel(entry.template)}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {buildHistoryQuestionFromEntry(entry)?.prompt || 'Brak generatora dla tego szablonu.'}
                </p>
                {entry.status === 'ready' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => archiveEntry(entry.id)}>
                      <Archive className="mr-1 h-4 w-4" />
                      Archiwizuj
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
