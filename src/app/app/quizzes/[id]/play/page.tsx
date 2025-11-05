"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

type Q = { id: string; kind: string; prompt: string; options: any; order_index: number; match_id: string | null }

export default function QuizPlayPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [title, setTitle] = React.useState<string>('')
  const [deadline, setDeadline] = React.useState<string | null>(null)
  const [questions, setQuestions] = React.useState<Q[]>([])
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, any>>({})
  const total = questions.length
  const [matchMap, setMatchMap] = React.useState<Record<string, any>>({})

  React.useEffect(() => {
    (async () => {
      const s = getSupabase()
      // quiz meta
      const { data: qz } = await s.from('quizzes').select('title,round_id').eq('id', id).maybeSingle()
      if (qz?.title) setTitle(qz.title)
      if (qz?.round_id) {
        const { data: r } = await s.from('rounds').select('id,deadline_at').eq('id', qz.round_id).maybeSingle()
        setDeadline(r?.deadline_at ?? null)
        // preload matches of round for quick headers
        if (r?.id) {
          const { data: ms } = await s.from('matches').select('id,home_team,away_team,kickoff_at').eq('round_id', r.id)
          const map: any = {}
          ;(ms||[]).forEach((m:any)=>{ map[m.id] = m })
          setMatchMap(map)
        }
      }
      // questions
      const { data: qs } = await s
        .from('quiz_questions')
        .select('id,kind,prompt,options,order_index,match_id')
        .eq('quiz_id', id)
        .order('order_index', { ascending: true })
      setQuestions(qs || [])
      setLoading(false)
    })()
  }, [id])

  function choose(questionId: string, value: any) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function submit() {
    const s = getSupabase()
    try {
      const { data: { user } } = await s.auth.getUser()
      if (!user) throw new Error('Brak sesji')
      const { data: sub, error: subErr } = await s
        .from('quiz_submissions')
        .insert({ quiz_id: id, user_id: user.id, submitted_at: new Date().toISOString() } as any)
        .select('id')
        .single()
      if (subErr) throw subErr
      const payload = Object.entries(answers).map(([question_id, answer]) => ({ submission_id: sub!.id, question_id, answer }))
      if (payload.length) {
        await s.from('quiz_answers').insert(payload as any)
      }
      router.replace('/app/history')
    } catch (e) {
      console.error(e)
      alert('Nie udało się wysłać odpowiedzi. Spróbuj ponownie.')
    }
  }

  if (loading) return <div className="min-h-[60vh] grid place-items-center text-white">Ładowanie…</div>
  if (!total) return <div className="min-h-[60vh] grid place-items-center text-white">Brak pytań dla tej wiktoryny.</div>

  const q = questions[step]
  const value = answers[q.id]
  const match = q.match_id ? matchMap[q.match_id] : null
  const isAnswered = React.useMemo(() => {
    if (q.kind === 'future_score') return value && typeof value.home === 'number' && typeof value.away === 'number'
    if (q.kind === 'history_numeric') return typeof value === 'number'
    return typeof value !== 'undefined' && value !== null
  }, [q, value])

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden" style={{ background: 'linear-gradient(180deg,#5a0f0f 0%, #c51616 35%, #4b0c1a 100%)' }}>
      <div className="mx-auto max-w-[900px] px-15 py-10 text-white">
        <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-white/30 bg-white/10 text-center py-5 mb-6">
          <div className="font-headline tracking-wider text-lg uppercase">{title || 'Wiktoryna'}</div>
          {deadline && <div className="opacity-80 text-sm mt-1">Do: {new Date(deadline).toLocaleString('pl-PL')}</div>}
        </div>
        <div className="text-center opacity-90 mb-6">
          Pytanie {step + 1} z {total}
        </div>
        {/* Match header for future-based questions */}
        {(q.kind === 'future_1x2' || q.kind === 'future_score') && match && (
          <div className="mx-auto mb-3 max-w-[520px] rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-center text-sm">
            <div className="font-semibold">{match.home_team} vs {match.away_team}</div>
            {match.kickoff_at && (
              <div className="opacity-85 text-xs">{new Date(match.kickoff_at).toLocaleString('pl-PL')}</div>
            )}
          </div>
        )}
        <h2 className="text-center font-headline font-extrabold text-3xl sm:text-4xl mb-6 drop-shadow">{q.prompt}</h2>

        {/* Render by type */}
        {Array.isArray(q.options) || q.kind==='future_1x2' ? (
          <div className="mx-auto max-w-[700px] space-y-3">
            {(Array.isArray(q.options) ? q.options : ['1','X','2']).map((opt: any, idx: number) => (
              <button
                key={idx}
                onClick={() => choose(q.id, opt)}
                className={`w-full rounded-xl px-4 py-3 text-left transition backdrop-blur ${
                  value === opt ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {typeof opt === 'string' ? opt : JSON.stringify(opt)}
              </button>
            ))}
          </div>
        ) : q.kind === 'future_score' ? (
          <ScorePicker value={value as any} onChange={(v:any)=>choose(q.id, v)} options={q.options as any} />
        ) : q.kind === 'history_numeric' ? (
          <NumericPicker value={value as number} onChange={(v:number)=>choose(q.id, v)} options={q.options as any} />
        ) : (
          <div className="text-center opacity-80">Nieobsługiwany typ pytania</div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 max-w-[700px] mx-auto">
          <Button variant="secondary" className="rounded-full px-6" disabled={step===0} onClick={()=>setStep((s)=>Math.max(0,s-1))}>Poprzednie</Button>
          {step < total-1 ? (
            <Button className="rounded-full bg-yellow-400 text-black hover:bg-yellow-300 px-8" onClick={()=>setStep((s)=>Math.min(total-1,s+1))} disabled={!isAnswered}>Następne</Button>
          ) : (
            <Button className="rounded-full bg-yellow-400 text-black hover:bg-yellow-300 px-8" onClick={submit} disabled={!isAnswered}>Prześlij</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function NumericPicker({ value, onChange, options }: { value?: number; onChange: (v:number)=>void; options?: any }) {
  const min = options?.min ?? 0
  const max = options?.max ?? 6
  const step = options?.step ?? 1
  const v = typeof value === 'number' ? value : min
  return (
    <div className="mx-auto max-w-[700px]">
      <div className="mx-auto w-20 text-center rounded-xl bg-white/15 py-3 text-xl font-bold mb-3">{v}</div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e)=>onChange(parseInt(e.target.value))} className="w-full" />
      <div className="flex justify-between text-sm opacity-80"><span>{min}</span><span>{max}+</span></div>
    </div>
  )
}

function ScorePicker({ value, onChange, options }: { value?: {home:number;away:number}; onChange: (v:{home:number;away:number})=>void; options?: any }) {
  const v = value || { home: options?.min_home ?? 0, away: options?.min_away ?? 0 }
  const set = (k:'home'|'away', d:number) => onChange({ ...v, [k]: Math.max(0, (v as any)[k] + d) })
  return (
    <div className="mx-auto max-w-[700px] text-center">
      <div className="flex items-center justify-center gap-10 text-5xl font-extrabold">
        <span>{v.home}</span>
        <span>:</span>
        <span>{v.away}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <Button onClick={()=>set('home', -1)} className="h-10 w-10 rounded-xl" variant="secondary">-</Button>
          <Button onClick={()=>set('home', +1)} className="h-10 w-10 rounded-xl" variant="secondary">+</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={()=>set('away', -1)} className="h-10 w-10 rounded-xl" variant="secondary">-</Button>
          <Button onClick={()=>set('away', +1)} className="h-10 w-10 rounded-xl" variant="secondary">+</Button>
        </div>
      </div>
    </div>
  )
}
