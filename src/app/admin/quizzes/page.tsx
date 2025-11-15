"use client";
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabaseClient'
import { Plus, RefreshCcw, CalendarClock, Settings2, Timer, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function AdminQuizzesPage() {
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const s = getSupabase()
      const { data } = await s
        .from('rounds')
        .select('id,label,status,deadline_at,leagues(name,code),quizzes(*)')
        .order('deadline_at', { ascending: false })
        .limit(50)
      const withQuizzes = (data || []).filter((r: any) => Array.isArray(r.quizzes) && r.quizzes.length > 0)
      setItems(withQuizzes)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  async function deleteQuizCascade(quizId: string, roundId: string) {
    if (!quizId) return
    const ok = typeof window !== 'undefined' ? window.confirm('Usunąć tę wiktorynę? Tego nie można cofnąć.') : true
    if (!ok) return
    setDeleting(quizId)
    try {
      const s = getSupabase()
      // Answers (need submission ids)
      const { data: subs } = await s.from('quiz_submissions').select('id').eq('quiz_id', quizId)
      const subIds = (subs || []).map((x:any) => x.id)
      if (subIds.length > 0) await s.from('quiz_answers').delete().in('submission_id', subIds)
      // Results, Questions, Submissions
      await s.from('quiz_results').delete().eq('quiz_id', quizId)
      await s.from('quiz_questions').delete().eq('quiz_id', quizId)
      await s.from('quiz_submissions').delete().eq('quiz_id', quizId)
      await s.from('quizzes').delete().eq('id', quizId)
      // Remove round if empty
      const { data: others } = await s.from('quizzes').select('id').eq('round_id', roundId).limit(1)
      if (!others || others.length === 0) await s.from('rounds').delete().eq('id', roundId)
      await load()
    } finally { setDeleting(null) }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold uppercase">Wiktoryny</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="h-4 w-4 mr-2"/>Odśwież</Button>
          <Button asChild>
            <Link href="/admin/quizzes/new"><Plus className="h-4 w-4 mr-2"/>Nowa wiktoryna</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((r:any) => {
          const q = r.quizzes?.[0] || {}
          const img = q.image_url || '/images/preview.webp'
          const prize = q.prize
          return (
            <div key={r.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#3a0d0d] via-[#5a0f0f] to-[#7a1313] p-0 shadow-xl min-h-[200px]">
              <div className="flex h-full">
                <div className="relative w-[55%] min-h-[170px] md:min-h-[210px] overflow-hidden rounded-r-[40px]">
                  <img src={img} alt="Quiz" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] px-2 py-1 flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" /> Do końca: {new Date(r.deadline_at).toLocaleString('pl-PL')}
                  </div>
                  {/* Smooth blend of image into card background */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#7a1313] opacity-95" />
                </div>
                <div className="relative flex-1 p-5 sm:p-6 flex flex-col justify-center items-end text-right">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/75">Runda {r.label}</div>
                  <div className="mt-1 text-3xl md:text-4xl font-headline font-extrabold text-white drop-shadow">{r.leagues?.name || 'Wiktoryna'}</div>
                  <div className="mt-2 text-xl font-extrabold text-yellow-300 drop-shadow">{typeof prize === 'number' ? prize.toLocaleString('pl-PL') + ' zł' : ''}</div>
                  <div className="mt-3 self-end flex items-center gap-2">
                    {q?.id && (
                      <Button size="sm" variant="destructive" className="rounded-full" disabled={deleting===q.id} onClick={()=>deleteQuizCascade(q.id, r.id)}>
                        <Trash2 className="h-4 w-4 mr-2"/>{deleting===q.id?'Usuwanie…':'Usuń'}
                      </Button>
                    )}
                    <Button asChild size="sm" variant="secondary" className="rounded-full">
                      <Link href={q?.id ? `/admin/quizzes/${q.id}` : `/admin/quizzes/new` }>
                        <Settings2 className="h-4 w-4 mr-2"/>{q?.id ? 'Otwórz' : 'Utwórz'}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <Card><CardContent className="p-6">Brak pozycji. Utwórz pierwszą wiktorynę.</CardContent></Card>
        )}
      </div>
    </div>
  )
}
