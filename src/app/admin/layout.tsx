import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { AdminShellClient } from '@/components/admin/admin-shell-client'

export default async function AdminLayout({ children }: { children: ReactNode }) {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect('/app')
  }

  const metadataName = `${(user.user_metadata?.first_name as string | undefined) || ''} ${
    (user.user_metadata?.last_name as string | undefined) || ''
  }`.trim()

  const initialAuth = {
    email:
      user.email ??
      (user.user_metadata?.email as string | undefined) ??
      ((user.user_metadata as any)?.contact_email as string | undefined),
    avatarUrl: profile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined) || undefined,
    displayName: profile?.display_name || metadataName || undefined,
    shortId: null,
  }

  return <AdminShellClient initialAuth={initialAuth}>{children}</AdminShellClient>
}
