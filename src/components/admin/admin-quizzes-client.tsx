"use client";

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Plus, RefreshCcw, Settings2, Timer, Trash2 } from 'lucide-react'

export function AdminQuizzesClient({ initialItems }: { initialItems: any[] }) {
  const [items, setItems] = React.useState<any[]>(initialItems)
  const [loading, setLoading] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = getSupabase()
      const { data, error: queryError } = await s
        .from('rounds')
        .select('id,label,status,deadline_at,leagues(name,code),quizzes(*)')
        .order('deadline_at', { ascending: false })
        .limit(50)
      if (queryError) throw queryError
      setItems((data || []).filter((r: any) => Array.isArray(r.quizzes) && r.quizzes.length > 0))
    } catch (err: any) {
      console.error('Failed to load quizzes', err)
      setError(err?.message ?? 'Nie udało się pobrać wiktoryn.')
    } finally {
      setLoading(false)
    }
  }, [])

  async function deleteQuizCascade(quizId: string, roundId: string) {
    if (!quizId) return
    const ok = typeof window !== 'undefined' ? window.confirm('Usunąć tę wiktorynę? Tego nie można cofnąć.') : true
    if (!ok) return
    setDeleting(quizId)
    try {
      const s = getSupabase()
      const { data: subs } = await s.from('quiz_submissions').select('id').eq('quiz_id', quizId)
      const subIds = (subs || []).map((x: any) => x.id)
      if (subIds.length > 0) await s.from('quiz_answers').delete().in('submission_id', subIds)
      await s.from('quiz_results').delete().eq('quiz_id', quizId)
      await s.from('quiz_questions').delete().eq('quiz_id', quizId)
      await s.from('quiz_submissions').delete().eq('quiz_id', quizId)
      await s.from('quizzes').delete().eq('id', quizId)
      const { data: others } = await s.from('quizzes').select('id').eq('round_id', roundId).limit(1)
      if (!others || others.length === 0) await s.from('rounds').delete().eq('id', roundId)
      await load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold uppercase">Wiktoryny</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {loading ? 'Ładuję…' : 'Odśwież'}
          </Button>
          <Button asChild>
            <Link href="/admin/quizzes/new">
              <Plus className="mr-2 h-4 w-4" />Nowa wiktoryna
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {items.map((r: any) => {
          const q = r.quizzes?.[0] || {}
          const img = q.image_url || '/images/preview.webp'
          const prize = q.prize
          return (
            <div
              key={r.id}
              className="group relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#3a0d0d] via-[#5a0f0f] to-[#7a1313] p-0 shadow-xl"
            >
              <div className="flex h-full">
                <div className="relative w-[55%] min-h-[170px] overflow-hidden rounded-r-[40px] md:min-h-[210px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="Quiz" className="absolute inset-0 h-full w-full object-cover" />
                  {r.deadline_at && (
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                      <Timer className="h-3.5 w-3.5" /> Do końca: {new Date(r.deadline_at).toLocaleString('pl-PL')}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#7a1313] opacity-95" />
                </div>
                <div className="relative flex flex-1 flex-col items-end justify-center p-5 text-right sm:p-6">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/75">Runda {r.label}</div>
                  <div className="mt-1 text-3xl font-headline font-extrabold text-white drop-shadow md:text-4xl">
                    {r.leagues?.name || 'Wiktoryna'}
                  </div>
                  <div className="mt-2 text-xl font-extrabold text-yellow-300 drop-shadow">
                    {typeof prize === 'number' ? `${prize.toLocaleString('pl-PL')} zł` : ''}
                  </div>
                  <div className="mt-3 flex items-center gap-2 self-end">
                    {q?.id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full"
                        disabled={deleting === q.id}
                        onClick={() => deleteQuizCascade(q.id, r.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleting === q.id ? 'Usuwanie…' : 'Usuń'}
                      </Button>
                    )}
                    <Button asChild size="sm" variant="secondary" className="rounded-full">
                      <Link href={q?.id ? `/admin/quizzes/${q.id}` : `/admin/quizzes/new`}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        {q?.id ? 'Otwórz' : 'Utwórz'}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {items.length === 0 && !loading && (
          <Card>
            <CardContent className="p-6">Brak pozycji. Utwórz pierwszą wiktorynę.</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
