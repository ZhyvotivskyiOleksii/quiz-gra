"use client";
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabaseClient'

export default function WeeklyQuizzes() {
  const [rows, setRows] = React.useState<any[]>([])
  React.useEffect(() => {
    (async () => {
      const s = getSupabase()
      const { data } = await s
        .from('rounds')
        .select('id,label,deadline_at,leagues(name,code),quizzes(id,title)')
        .eq('status','published')
        .order('deadline_at',{ascending:true})
      setRows(data || [])
    })()
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4">
      <h1 className="text-2xl font-headline font-extrabold">Aktywne wiktoryny</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map(r => (
          <Card key={r.id} className="shadow-xl">
            <CardHeader>
              <CardTitle>{r.leagues?.name} — {r.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Do: {new Date(r.deadline_at).toLocaleString('pl-PL')}</div>
              {r.quizzes?.[0] && (
                <Button asChild>
                  <Link href={`/app/quizzes/${r.quizzes[0].id}`}>Otwórz</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card><CardContent className="p-6">Brak aktywnych wiktoryн.</CardContent></Card>
        )}
      </div>
    </div>
  )
}

