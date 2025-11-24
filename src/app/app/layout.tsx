import { ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { AppShellClient } from '@/components/app/app-shell-client'
import { InitialAuthState } from '@/types/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const emailFromUser = user
    ? user.email ??
      (user.user_metadata?.email as string | undefined) ??
      ((user.user_metadata as any)?.contact_email as string | undefined)
    : undefined

  const metadataAvatar = user ? ((user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined) : undefined
  const metadataName = user
    ? `${(user.user_metadata?.first_name as string | undefined) || ''} ${
        (user.user_metadata?.last_name as string | undefined) || ''
      }`.trim()
    : ''

  let profile:
    | {
        display_name?: string | null
        avatar_url?: string | null
        is_admin?: boolean | null
        phone?: string | null
        phone_confirmed_at?: string | null
      }
    | null = null
  let walletBalance: number | null = null
  let shortId: string | null = null

  if (user) {
    const [profileResult, balanceResult, shortIdResult] = await Promise.all([
      (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, is_admin, phone, phone_confirmed_at')
            .eq('id', user.id)
            .maybeSingle()
          return { data, error }
        } catch (err) {
          return { data: null, error: err }
        }
      })(),
      (async () => {
        try {
          const { data, error } = await supabase.rpc('get_user_balance')
          if (error) {
            return { data: 0 }
          }
          return { data }
        } catch {
          return { data: 0 }
        }
      })(),
      (async () => {
        try {
          return await supabase.rpc('get_or_create_short_id')
        } catch {
          return { data: null }
        }
      })(),
    ])

    profile = profileResult?.data ?? null

    const walletBalanceRaw = balanceResult?.data
    walletBalance =
      typeof walletBalanceRaw === 'number'
        ? walletBalanceRaw
        : walletBalanceRaw === null || walletBalanceRaw === undefined
          ? null
          : Number(walletBalanceRaw) || null

    shortId =
      typeof shortIdResult?.data === 'string'
        ? shortIdResult.data
        : shortIdResult?.data
          ? String(shortIdResult.data)
          : null
  }

  const phoneConfirmed =
    Boolean(profile?.phone_confirmed_at) ||
    Boolean(user && ((user as any).phone_confirmed_at || (user.user_metadata as any)?.phone_confirmed_at))

  const adminEmailAllowList =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? []
  const userEmailLower = (emailFromUser || '').toLowerCase()
  const isEnvAdmin = userEmailLower ? adminEmailAllowList.includes(userEmailLower) : false
  const appRole = (user?.app_metadata?.role as string | undefined)?.toLowerCase()
  const appRoles = Array.isArray((user?.app_metadata as any)?.roles)
    ? ((user?.app_metadata as any).roles as string[]).map((r) => r.toLowerCase())
    : []
  const userMetaRole = (user?.user_metadata?.role as string | undefined)?.toLowerCase()
  const isAdmin =
    Boolean(profile?.is_admin) ||
    Boolean(user?.app_metadata?.is_admin) ||
    Boolean(user?.user_metadata?.is_admin) ||
    isEnvAdmin ||
    appRole === 'admin' ||
    userMetaRole === 'admin' ||
    appRoles.includes('admin')

  const displayName =
    profile?.display_name ||
    metadataName ||
    (emailFromUser ? emailFromUser.split('@')[0] : undefined)

  const initialAuth: InitialAuthState = {
    email: emailFromUser || undefined,
    avatarUrl: profile?.avatar_url || metadataAvatar || undefined,
    displayName: displayName || undefined,
    shortId,
    isAdmin,
    needsPhone: user ? !phoneConfirmed : false,
    walletBalance,
    hasSession: Boolean(user),
  }

  return <AppShellClient initialAuth={initialAuth}>{children}</AppShellClient>
}
