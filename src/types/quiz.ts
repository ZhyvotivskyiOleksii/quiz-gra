export type League = {
  id: string
  code: string
  name: string
}

export type Stage = {
  id: string
  code: string
  name: string
}

export type Round = {
  id: string
  league_id: string
  label: string
  stage_id: string | null
  starts_at: string
  deadline_at: string
  ends_at: string | null
  timezone: string
  status: 'draft' | 'published' | 'locked' | 'settled'
}

export type Match = {
  id: string
  round_id: string
  home_team: string
  away_team: string
  kickoff_at: string
  enabled: boolean
  result_home: number | null
  result_away: number | null
  status: 'scheduled' | 'postponed' | 'cancelled' | 'finished'
}

export type Quiz = {
  id: string
  round_id: string
  title: string
  description: string | null
  points_history: number
  points_future_exact: number
  points_score_exact: number
  points_score_tendency: number
}

export type QuestionKind =
  | 'history_single'
  | 'history_multi'
  | 'history_bool'
  | 'history_numeric'
  | 'future_1x2'
  | 'future_score'
  | 'future_yellow_cards'
  | 'future_corners'

export type QuizQuestion = {
  id: string
  quiz_id: string
  match_id: string | null
  kind: QuestionKind
  prompt: string
  options: any
  correct: any
  order_index: number
}

export type QuizSubmission = {
  id: string
  quiz_id: string
  user_id: string
  submitted_at: string | null
}

export type QuizAnswer = {
  id: string
  submission_id: string
  question_id: string
  answer: any
}

export type QuizResult = {
  id: string
  quiz_id: string
  user_id: string
  points: number
  correct_future: number
  submitted_at: string | null
  rank: number | null
  data: any
}
