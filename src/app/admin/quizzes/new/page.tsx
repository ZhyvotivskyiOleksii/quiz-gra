"use client";
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import NotchedInput from '@/components/ui/notched-input'
import { Label } from '@/components/ui/label'

export default function NewQuizPage() {
  const router = useRouter()
  const [leagues, setLeagues] = React.useState<{id:string;name:string;code:string}[]>([])
  const [leagueId, setLeagueId] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [startsAt, setStartsAt] = React.useState('')
  const [deadlineAt, setDeadlineAt] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    (async () => {
      const s = getSupabase();
      const { data } = await s.from('leagues').select('id,name,code').order('name')
      setLeagues(data || [])
    })()
  }, [])

  async function create() {
    setSaving(true)
    try {
      const s = getSupabase()
      const tz = 'Europe/Warsaw'
      const { data: round, error: rerr } = await s
        .from('rounds')
        .insert({ league_id: leagueId, label, starts_at: startsAt, deadline_at: deadlineAt, timezone: tz, status: 'draft' })
        .select('id')
        .single()
      if (rerr) throw rerr
      const { data: quiz, error: qerr } = await s
        .from('quizzes')
        .insert({ round_id: round!.id, title })
        .select('id')
        .single()
      if (qerr) throw qerr
      router.push(`/admin/quizzes/${quiz!.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[800px] space-y-4">
      <Card>
        <CardHeader><CardTitle>Nowa wiktoryна</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Лига</Label>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={leagueId} onChange={(e)=>setLeagueId(e.target.value)}>
              <option value="">— выберите лигу —</option>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <NotchedInput label={'Название (заголовок квиза)'} value={title} onChange={(e:any)=>setTitle(e.target.value)} />
          <NotchedInput label={'Метка тура/этапа (например "14 тур")'} value={label} onChange={(e:any)=>setLabel(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NotchedInput type="datetime-local" label={'Старт публикации'} value={startsAt} onChange={(e:any)=>setStartsAt(e.target.value)} />
            <NotchedInput type="datetime-local" label={'Дедлайн ответов'} value={deadlineAt} onChange={(e:any)=>setDeadlineAt(e.target.value)} />
          </div>
          <Button onClick={create} disabled={saving || !leagueId || !label || !startsAt || !deadlineAt || !title}>Создать</Button>
        </CardContent>
      </Card>
    </div>
  )
}

