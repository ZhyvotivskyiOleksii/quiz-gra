import { ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { AdminShellClient } from '@/components/admin/admin-shell-client'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: { display_name?: string | null; avatar_url?: string | null; is_admin?: boolean | null; short_id?: string | null } | null =
    null

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, is_admin, short_id')
      .eq('id', user.id)
      .maybeSingle()
    profile = data ?? null
  }

  const adminEmailAllowList =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? []
  const userEmailLower = (user?.email || (user?.user_metadata?.email as string | undefined) || '').toLowerCase()
  const isEnvAdmin = userEmailLower ? adminEmailAllowList.includes(userEmailLower) : false

  if (user && isEnvAdmin && !profile?.is_admin) {
    try {
      await supabase.from('profiles').upsert({ id: user.id, is_admin: true } as any, { onConflict: 'id' } as any)
    } catch {}
  }

  let shortId: string | null = null
  if (user) {
    try {
      const shortIdRes = await supabase.rpc('get_or_create_short_id')
      if (shortIdRes?.data) {
        shortId = typeof shortIdRes.data === 'string' ? shortIdRes.data : String(shortIdRes.data)
      } else if (profile?.short_id) {
        shortId = String(profile.short_id)
      }
    } catch {
      if (profile?.short_id) {
        shortId = String(profile.short_id)
      }
    }
  } else if (profile?.short_id) {
    shortId = String(profile.short_id)
  }

  const metadataName = user
    ? `${(user.user_metadata?.first_name as string | undefined) || ''} ${
        (user.user_metadata?.last_name as string | undefined) || ''
      }`.trim()
    : ''

  const initialAuth = {
    email:
      (user?.email ??
        (user?.user_metadata?.email as string | undefined) ??
        ((user?.user_metadata as any)?.contact_email as string | undefined)) ||
      undefined,
    avatarUrl: profile?.avatar_url || (user?.user_metadata?.avatar_url as string | undefined) || undefined,
    displayName: profile?.display_name || metadataName || undefined,
    shortId,
  }

  return <AdminShellClient initialAuth={initialAuth}>{children}</AdminShellClient>
}
