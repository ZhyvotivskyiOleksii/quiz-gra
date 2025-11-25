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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Play, History, LogOut, Settings as SettingsIcon, LayoutDashboard, Shield, Trophy, Info } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { getSupabase } from '@/lib/supabaseClient'
import { Header } from '@/components/shared/header'
import { cn } from '@/lib/utils'
import { LoaderOverlay } from '@/components/ui/pitch-loader'

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
  const [bootstrapping, setBootstrapping] = React.useState(true)
  const [routeLoading, setRouteLoading] = React.useState(false)

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

      const hasPhone =
        Boolean((user as any).phone) || Boolean((user.user_metadata as any)?.phone)
      const phoneConfirmed =
        Boolean((user as any).phone_confirmed_at) || Boolean((user.user_metadata as any)?.phone_confirmed_at)
      setNeedsPhone(!hasPhone || !phoneConfirmed)
    }

    ;(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        await hydrate(user)
      } finally {
        setBootstrapping(false)
      }
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
    { href: '/app/info', label: 'Info', icon: Info },
    { href: '/app/results', label: 'Wyniki', icon: Trophy },
  ]

  const handleNavigate = (href: string) => {
    if (href === pathname) return
    setRouteLoading(true)
    router.push(href)
  }

  const handleLogout = async () => {
    const s = getSupabase()
    try {
      await s.auth.signOut()
    } catch {}
    try {
      await fetch('/api/auth/callback', {
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
  const defaultPaddingX = 'px-3 sm:px-5 md:px-7 lg:px-10 xl:px-16'
  const previousPathRef = React.useRef(pathname)

  React.useEffect(() => {
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname
      setRouteLoading(false)
    }
  }, [pathname])

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
      <LoaderOverlay show={bootstrapping || routeLoading} message={routeLoading ? 'Przełączamy widok…' : 'Ładujemy Twój panel…'} />
      <div className="relative min-h-svh w-full overflow-hidden">
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
          <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className="border-0 bg-transparent sidebar-glass text-white">
            <SidebarHeader />
            <SidebarContent className="pt-20 pb-4 flex flex-col">
              <div className="mx-2 mb-2 rounded-2xl bg-card text-card-foreground border border-border shadow-sm px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('/app')}
                  className="flex w-full items-center justify-end text-sm font-semibold text-foreground/90 hover:text-foreground"
                >
                  <span className="text-base uppercase tracking-[0.4em] text-white/70">Panel Gracza</span>
                </button>
              </div>

              <div className="mx-2 rounded-2xl p-2 flex flex-col flex-1">
                <PlayerSidebarNav
                  menuItems={menuItems}
                  isAdmin={isAdmin}
                  needsPhone={needsPhone}
                  handleNavigate={handleNavigate}
                  handleLogout={handleLogout}
                  getActiveState={getActiveState}
                />
              </div>
            </SidebarContent>
            <SidebarFooter className="border-0 p-2 text-xs text-white/60">
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] px-4 py-3 shadow-[0_18px_45px_rgba(3,4,12,0.45)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon/support.svg"
                  alt="Support"
                  className="h-8 w-8 rounded-full border border-white/30 bg-gradient-to-br from-[#f97316] via-[#fb7185] to-[#8b5cf6] p-1 shadow-[0_12px_28px_rgba(249,113,22,0.35)]"
                />
                <div className="flex flex-col leading-tight text-left">
                  <p className="text-[13px] font-semibold text-white">Obsługa 24/7</p>
                  <p className="text-[11px] text-white/70 tracking-wide">support@quiz-time.pl</p>
                </div>
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="relative bg-transparent">
            <SidebarTrigger
              className="fixed left-4 top-[88px] z-30 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/40 text-white shadow-[0_15px_35px_rgba(3,2,12,0.55)] backdrop-blur-md sm:hidden"
              aria-label="Otwórz menu"
            />
            <main className={cn('flex-1 overflow-auto py-8', isPlayScreen ? 'px-0' : defaultPaddingX)}>
              <div className={cn('relative z-10 mx-auto w-full', isPlayScreen ? 'max-w-[1400px]' : 'max-w-[1500px]')}>
                {children}
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
    </>
  )
}

type PlayerSidebarNavProps = {
  menuItems: { href: string; label: string; icon: any }[]
  isAdmin: boolean
  needsPhone: boolean
  handleNavigate: (href: string) => void
  handleLogout: () => void
  getActiveState: (href: string) => boolean
}

function PlayerSidebarNav({
  menuItems,
  isAdmin,
  needsPhone,
  handleNavigate,
  handleLogout,
  getActiveState,
}: PlayerSidebarNavProps) {
  const { setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()

  const closeMobile = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  const navigateAndClose = React.useCallback(
    (href: string) => {
      handleNavigate(href)
      closeMobile()
    },
    [handleNavigate, closeMobile],
  )

  const logoutAndClose = React.useCallback(() => {
    closeMobile()
    handleLogout()
  }, [closeMobile, handleLogout])

  return (
    <>
      <SidebarMenu>
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              onClick={() => navigateAndClose(item.href)}
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
              onClick={() => navigateAndClose('/admin')}
              isActive={getActiveState('/admin')}
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
            onClick={() => navigateAndClose('/app/settings?tab=phone')}
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
            onClick={logoutAndClose}
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
    </>
  )
}
