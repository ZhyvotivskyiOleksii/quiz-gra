'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { RefreshCcw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'

type SettlementRow = {
  id: string
  status: string | null
  prize_awarded: number | null
  submitted_at: string | null
  user_id: string | null
  quizzes?: { title: string | null } | null
  profile?: { id: string; display_name: string | null } | null
}

type SettlementsClientProps = {
  initialRows: SettlementRow[]
}

export function SettlementsClient({ initialRows }: SettlementsClientProps) {
  const [rows, setRows] = React.useState<SettlementRow[]>(initialRows)
  const [settling, setSettling] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const loadSettlements = React.useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('quiz_results')
        .select('id,status,prize_awarded,submitted_at,user_id,quizzes(title)')
        .order('submitted_at', { ascending: false })
        .limit(40)

      if (error) {
        console.error('Failed to load settlements', error)
        return
      }

      const settlementRows = data || []
      const userIds = Array.from(
        new Set(
          settlementRows
            .map((row) => row.user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      )

      const profileMap = new Map<string, { id: string; display_name: string | null }>()
      if (userIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', userIds)
          if (profiles) {
            profiles.forEach((profile) => {
              if (profile?.id) profileMap.set(profile.id, profile as { id: string; display_name: string | null })
            })
          }
        } catch (err) {
          console.error('Failed to load profiles', err)
        }
      }

      const rowsWithProfiles = settlementRows.map((row) => ({
        ...row,
        profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
      }))

      setRows(rowsWithProfiles)
    } catch (err) {
      console.error('Failed to load settlements', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAutoSettle = React.useCallback(async () => {
    setSettling(true)
    try {
      const res = await fetch('/api/admin/auto-settle-session', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to settle quizzes')
      }

      const summary = {
        attempted: data.attempted || 0,
        settled: data.settled?.length || 0,
        skipped: data.skipped?.length || 0,
      }

      toast({
        title: 'Rozliczenie zakończone',
        description: `Przetworzono: ${summary.attempted}, rozliczono: ${summary.settled}, pominięto: ${summary.skipped}`,
      })

      // Wait a bit for database to update, then reload settlements
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadSettlements()
    } catch (err: any) {
      toast({
        title: 'Błąd rozliczenia',
        description: err?.message || 'Nie udało się rozliczyć kвизов',
        variant: 'destructive',
      })
    } finally {
      setSettling(false)
    }
  }, [toast, loadSettlements])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rozliczenia</CardTitle>
              <CardDescription>Ostatnie rozstrzygnięcia quizów i wypłaty nagród.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSettlements}
                disabled={loading || settling}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Odśwież
              </Button>
              <Button
                variant="secondary"
                onClick={handleAutoSettle}
                disabled={settling || loading}
                className="gap-2"
              >
                {settling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rozliczam…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Rozlicz wszystkie
                  </>
                )}
              </Button>
            </div>
          </div>
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

