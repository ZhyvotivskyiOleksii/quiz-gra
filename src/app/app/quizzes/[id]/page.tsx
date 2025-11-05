"use client";
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function AppQuizDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [row, setRow] = React.useState<any | null>(null)
  const [selected, setSelected] = React.useState<number | null>(null)

  React.useEffect(() => {
    (async () => {
      const s = getSupabase()
      // Load quiz and its round
      const { data: q } = await s.from('quizzes').select('id,title,round_id,image_url,prize').eq('id', id).maybeSingle()
      if (!q) return
      const { data: r } = await s.from('rounds').select('id,label,deadline_at,leagues(name,code)').eq('id', (q as any).round_id).maybeSingle()
      setRow({ quiz: q, round: r })
    })()
  }, [id])

  if (!row) return <div className="mx-auto w-full max-w-[900px] p-6">Ładowanie…</div>

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4">
      <Card className="shadow-xl overflow-hidden">
        <div className="flex">
          <div className="relative w-[40%] min-h-[200px]">
            <Image src={row.quiz.image_url || '/images/preview.webp'} alt="Quiz" fill className="object-cover" />
          </div>
          <div className="flex-1">
            <CardHeader>
              <CardTitle>{row.quiz.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {row.round?.leagues?.name || '—'} — {row.round?.label}
                <div>Do: {row.round?.deadline_at ? new Date(row.round.deadline_at).toLocaleString('pl-PL') : '—'}</div>
                {typeof row.quiz.prize === 'number' && (
                  <div className="mt-2 text-lg font-semibold">Nagroda: {row.quiz.prize.toLocaleString('pl-PL')} zł</div>
                )}
              </div>
              <Button onClick={() => { /* placeholder start */ }}>Rozpocznij</Button>
            </CardContent>
          </div>
        </div>
      </Card>

      {/* Prosty widok pytania z efektem „blend” po kliknięciu opcji */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Pytanie demonstracyjne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[0,1,2,3].map((i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="relative w-full overflow-hidden rounded-xl bg-muted/20 px-4 py-3 text-left transition hover:bg-muted/30 focus:outline-none"
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">{String.fromCharCode(65+i)}</span>
              Odpowiedź {i+1}
              {selected === i && (
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.25),rgba(255,255,255,0)_70%)] mix-blend-soft-light animate-pulse" />
              )}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
