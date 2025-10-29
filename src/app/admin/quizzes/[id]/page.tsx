"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import NotchedInput from '@/components/ui/notched-input'
import { Label } from '@/components/ui/label'
import { getSupabase } from '@/lib/supabaseClient'

export default function EditQuizPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [quiz, setQuiz] = React.useState<any | null>(null)
  const [round, setRound] = React.useState<any | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [qCount, setQCount] = React.useState(0)
  const [mCount, setMCount] = React.useState(0)

  React.useEffect(() => {
    (async () => {
      const s = getSupabase()
      const { data: q } = await s.from('quizzes').select('*').eq('id', id).single()
      setQuiz(q)
      if (q) {
        const { data: r } = await s.from('rounds').select('*, leagues(name,code)').eq('id', q.round_id).single()
        setRound(r)
        const { count: qc } = await s.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', id)
        setQCount(qc || 0)
        const { count: mc } = await s.from('matches').select('*', { count: 'exact', head: true }).eq('round_id', r.id).eq('enabled', true)
        setMCount(mc || 0)
      }
    })()
  }, [id])

  async function saveBasics() {
    setSaving(true)
    try {
      const s = getSupabase()
      await s.from('quizzes').update({
        title: quiz.title,
        description: quiz.description,
        points_history: quiz.points_history,
        points_future_exact: quiz.points_future_exact,
        points_score_exact: quiz.points_score_exact,
        points_score_tendency: quiz.points_score_tendency,
      }).eq('id', id)
      await s.from('rounds').update({ label: round.label, starts_at: round.starts_at, deadline_at: round.deadline_at }).eq('id', round.id)
    } finally { setSaving(false) }
  }

  async function publish(status: 'published'|'locked'|'settled') {
    const s = getSupabase();
    await s.from('rounds').update({ status }).eq('id', round.id)
    router.refresh()
  }

  async function recalc() {
    const s = getSupabase();
    await s.rpc('settle_quiz', { p_quiz: id })
  }

  async function genHistory3() {
    const s = getSupabase();
    const existing = await s.from('quiz_questions').select('id').eq('quiz_id', id).ilike('kind','history_%')
    if ((existing.data?.length||0) >= 3) return
    const base = [
      { prompt: 'Kto był królem strzelców poprzedniego sezonu?', options: [{id:'A',text:'Opcja A'},{id:'B',text:'Opcja B'},{id:'C',text:'Opcja C'}], correct: { id: 'A' } },
      { prompt: 'Ile drużyn spadło w poprzednim sezonie?', options: [{id:'2',text:'2'},{id:'3',text:'3'},{id:'4',text:'4'}], correct: { id: '3' } },
      { prompt: 'Mistrzem był…', options: [{id:'X',text:'Zespół X'},{id:'Y',text:'Zespół Y'}], correct: { id: 'Y' } },
    ]
    await s.from('quiz_questions').insert(base.map((b,idx)=>({ quiz_id: id, kind: 'history_single', prompt: b.prompt, options: b.options, correct: b.correct, order_index: idx })))
    const { count: qc } = await s.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', id)
    setQCount(qc || 0)
  }

  async function genMatch1x2() {
    const s = getSupabase();
    const { data: ms } = await s.from('matches').select('id,home_team,away_team').eq('round_id', round.id).eq('enabled', true).order('kickoff_at')
    if (!ms) return
    const toInsert = ms.map((m:any, i:number)=>({
      quiz_id: id,
      match_id: m.id,
      kind: 'future_1x2',
      prompt: `${m.home_team} vs ${m.away_team}: 1X2?`,
      options: [{id:'1',text:'1'},{id:'X',text:'X'},{id:'2',text:'2'}],
      order_index: 100 + i
    }))
    await s.from('quiz_questions').insert(toInsert)
    const { count: qc } = await s.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', id)
    setQCount(qc || 0)
  }

  if (!quiz || !round) return <div className="container max-w-xl mx-auto p-6">Ładowanie…</div>

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4">
      <Card>
        <CardHeader><CardTitle>Edycja — {round.leagues?.name} • {round.label}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <NotchedInput label={'Tytuł'} value={quiz.title || ''} onChange={(e:any)=>setQuiz({...quiz, title: e.target.value})} />
          <NotchedInput label={'Opis'} value={quiz.description || ''} onChange={(e:any)=>setQuiz({...quiz, description: e.target.value})} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NotchedInput label={'+1 History'} type="number" value={quiz.points_history} onChange={(e:any)=>setQuiz({...quiz, points_history: Number(e.target.value)})} />
            <NotchedInput label={'+1 Future 1x2'} type="number" value={quiz.points_future_exact} onChange={(e:any)=>setQuiz({...quiz, points_future_exact: Number(e.target.value)})} />
            <NotchedInput label={'+3 Score exact'} type="number" value={quiz.points_score_exact} onChange={(e:any)=>setQuiz({...quiz, points_score_exact: Number(e.target.value)})} />
            <NotchedInput label={'+1 Score tendency'} type="number" value={quiz.points_score_tendency} onChange={(e:any)=>setQuiz({...quiz, points_score_tendency: Number(e.target.value)})} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NotchedInput label={'Label'} value={round.label} onChange={(e:any)=>setRound({...round, label: e.target.value})} />
            <NotchedInput label={'Start'} type="datetime-local" value={(round.starts_at||'').slice(0,16)} onChange={(e:any)=>setRound({...round, starts_at: e.target.value})} />
            <NotchedInput label={'Deadline'} type="datetime-local" value={(round.deadline_at||'').slice(0,16)} onChange={(e:any)=>setRound({...round, deadline_at: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveBasics} disabled={saving}>Zapisz</Button>
            <Button variant="secondary" onClick={()=>publish('published')}>Opublikuj</Button>
            <Button variant="outline" onClick={()=>publish('locked')}>Zamknij</Button>
            <Button variant="destructive" onClick={()=>publish('settled')}>Oznacz rozliczoną</Button>
            <Button variant="ghost" onClick={recalc}>Przelicz wyniki</Button>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Исторические вопросы</div>
              <div className="text-2xl font-bold">{qCount}</div>
              <Button className="mt-2" variant="secondary" onClick={genHistory3}>Авто‑создать 3</Button>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Матчей в туре</div>
              <div className="text-2xl font-bold">{mCount}</div>
              <Button className="mt-2" variant="secondary" onClick={genMatch1x2}>Сгенерировать 1X2 по матчам</Button>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
