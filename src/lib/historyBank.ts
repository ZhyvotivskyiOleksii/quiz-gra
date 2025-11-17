export type HistoryQuestionTemplate = 'winner_1x2' | 'total_goals'

export type HistoryBankEntry = {
  id: string
  match_identifier: string
  template: HistoryQuestionTemplate
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  played_at?: string | null
  status: string
  league_code?: string | null
  source_kind?: string | null
}

export type GeneratedHistoryQuestion = {
  kind: 'history_single' | 'history_numeric'
  prompt: string
  options: any
  correct: any
}

const REMIS_LABEL = 'Remis'

function formatMatchLabel(entry: HistoryBankEntry) {
  return `${entry.home_team} – ${entry.away_team}`
}

function winnerQuestion(entry: HistoryBankEntry): GeneratedHistoryQuestion {
  const totalHome = Number(entry.home_score ?? 0)
  const totalAway = Number(entry.away_score ?? 0)
  let correct = REMIS_LABEL
  if (totalHome > totalAway) correct = entry.home_team
  if (totalAway > totalHome) correct = entry.away_team

  return {
    kind: 'history_single',
    prompt: `Kto wygrał mecz ${formatMatchLabel(entry)}?`,
    options: [entry.home_team, REMIS_LABEL, entry.away_team],
    correct,
  }
}

function totalGoalsQuestion(entry: HistoryBankEntry): GeneratedHistoryQuestion {
  const total = Number(entry.home_score ?? 0) + Number(entry.away_score ?? 0)
  const max = Math.max(6, total + 2)
  return {
    kind: 'history_numeric',
    prompt: `Ile łącznie goli padło w meczu ${formatMatchLabel(entry)}?`,
    options: { min: 0, max, step: 1 },
    correct: total,
  }
}

export function buildHistoryQuestionFromEntry(
  entry: HistoryBankEntry,
): GeneratedHistoryQuestion | null {
  switch (entry.template) {
    case 'winner_1x2':
      return winnerQuestion(entry)
    case 'total_goals':
      return totalGoalsQuestion(entry)
    default:
      return null
  }
}
