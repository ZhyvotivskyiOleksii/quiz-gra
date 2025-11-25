import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params
  if (!submissionId) {
    return NextResponse.json({ error: 'Missing submission id' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: submission, error: subErr } = await supabase
    .from('quiz_submissions')
    .select('id,user_id,quiz_id')
    .eq('id', submissionId)
    .maybeSingle()

  if (subErr || !submission || submission.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: answers = [] } = await supabase
    .from('quiz_answers')
    .select('question_id,answer')
    .eq('submission_id', submissionId)

  if (!answers.length) {
    return NextResponse.json({ questions: [] })
  }

  const questionIds = answers.map((a) => a.question_id)
  const { data: questions = [] } = await supabase
    .from('quiz_questions')
    .select('id,prompt,kind,correct,order_index,match_id')
    .in('id', questionIds)

  const matchIds = questions.map((q) => q.match_id).filter(Boolean) as string[]
  let matchMap = new Map<string, { home_team: string | null; away_team: string | null }>()
  if (matchIds.length) {
    const { data: matches = [] } = await supabase
      .from('matches')
      .select('id,home_team,away_team')
      .in('id', matchIds)
    matches.forEach((m) => matchMap.set(m.id, m))
  }

  const answersMap = new Map(answers.map((a) => [a.question_id, a.answer]))

  const detail = questions
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((question) => {
      const userAnswer = answersMap.get(question.id)
      const status = deriveStatus(userAnswer, question.correct)
      const match = question.match_id ? matchMap.get(question.match_id) : null
      return {
        id: question.id,
        prompt: question.prompt,
        userAnswer: formatAnswer(userAnswer, question.kind),
        correctAnswer: question.correct != null ? formatAnswer(question.correct, question.kind) : null,
        status,
        matchLabel: match?.home_team && match?.away_team ? `${match.home_team} vs ${match.away_team}` : null,
      }
    })

  return NextResponse.json({ questions: detail })
}

function deriveStatus(answer: any, correct: any): 'correct' | 'wrong' | 'pending' {
  if (correct === null || typeof correct === 'undefined') return 'pending'
  return deepEqual(answer, correct) ? 'correct' : 'wrong'
}

function formatAnswer(value: any, kind: string): string {
  if (value === null || typeof value === 'undefined') return '—'
  if (kind === 'future_score' || (typeof value === 'object' && value !== null && 'home' in value && 'away' in value)) {
    const home = (value as any).home ?? (value as any)[0] ?? 0
    const away = (value as any).away ?? (value as any)[1] ?? 0
    return `${home} : ${away}`
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object' || a === null || b === null) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => deepEqual(a[key], b[key]))
}
