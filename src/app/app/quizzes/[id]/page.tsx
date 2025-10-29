"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabaseClient'

export default function PlayQuizPage() {
  const params = useParams<{id: string}>()
  const id = params?.id as string
  const [quiz, setQuiz] = React.useState<any | null>(null)
  const [round, setRound] = React.useState<any | null>(null)
  const [questions, setQuestions] = React.useState<any[]>([])
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    (async () => {
      const s = getSupabase()
      const { data: q } = await s.from('quizzes').select('*').eq('id', id).single()
      setQuiz(q)
      if (q) {
        const { data: r } = await s.from('rounds').select('*').eq('id', q.round_id).single()
        setRound(r)
        const { data: qs } = await s.from('quiz_questions').select('*').eq('quiz_id', id).order('order_index')
        setQuestions(qs || [])
        // compute open state
        const isOpen = r?.status === 'published' && new Date().getTime() < new Date(r.deadline_at).getTime()
        setOpen(isOpen)
      }
    })()
  }, [id])

  if (!quiz || !round) return <div className="container max-w-xl mx-auto p-6">Ładowanie…</div>

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{quiz.title} • {round.label}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Дедлайн: {new Date(round.deadline_at).toLocaleString('pl-PL')} — {open ? 'otwarte' : 'zamknięte'}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Исторические вопросы</CardTitle></CardHeader>
        <CardContent>
          {(questions.filter(q=>q.kind.startsWith('history_')).length === 0) && (
            <div className="text-sm text-muted-foreground">Brak pytań.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Матчи этой недели</CardTitle></CardHeader>
        <CardContent>
          {(questions.filter(q=>q.kind.startsWith('future_')).length === 0) && (
            <div className="text-sm text-muted-foreground">Brak pytań 1X2 dla meczów.</div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={!open}>Wyślij odpowiedzi</Button>
      </div>
    </div>
  )
}

