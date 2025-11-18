"use client"

import * as React from 'react'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar'
import { Play, History, LogOut, Settings as SettingsIcon, LayoutDashboard, Shield, Trophy } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { getSupabase } from '@/lib/supabaseClient'
import { Header } from '@/components/shared/header'
import { cn } from '@/lib/utils'

export type InitialAuthState = {
  email?: string
  avatarUrl?: string
  displayName?: string
  shortId?: string | null
  isAdmin?: boolean
  needsPhone?: boolean
  walletBalance?: number | null
  hasSession?: boolean
}

type AppShellClientProps = {
  children: React.ReactNode
  initialAuth: InitialAuthState
}

export function AppShellClient({ children, initialAuth }: AppShellClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()

  const [userEmail, setUserEmail] = React.useState<string | undefined>(initialAuth.email)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(initialAuth.avatarUrl || undefined)
  const [displayName, setDisplayName] = React.useState<string | undefined>(initialAuth.displayName || undefined)
  const [needsPhone, setNeedsPhone] = React.useState<boolean>(initialAuth.needsPhone ?? false)
  const [isAdmin, setIsAdmin] = React.useState<boolean>(initialAuth.isAdmin ?? false)

  React.useEffect(() => {
    const supabase = getSupabase()

    async function hydrate(user: any | null) {
      if (!user) {
        setUserEmail(undefined)
        setAvatarUrl(undefined)
        setDisplayName(undefined)
        setIsAdmin(false)
        setNeedsPhone(false)
        return
      }
      const emailFromUser =
        user.email ??
        (user.user_metadata?.email as string | undefined) ??
        ((user.user_metadata as any)?.contact_email as string | undefined)
      setUserEmail(emailFromUser)

      const viaProvider = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      setAvatarUrl((prev) => prev ?? viaProvider)

      const fn = (user.user_metadata?.first_name as string | undefined) || ''
      const ln = (user.user_metadata?.last_name as string | undefined) || ''
      const fallbackName = `${fn} ${ln}`.trim() || (emailFromUser?.split('@')[0] ?? 'User')
      setDisplayName((prev) => prev ?? fallbackName)

      try {
        const hasPhone = !!(user as any).phone || !!(user.user_metadata as any)?.phone
        const phoneConfirmed =
          Boolean((user as any).phone_confirmed_at) || Boolean((user.user_metadata as any)?.phone_confirmed_at)
        setNeedsPhone(!hasPhone || !phoneConfirmed)
      } catch {
        setNeedsPhone(false)
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, is_admin, phone, phone_confirmed_at')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url as any)
        if (profile?.display_name) setDisplayName((profile.display_name as any) || fallbackName)
        if (typeof profile?.is_admin === 'boolean') setIsAdmin(Boolean(profile.is_admin))
        const hasPhone =
          Boolean(profile?.phone) || Boolean((user as any).phone) || Boolean((user.user_metadata as any)?.phone)
        const phoneConfirmed = Boolean(profile?.phone_confirmed_at) || Boolean((user as any).phone_confirmed_at)
        setNeedsPhone(!hasPhone || !phoneConfirmed)
      } catch {}
    }

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await hydrate(user)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      hydrate(session?.user ?? null)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const menuItems = [
    { href: '/app', label: 'Panel', icon: LayoutDashboard },
    { href: '/app/play', label: 'SuperGame', icon: Play },
    { href: '/app/history', label: 'Historia', icon: History },
    { href: '/app/results', label: 'Wyniki', icon: Trophy },
  ]

  const handleNavigate = (href: string) => router.push(href)

  const handleLogout = async () => {
    const s = getSupabase()
    try {
      await s.auth.signOut()
    } catch {}
    try {
      await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ event: 'SIGNED_OUT' }),
      })
    } catch {}
    router.push('/')
  }

  const getActiveState = (itemHref: string) => {
    if (!pathname) return false
    if (itemHref === '/app') return pathname === '/app'
    return pathname.startsWith(itemHref)
  }

  const isPlayScreen = pathname?.startsWith('/app/quizzes/') && pathname?.includes('/play')
  const defaultPaddingX = 'px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16'

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-[#050611]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#050611]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(187,155,255,0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_5%,rgba(255,106,39,0.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(10,12,28,0.85),rgba(5,6,17,1))]" />
      </div>
      <div className="relative z-10 flex min-h-svh flex-col">
        <React.Suspense fallback={null}>
          <Header
            initialAuth={{
              email: initialAuth.email,
              avatarUrl: initialAuth.avatarUrl,
              displayName: initialAuth.displayName,
              shortId: initialAuth.shortId ?? undefined,
              isAdmin: initialAuth.isAdmin,
              walletBalance: initialAuth.walletBalance ?? null,
              hasSession: initialAuth.hasSession,
            }}
          />
        </React.Suspense>
        <SidebarProvider>
          <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className="border-0 bg-transparent sidebar-glass">
            <SidebarHeader />
            <SidebarContent className="pt-20 pb-4 flex flex-col">
              <div className="mx-2 mb-2 rounded-2xl bg-card text-card-foreground border border-border shadow-sm px-3 py-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleNavigate('/app')}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground/90 hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Panel gracza</span>
                </button>
                <span
                  aria-label="status"
                  className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                />
              </div>

              <div className="mx-2 rounded-2xl bg-card border border-border shadow-sm p-2 flex flex-col flex-1">
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        onClick={() => handleNavigate(item.href)}
                        isActive={getActiveState(item.href)}
                        tooltip={{ children: item.label, side: 'right', align: 'center' }}
                        variant="bubble"
                        size="lg"
                        className="justify-start text-foreground/85 hover:text-red-500"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
                <SidebarMenu className="mt-auto pt-4 pb-[60px] space-y-2">
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => handleNavigate('/admin')}
                        isActive={pathname?.startsWith('/admin')}
                        tooltip={{ children: 'Admin panel', side: 'right', align: 'center' }}
                        variant="bubble"
                        size="lg"
                        className="justify-start text-foreground/85 hover:text-red-500"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigate('/app/settings?tab=phone')}
                      isActive={getActiveState('/app/settings')}
                      tooltip={{
                        children: needsPhone ? 'Dodaj i potwierdź numer telefonu' : 'Ustawienia',
                        side: 'right',
                        align: 'center',
                      }}
                      variant="bubble"
                      size="lg"
                      className="justify-start text-foreground/85 hover:text-red-500"
                    >
                      <SettingsIcon className="h-4 w-4" />
                      <span>Ustawienia</span>
                  {needsPhone && (
                    <span
                      aria-label="Wymaga uwagi"
                      title="Wymagana weryfikacja telefonu"
                      className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-destructive text-destructive-foreground text-[12px] font-extrabold leading-none shadow-sm group-data-[collapsible=icon]:hidden animate-vibrate"
                    >
                      !
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={handleLogout}
                      tooltip={{ children: 'Wyloguj', side: 'right', align: 'center' }}
                      variant="bubble"
                      size="lg"
                      className="justify-start text-foreground/85 hover:text-red-500"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Wyloguj</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </SidebarContent>
            <SidebarFooter className="border-0 p-2 text-xs text-white/60">
              <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-center">
                <p className="font-semibold text-white">Obsługa 24/7</p>
                <p className="text-[11px] text-white/70">support@quiz-time.pl</p>
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className={cn(isPlayScreen ? 'flex-1 overflow-hidden' : undefined)}>
            {isPlayScreen ? (
              <main className="flex h-full w-full overflow-hidden py-6 px-0">
                <div className="mx-auto flex h-full w-full max-w-[1400px] overflow-hidden">{children}</div>
              </main>
            ) : (
              <main className={cn('flex-1 overflow-auto py-8', defaultPaddingX)}>
                <div className="mx-auto w-full max-w-[1500px]">{children}</div>
              </main>
            )}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
