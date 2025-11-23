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
  SidebarInset,
} from '@/components/ui/sidebar'
import { LayoutDashboard, Book, Users, FileClock, Settings, LogOut, ListChecks, Gift, Archive } from 'lucide-react'
import { Header } from '@/components/shared/header'
import { usePathname, useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { getSupabase } from '@/lib/supabaseClient'
import { emitAuthEvent, subscribeToAuthEvents } from '@/lib/auth-events'
import { performClientLogout } from '@/lib/logout-client'

type AdminShellProps = {
  children: React.ReactNode
  initialAuth: {
    email?: string
    avatarUrl?: string
    displayName?: string
    shortId?: string | null
  }
}

export function AdminShellClient({ children, initialAuth }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [userEmail, setUserEmail] = React.useState<string | undefined>(initialAuth.email)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(initialAuth.avatarUrl || undefined)
  const [displayName, setDisplayName] = React.useState<string | undefined>(initialAuth.displayName || undefined)
  const [shortId, setShortId] = React.useState<string | undefined>(initialAuth.shortId || undefined)
  const supabaseRef = React.useRef<ReturnType<typeof getSupabase> | null>(null)
  const mountedRef = React.useRef(true)
  const loggingOutRef = React.useRef(false)
  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const [bootstrapping, setBootstrapping] = React.useState(() => !initialAuth?.email)
  const [hasSession, setHasSession] = React.useState<boolean>(Boolean(initialAuth?.email))

  const resetAdminState = React.useCallback(() => {
    setUserEmail(undefined)
    setAvatarUrl(undefined)
    setDisplayName(undefined)
    setShortId(undefined)
    setHasSession(false)
  }, [])

  const applyUser = React.useCallback(
    async (user: any | null, supabaseClient?: ReturnType<typeof getSupabase>) => {
      const supabase = supabaseClient ?? supabaseRef.current ?? getSupabase()
      supabaseRef.current = supabase
      if (!mountedRef.current) return

      if (!user) {
        setUserEmail(undefined)
        setAvatarUrl(undefined)
        setDisplayName(undefined)
        setShortId(undefined)
        return
      }

      const emailFromUser =
        user.email ??
        (user.user_metadata?.email as string | undefined) ??
        ((user.user_metadata as any)?.contact_email as string | undefined)
      setUserEmail(emailFromUser)
      const viaProvider = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      if (viaProvider) setAvatarUrl(viaProvider)
      const fn = (user.user_metadata?.first_name as string | undefined) || ''
      const ln = (user.user_metadata?.last_name as string | undefined) || ''
      const fallbackName = `${fn} ${ln}`.trim() || (emailFromUser?.split('@')[0] ?? 'User')
      setDisplayName((prev) => prev ?? fallbackName)
      // Preserve current shortId before updating
      const preservedShortId = shortId || initialAuth.shortId
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, short_id')
          .eq('id', user.id)
          .maybeSingle()
        if (!mountedRef.current) return
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url as any)
        if (profile?.display_name) setDisplayName((profile.display_name as any) || fallbackName)
        // Use short_id from profile if available
        if (profile?.short_id && !shortId) {
          setShortId(String(profile.short_id))
        }
      } catch {}
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_or_create_short_id')
        if (!mountedRef.current) return
        if (rpcError) {
          // Keep existing shortId if RPC fails
          if (preservedShortId) {
            setShortId(preservedShortId)
          }
        } else if (rpcData) {
          setShortId(String(rpcData))
        } else if (preservedShortId) {
          // Fallback to preserved shortId if RPC returns null
          setShortId(preservedShortId)
        }
      } catch {
        // Keep existing shortId if RPC fails
        if (preservedShortId && !mountedRef.current) return
        if (preservedShortId) {
          setShortId(preservedShortId)
        }
      }
    },
    [],
  )

  const hydrateUser = React.useCallback(async () => {
    const supabase = supabaseRef.current ?? getSupabase()
    supabaseRef.current = supabase
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await applyUser(user ?? null, supabase)
  }, [applyUser])

  React.useEffect(() => {
    const supabase = supabaseRef.current ?? getSupabase()
    supabaseRef.current = supabase
    let cancelled = false

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) {
        await applyUser(user ?? null, supabase)
        setHasSession(Boolean(user))
        setBootstrapping(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, sess) => {
      if (cancelled || loggingOutRef.current) return
      
      // If signed out, immediately reset state and stop
      if (evt === 'SIGNED_OUT' || !sess) {
        if (!loggingOutRef.current) {
          resetAdminState()
          setHasSession(false)
        }
        return
      }
      
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled || loggingOutRef.current) return
        await applyUser(user ?? null, supabase)
        setHasSession(Boolean(user))
      } catch {
        if (cancelled || loggingOutRef.current) return
        await applyUser(null, supabase)
        setHasSession(false)
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [applyUser])

  React.useEffect(() => {
    return subscribeToAuthEvents((event) => {
      if (event.type === 'profile:update' || event.type === 'session:refresh') {
        hydrateUser()
      }
      if (event.type === 'session:logout') {
        resetAdminState()
      }
    })
  }, [hydrateUser, resetAdminState])

  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/quizzes', label: 'Wiktoryny', icon: ListChecks },
    { href: '/admin/bonuses', label: 'Bonusy', icon: Gift },
    { href: '/admin/history-bank', label: 'Bank pytań', icon: Archive },
    { href: '/admin/settlements', label: 'Rozliczenia', icon: Book },
    { href: '/admin/users', label: 'Użytkownicy', icon: Users },
    { href: '/admin/logs', label: 'Logi audytowe', icon: FileClock },
    { href: '/admin/settings', label: 'Ustawienia', icon: Settings },
  ]

  const handleNavigate = (href: string) => router.push(href)

  const redirectHome = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.location.replace('/')
        return
      } catch {}
    }
    try {
      router.replace('/')
      router.refresh()
    } catch {}
  }, [router])

  const handleLogout = React.useCallback(async () => {
    loggingOutRef.current = true
    resetAdminState()
    emitAuthEvent({ type: 'session:logout' })
    
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.clear()
        window.sessionStorage.clear()
      } catch {}
    }
    
    try {
      await performClientLogout()
    } finally {
      loggingOutRef.current = false
    }
    
    router.push('/login');
  }, [resetAdminState, router])

  React.useEffect(() => {
    if (bootstrapping || loggingOutRef.current) return
    if (!hasSession) {
      redirectHome()
    }
  }, [bootstrapping, hasSession, redirectHome])

  const getActiveState = (itemHref: string) => (itemHref === '/admin' ? pathname === itemHref : pathname.startsWith(itemHref))

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const { history } = window
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return () => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
      }
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <>
      <React.Suspense fallback={null}>
        <Header
          initialAuth={{
            email: initialAuth.email,
            avatarUrl: initialAuth.avatarUrl,
            displayName: initialAuth.displayName,
            shortId: initialAuth.shortId,
            isAdmin: true,
            hasSession: Boolean(initialAuth.email),
          }}
        />
      </React.Suspense>
      <SidebarProvider>
        <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'}>
          <SidebarHeader />
          <SidebarContent className="pt-20 pb-4 flex flex-col">
            <div className="mx-2 mb-2 rounded-2xl bg-card text-card-foreground border border-border shadow-sm px-3 py-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate('/admin')}
                className="flex items-center gap-2 text-sm font-semibold text-foreground/90 hover:text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin Panel</span>
              </button>
              <span aria-label="status" className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" />
            </div>

            <div className="mx-2 rounded-2xl bg-card border border-border shadow-sm p-2 flex flex-col flex-1">
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      variant="bubble"
                      size="lg"
                      className="justify-start text-foreground/85 hover:text-red-500"
                      onClick={() => handleNavigate(item.href)}
                      isActive={getActiveState(item.href)}
                      tooltip={{ children: item.label, side: 'right', align: 'center' }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              <SidebarMenu className="mt-auto pt-4 pb-[60px]">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/app')}
                    isActive={pathname?.startsWith('/app')}
                    variant="bubble"
                    size="lg"
                    className="justify-start text-foreground/85 hover:text-red-500"
                    tooltip={{ children: 'Panel', side: 'right', align: 'center' }}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Panel</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleLogout}
                    variant="bubble"
                    size="lg"
                    className="justify-start text-foreground/85 hover:text-red-500"
                    tooltip={{ children: 'Wyloguj', side: 'right', align: 'center' }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Wyloguj</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <main className="flex-1 overflow-auto px-3 sm:px-5 md:px-6 lg:px-8 xl:px-10 py-6 md:py-8">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
