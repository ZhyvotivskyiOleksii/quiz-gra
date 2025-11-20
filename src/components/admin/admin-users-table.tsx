"use client"

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Phone, ShieldCheck, Trophy, Activity } from 'lucide-react'

export type AdminUserRecord = {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  phoneVerified: boolean
  createdAt: string
  marketingConsent: boolean
  isAdmin: boolean
  shortId: string | null
  stats: {
    totalQuizzes: number
    wins: number
    totalPrize: number
    accuracy: number | null
    lastActive: string | null
  }
}

type AdminUsersTableProps = {
  users: AdminUserRecord[]
}

type FilterKey = 'all' | 'active' | 'winners'

const filters: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'Wszyscy' },
  { id: 'active', label: 'Aktywni (7 dni)' },
  { id: 'winners', label: 'Zwycięzcy' },
]

export function AdminUsersTable({ users }: AdminUsersTableProps) {
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<FilterKey>('all')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return users.filter((user) => {
      const matchesQuery =
        !q ||
        user.displayName.toLowerCase().includes(q) ||
        (user.email?.toLowerCase().includes(q) ?? false) ||
        (user.shortId?.toLowerCase().includes(q) ?? false)

      if (!matchesQuery) return false

      switch (filter) {
        case 'active': {
          if (!user.stats.lastActive) return false
          const last = new Date(user.stats.lastActive).getTime()
          return now - last <= sevenDays
        }
        case 'winners':
          return user.stats.wins > 0 || user.stats.totalPrize > 0
        default:
          return true
      }
    })
  }, [filter, query, users])

  const formatLastActive = React.useCallback((iso: string | null) => {
    if (!iso) return 'brak aktywności'
    const diffMs = Date.now() - new Date(iso).getTime()
    if (diffMs < 60 * 1000) return 'kilka sekund temu'
    const diffMinutes = Math.round(diffMs / (60 * 1000))
    if (diffMinutes < 60) return `${diffMinutes} min temu`
    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} h temu`
    const diffDays = Math.round(diffHours / 24)
    if (diffDays < 30) return `${diffDays} dni temu`
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  }, [])

  const numberFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        maximumFractionDigits: 0,
      }),
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Szukaj po imieniu, e-mailu lub short ID…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 rounded-2xl border-white/10 bg-black/20 focus-visible:ring-red-500 md:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={filter === item.id ? 'default' : 'outline'}
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-full border-white/10 text-xs uppercase tracking-wide',
                filter === item.id
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                  : 'bg-black/20 text-white/70 hover:text-white',
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-[32px] border border-white/10 bg-black/25 p-1 shadow-[0_25px_80px_rgba(3,2,12,0.45)] backdrop-blur">
        <Table className="[&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider">
          <TableHeader>
            <TableRow className="border-white/5">
              <TableHead>Użytkownik</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead className="text-center">Podejścia</TableHead>
              <TableHead className="text-center">Wygrane</TableHead>
              <TableHead className="text-center">Celność</TableHead>
              <TableHead className="text-right">Wypłacone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Brak użytkowników spełniających kryteria.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => {
                const accuracy = user.stats.accuracy !== null ? `${Math.round(user.stats.accuracy * 100)}%` : '—'
                const lastActive = formatLastActive(user.stats.lastActive)
                return (
                  <TableRow key={user.id} className="border-white/5">
                    <TableCell className="min-w-[220px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {user.displayName}
                          {user.isAdmin && (
                            <Badge className="flex items-center gap-1 bg-amber-500/20 text-amber-100">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          UID: {user.shortId ?? user.id.slice(0, 8)} • Konto od{' '}
                          {new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' }).format(new Date(user.createdAt))}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Activity className="h-3.5 w-3.5 text-white/60" />
                          {lastActive}
                        </span>
                        <span className="flex items-center gap-1 text-white/80">
                          <Phone className="h-3.5 w-3.5 text-white/60" />
                          {user.phone ? formatPhone(user.phone) : 'brak telefonu'}
                          {user.phone && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] uppercase tracking-wide',
                                user.phoneVerified
                                  ? 'border-emerald-400/50 text-emerald-200'
                                  : 'border-white/20 text-white/60',
                              )}
                            >
                              {user.phoneVerified ? 'zweryfikowany' : 'niezweryfikowany'}
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-white/60">{user.email ?? 'brak e-maila'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-white">{user.stats.totalQuizzes}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold text-emerald-300">{user.stats.wins}</span>
                        {user.stats.wins > 0 && <Badge className="bg-emerald-500/15 text-emerald-200">wygrane</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold text-white">{accuracy}</TableCell>
                    <TableCell className="text-right font-semibold text-white">
                      {user.stats.totalPrize > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-emerald-300">
                          <Trophy className="h-4 w-4" />
                          {numberFormatter.format(user.stats.totalPrize)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatPhone(phone: string) {
  if (!phone) return ''
  const normalized = phone.replace(/\s+/g, '')
  if (normalized.startsWith('+')) {
    return normalized
  }
  if (normalized.length === 9) {
    return normalized.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
  }
  return normalized
}
