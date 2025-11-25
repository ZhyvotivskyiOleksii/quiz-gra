import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { AppShellClient, InitialAuthState } from '@/components/app/app-shell-client'

export default async function AppLayout({ children }: { children: ReactNode }) {
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/?auth=login')
  }

  const user = session.user

  const emailFromUser =
    user.email ??
    (user.user_metadata?.email as string | undefined) ??
    ((user.user_metadata as any)?.contact_email as string | undefined)

  const metadataAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
  const metadataName = `${(user.user_metadata?.first_name as string | undefined) || ''} ${
    (user.user_metadata?.last_name as string | undefined) || ''
  }`.trim()

  const [{ data: profile }, balanceRes, shortIdRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, avatar_url, is_admin, phone, phone_confirmed_at')
      .eq('id', user.id)
      .maybeSingle(),
    (async () => {
      try {
        return await supabase.rpc('get_user_balance')
      } catch {
        return { data: null }
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

  const walletBalanceRaw = balanceRes?.data
  const walletBalance =
    typeof walletBalanceRaw === 'number'
      ? walletBalanceRaw
      : walletBalanceRaw === null || walletBalanceRaw === undefined
        ? null
        : Number(walletBalanceRaw) || null

  const shortId =
    typeof shortIdRes?.data === 'string'
      ? shortIdRes.data
      : shortIdRes?.data
        ? String(shortIdRes.data)
        : null

  const hasPhone =
    Boolean(profile?.phone) ||
    Boolean((user as any).phone) ||
    Boolean((user.user_metadata as any)?.phone)
  const phoneConfirmed = Boolean(profile?.phone_confirmed_at) || Boolean((user as any).phone_confirmed_at)

  const adminEmailAllowList =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? []
  const userEmailLower = (emailFromUser || '').toLowerCase()
  const isEnvAdmin = userEmailLower ? adminEmailAllowList.includes(userEmailLower) : false
  const appRole = (user.app_metadata?.role as string | undefined)?.toLowerCase()
  const appRoles = Array.isArray((user.app_metadata as any)?.roles)
    ? ((user.app_metadata as any).roles as string[]).map((r) => r.toLowerCase())
    : []
  const userMetaRole = (user.user_metadata?.role as string | undefined)?.toLowerCase()
  const isAdmin =
    Boolean(profile?.is_admin) ||
    Boolean(user.app_metadata?.is_admin) ||
    Boolean(user.user_metadata?.is_admin) ||
    isEnvAdmin ||
    appRole === 'admin' ||
    userMetaRole === 'admin' ||
    appRoles.includes('admin')

  const initialAuth: InitialAuthState = {
    email: emailFromUser || undefined,
    avatarUrl: profile?.avatar_url || metadataAvatar || undefined,
    displayName: profile?.display_name || metadataName || emailFromUser?.split('@')[0] || 'User',
    shortId,
    isAdmin,
    needsPhone: !(hasPhone && phoneConfirmed),
    walletBalance,
    hasSession: true,
  }

  return <AppShellClient initialAuth={initialAuth}>{children}</AppShellClient>
}
