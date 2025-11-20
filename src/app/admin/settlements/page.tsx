import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'

async function getSettlementRows() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  )

  const { data, error } = await supabase
    .from('quiz_results')
    .select('id,status,prize_awarded,submitted_at,user_id,quizzes(title)')
    .order('submitted_at', { ascending: false })
    .limit(40)

  if (error) throw error
  const rows = data || []
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const profileMap = new Map<string, { id: string; display_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', userIds)
    if (profilesError) throw profilesError
    ;(profiles || []).forEach((profile) => {
      if (profile?.id) profileMap.set(profile.id, profile as { id: string; display_name: string | null })
    })
  }
  return rows.map((row) => ({
    ...row,
    profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
  }))
}

export default async function SettlementsPage() {
  const rows = await getSettlementRows()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rozliczenia</CardTitle>
          <CardDescription>Ostatnie rozstrzygnięcia quizów i wypłaty nagród.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak jeszcze rozliczonych quizów.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const status = (row.status || 'pending').toLowerCase()
                const prize = typeof row.prize_awarded === 'number' ? `${row.prize_awarded.toFixed(2)} zł` : '—'
                const updated = row.submitted_at
                  ? formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true, locale: pl })
                  : '—'
                const badgeColor =
                  status === 'won'
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : status === 'lost'
                      ? 'bg-rose-500/20 text-rose-200'
                      : 'bg-amber-500/20 text-amber-200'
                return (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-card/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{row.quizzes?.title ?? 'Quiz'}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.profile?.display_name || 'Użytkownik anonimowy'} • {updated}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={badgeColor}>{status}</Badge>
                        <span className="text-sm text-white/80">Nagroda: {prize}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
