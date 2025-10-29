"use client";
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabaseClient'
import { Plus, RefreshCcw, CalendarClock, Settings2 } from 'lucide-react'
import Link from 'next/link'

export default function AdminQuizzesPage() {
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  async function load() {
    setLoading(true)
    try {
      const s = getSupabase()
      const { data } = await s
        .from('rounds')
        .select('id,label,status,deadline_at,leagues(name,code)')
        .order('deadline_at', { ascending: false })
        .limit(50)
      setItems(data || [])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold uppercase">Quiz Manager</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="h-4 w-4 mr-2"/>Odśwież</Button>
          <Button asChild>
            <Link href="/admin/quizzes/new"><Plus className="h-4 w-4 mr-2"/>Nowa wiktoryna</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{r.leagues?.name} — {r.label}</CardTitle>
              <span className="text-xs rounded-full px-2 py-1 bg-muted/60">{r.status}</span>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4"/> do {new Date(r.deadline_at).toLocaleString('pl-PL')}</div>
              <Button asChild variant="secondary" size="sm"><Link href={`/admin/quizzes/${r.id}`}><Settings2 className="h-4 w-4 mr-2"/>Otwórz</Link></Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card><CardContent className="p-6">Brak pozycji. Utwórz pierwszą wiktoryну.</CardContent></Card>
        )}
      </div>
    </div>
  )
}

