import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Phone, Trophy, Activity, Zap, Award, Target } from 'lucide-react'
import { AdminUsersTable, type AdminUserRecord } from '@/components/admin/admin-users-table'

type ProfileRow = {
  id: string
  display_name?: string | null
  email?: string | null
  phone?: string | null
  created_at?: string | null
  marketing_consent?: boolean | null
  is_admin?: boolean | null
  short_id?: string | null
}

type SubmissionRow = {
  user_id: string | null
  submitted_at: string | null
}

type ResultRow = {
  user_id: string | null
  prize_awarded?: number | null
  submitted_at?: string | null
  total_correct?: number | null
  total_questions?: number | null
  status?: string | null
}

export default async function AdminUsersPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      } as any,
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    throw new Error('Supabase service credentials missing')
  }
  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const [profilesRes, totalProfilesRes, phoneProfilesRes, weeklySubmissionsRes, recentPrizeRes] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('id,display_name,email,phone,created_at,marketing_consent,is_admin,short_id')
      .order('created_at', { ascending: false })
      .limit(50),
    serviceClient.from('profiles').select('id', { count: 'exact', head: true }),
    serviceClient.from('profiles').select('id', { count: 'exact', head: true }).not('phone', 'is', null),
    serviceClient.from('quiz_submissions').select('id', { count: 'exact', head: true }).gte('submitted_at', weekAgoIso),
    serviceClient.from('quiz_results').select('prize_awarded,submitted_at').gte('submitted_at', monthAgoIso),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (totalProfilesRes.error) throw totalProfilesRes.error
  if (phoneProfilesRes.error) throw phoneProfilesRes.error
  if (weeklySubmissionsRes.error) throw weeklySubmissionsRes.error
  if (recentPrizeRes.error) throw recentPrizeRes.error

  const profiles = (profilesRes.data || []) as ProfileRow[]
  const userIds = profiles.map((profile) => profile.id).filter((id): id is string => Boolean(id))

  const { phoneMap, phoneUsersTotal } = await fetchAuthPhoneSnapshot(userIds)

  let submissionRows: SubmissionRow[] = []
  let resultRows: ResultRow[] = []

  if (userIds.length > 0) {
    const [submissionsRes, resultsRes] = await Promise.all([
      serviceClient.from('quiz_submissions').select('user_id,submitted_at').in('user_id', userIds),
      serviceClient
        .from('quiz_results')
        .select('user_id,prize_awarded,submitted_at,total_correct,total_questions,status')
        .in('user_id', userIds),
    ])
    if (submissionsRes.error) throw submissionsRes.error
    if (resultsRes.error) throw resultsRes.error
    submissionRows = (submissionsRes.data || []) as SubmissionRow[]
    resultRows = (resultsRes.data || []) as ResultRow[]
  }

  const submissionMap = new Map<
    string,
    {
      total: number
      last: string | null
    }
  >()
  submissionRows.forEach((row) => {
    if (!row.user_id) return
    const bucket = submissionMap.get(row.user_id) || { total: 0, last: null as string | null }
    bucket.total += 1
    if (row.submitted_at && (!bucket.last || new Date(row.submitted_at) > new Date(bucket.last))) {
      bucket.last = row.submitted_at
    }
    submissionMap.set(row.user_id, bucket)
  })

  const resultMap = new Map<
    string,
    {
      wins: number
      totalPrize: number
      totalCorrect: number
      totalQuestions: number
    }
  >()
  resultRows.forEach((row) => {
    if (!row.user_id) return
    const bucket =
      resultMap.get(row.user_id) || { wins: 0, totalPrize: 0, totalCorrect: 0, totalQuestions: 0 }
    const prize = Number(row.prize_awarded || 0)
    if (prize > 0 || (row.status || '').toLowerCase() === 'won') {
      bucket.wins += 1
    }
    bucket.totalPrize += prize
    bucket.totalCorrect += row.total_correct ?? 0
    bucket.totalQuestions += row.total_questions ?? 0
    resultMap.set(row.user_id, bucket)
  })

  const userRows: AdminUserRecord[] = profiles.map((profile) => {
    const submissions = submissionMap.get(profile.id) || { total: 0, last: null }
    const results = resultMap.get(profile.id) || { wins: 0, totalPrize: 0, totalCorrect: 0, totalQuestions: 0 }
    const accuracy =
      results.totalQuestions > 0 ? results.totalCorrect / Math.max(results.totalQuestions, 1) : null
    const authPhone = phoneMap.get(profile.id)
    return {
      id: profile.id,
      displayName:
        profile.display_name?.trim() ||
        profile.email?.split('@')[0] ||
        profile.short_id ||
        `Gracz ${profile.id.slice(0, 6)}`,
      email: profile.email ?? null,
      phone: authPhone?.phone ?? profile.phone ?? null,
      phoneVerified: Boolean(authPhone?.verified && (authPhone?.phone ?? profile.phone)),
      createdAt: profile.created_at ?? new Date().toISOString(),
      marketingConsent: Boolean(profile.marketing_consent),
      isAdmin: Boolean(profile.is_admin),
      shortId: profile.short_id ?? null,
      stats: {
        totalQuizzes: submissions.total,
        wins: results.wins,
        totalPrize: Number(results.totalPrize.toFixed(2)),
        accuracy,
        lastActive: submissions.last,
      },
    }
  })

  const topActive = [...userRows].sort((a, b) => b.stats.totalQuizzes - a.stats.totalQuizzes).slice(0, 5)
  const topWinners = [...userRows].sort((a, b) => b.stats.totalPrize - a.stats.totalPrize).slice(0, 5)

  const totalUsers = totalProfilesRes.count ?? 0
  const phoneUsers = phoneUsersTotal ?? phoneProfilesRes.count ?? 0
  const weeklySubmissions = weeklySubmissionsRes.count ?? 0
  const recentPrizeRows = (recentPrizeRes.data || []) as { prize_awarded?: number | null }[]
  const prizePaidLast30 = recentPrizeRows.reduce((sum, row) => sum + Number(row.prize_awarded || 0), 0)

  const currencyFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  })

  const statCards = [
    {
      label: 'Łącznie profili',
      value: totalUsers.toLocaleString('pl-PL'),
      description: 'Aktywne konta w systemie',
      icon: Users,
    },
    {
      label: 'Telefony podpięte',
      value: phoneUsers.toLocaleString('pl-PL'),
      description: 'Użytkownicy z numerem',
      icon: Phone,
    },
    {
      label: 'Podejścia 7 dni',
      value: weeklySubmissions.toLocaleString('pl-PL'),
      description: 'Łącznie zgłoszeń w tygodniu',
      icon: Activity,
    },
    {
      label: 'Wypłacone (30 dni)',
      value: currencyFormatter.format(prizePaidLast30),
      description: 'Suma nagród ostatnich 30 dni',
      icon: Trophy,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-extrabold">Użytkownicy</h1>
        <p className="text-sm text-muted-foreground">Monitoring aktywności, kontaktów i wypłat nagród.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="border-white/10 bg-gradient-to-br from-white/5 to-transparent shadow-[0_20px_60px_rgba(3,2,12,0.45)]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">{stat.label}</CardTitle>
              <stat.icon className="h-5 w-5 text-white/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs text-white/60">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(280px,0.75fr)]">
        <Card className="border-white/10 bg-white/5/70 shadow-[0_35px_90px_rgba(3,2,12,0.6)]">
          <CardHeader>
            <CardTitle className="text-xl font-headline text-white">Lista użytkowników</CardTitle>
            <CardDescription>50 najnowszych profili z kluczowymi metrykami.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUsersTable users={userRows} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-black/30 shadow-[0_25px_70px_rgba(3,2,12,0.5)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="h-5 w-5 text-emerald-300" />
                Najaktywniejsi
              </CardTitle>
              <CardDescription>Najwięcej podejść wśród ostatnich 50 kont.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topActive.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak wystarczających danych.</p>
              ) : (
                topActive.map((user, idx) => (
                  <div key={user.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        #{idx + 1} {user.displayName}
                      </p>
                      <p className="text-xs text-white/60">
                        {user.stats.totalQuizzes} podejść • ostatnio{' '}
                        {user.stats.lastActive
                          ? new Intl.DateTimeFormat('pl-PL', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(user.stats.lastActive))
                          : 'brak danych'}
                      </p>
                    </div>
                    <Badge className="bg-white/10 text-white">UID {user.shortId ?? user.id.slice(0, 6)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/30 shadow-[0_25px_70px_rgba(3,2,12,0.5)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Award className="h-5 w-5 text-amber-300" />
                Top wygrane
              </CardTitle>
              <CardDescription>Największe sumy nagród (ostatnie 50 profili).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topWinners.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak wygranych do wyświetlenia.</p>
              ) : (
                topWinners.map((user) => (
                  <div key={user.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{user.displayName}</p>
                      <p className="text-xs text-white/60">{user.stats.wins} trafień premiowanych</p>
                    </div>
                    <div className="text-sm font-semibold text-emerald-300">
                      {currencyFormatter.format(user.stats.totalPrize)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/30 shadow-[0_25px_70px_rgba(3,2,12,0.5)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5 text-sky-300" />
                Segmenty
              </CardTitle>
              <CardDescription>Podsumowanie na bazie widocznych użytkowników.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/80">
              <div className="flex items-center justify-between">
                <span>Marketing opt-in</span>
                <span className="font-semibold">
                  {userRows.filter((u) => u.marketingConsent).length} / {userRows.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Z telefonem</span>
                <span className="font-semibold">
                  {userRows.filter((u) => Boolean(u.phone)).length} / {userRows.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Z co najmniej 5 podejściami</span>
                <span className="font-semibold">
                  {userRows.filter((u) => u.stats.totalQuizzes >= 5).length} / {userRows.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Celność powyżej 60%</span>
                <span className="font-semibold">
                  {
                    userRows.filter((u) => (u.stats.accuracy ?? 0) >= 0.6).length
                  }{' '}
                  / {userRows.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

async function fetchAuthPhoneSnapshot(userIds: string[]) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url || userIds.length === 0) {
    return { phoneMap: new Map<string, { phone: string | null; verified: boolean }>(), phoneUsersTotal: null as number | null }
  }
  const admin = createClient(url, serviceKey)
  const targetIds = new Set(userIds)
  const phoneMap = new Map<string, { phone: string | null; verified: boolean }>()
  let phoneUsersTotal = 0
  const perPage = 200
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('admin.listUsers error', error)
      break
    }
    if (!data) break
    for (const user of data.users || []) {
      const rawPhone =
        typeof user.phone === 'string' && user.phone.trim() !== ''
          ? user.phone
          : typeof user.user_metadata?.phone === 'string'
            ? user.user_metadata.phone
            : null
      const normalized = rawPhone ? normalizePhone(rawPhone) : null
      const verified = Boolean(normalized && (user.phone || (user.user_metadata as any)?.phone_verified))
      if (normalized) {
        phoneUsersTotal += 1
      }
      if (normalized && targetIds.has(user.id)) {
        phoneMap.set(user.id, { phone: normalized, verified })
        targetIds.delete(user.id)
      } else if (targetIds.has(user.id) && !normalized) {
        phoneMap.set(user.id, { phone: null, verified: false })
      }
    }
    if (!data.nextPage) break
    page = data.nextPage
  }

  targetIds.forEach((id) => {
    if (!phoneMap.has(id)) phoneMap.set(id, { phone: null, verified: false })
  })

  return { phoneMap, phoneUsersTotal }
}

function normalizePhone(phone: string) {
  if (!phone) return null
  const digits = phone.replace(/[\s-]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.length === 9) return `+48${digits}`
  return `+${digits}`
}
