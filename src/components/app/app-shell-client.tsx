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
import { Header } from '@/components/shared/header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LoaderOverlay } from '@/components/ui/pitch-loader'
import { AuthProvider, useAuth } from '@/components/app/auth-context'
import { InitialAuthState } from '@/types/auth'

type AppShellClientProps = {
  children: React.ReactNode
  initialAuth: InitialAuthState
}

export function AppShellClient({ children, initialAuth }: AppShellClientProps) {
  return (
    <AuthProvider initialAuth={initialAuth}>
      <ShellLayout>{children}</ShellLayout>
    </AuthProvider>
  )
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const { needsPhone, isAdmin, loading, logout, status, refresh, initialized } = useAuth()

  const [routeLoading, setRouteLoading] = React.useState(false)
  const [showRouteSpinner, setShowRouteSpinner] = React.useState(false)
  const previousPathRef = React.useRef(pathname)

  const menuItems = React.useMemo(
    () => [
      { href: '/app', label: 'Panel', icon: LayoutDashboard },
      { href: '/app/play', label: 'SuperGame', icon: Play },
      { href: '/app/history', label: 'Historia', icon: History },
      { href: '/app/info', label: 'Info', icon: Info },
      { href: '/app/results', label: 'Wyniki', icon: Trophy },
    ],
    [],
  )

  const handleNavigate = React.useCallback(
    (href: string) => {
      if (href === pathname) return
      setRouteLoading(true)
      router.push(href)
    },
    [pathname, router],
  )

  const handleLogout = React.useCallback(async () => {
    await logout()
    router.push('/')
  }, [logout, router])

  const getActiveState = React.useCallback(
    (itemHref: string) => {
      if (!pathname) return false
      if (itemHref === '/app') return pathname === '/app'
      return pathname.startsWith(itemHref)
    },
    [pathname],
  )

  const isPlayScreen = pathname?.startsWith('/app/quizzes/') && pathname?.includes('/play')
  const defaultPaddingX = 'px-3 sm:px-5 md:px-7 lg:px-10 xl:px-16'
  const loaderMessage = loading ? 'Ładujemy Twój panel…' : 'Przełączamy widok…'

  React.useEffect(() => {
    if (status === 'ready' || status === 'anonymous') {
      setRouteLoading(false)
    }
  }, [status])

  React.useEffect(() => {
    if (loading) return
    if (status === 'anonymous') {
      router.push('/')
    }
  }, [loading, status, router])

  React.useEffect(() => {
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname
      setRouteLoading(false)
    }
  }, [pathname])

  React.useEffect(() => {
    if (!routeLoading) {
      setShowRouteSpinner(false)
      return
    }
    const timer = window.setTimeout(() => setShowRouteSpinner(true), 250)
    return () => window.clearTimeout(timer)
  }, [routeLoading])

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

  const shouldShowRecoveryScreen = !loading && initialized && (status === 'error' || status === 'anonymous')

  const handleGoToLogin = React.useCallback(() => {
    router.push('/login')
  }, [router])

  const handleRetry = React.useCallback(async () => {
    await refresh()
  }, [refresh])

  if (shouldShowRecoveryScreen) {
    const variant: 'error' | 'anonymous' = status === 'error' ? 'error' : 'anonymous'
    return (
      <>
        <LoaderOverlay show={loading || showRouteSpinner} message={loaderMessage} />
        <AuthRecoveryScreen
          variant={variant}
          onRetry={handleRetry}
          onLogin={handleGoToLogin}
          retryDisabled={loading}
        />
      </>
    )
  }

  return (
    <>
      <LoaderOverlay show={loading || showRouteSpinner} message={loaderMessage} />
      <div className="relative min-h-svh w-full overflow-hidden">
        <div className="relative z-10 flex min-h-svh flex-col">
          <Header />
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

type AuthRecoveryScreenProps = {
  variant: 'error' | 'anonymous'
  onRetry: () => Promise<void> | void
  onLogin: () => void
  retryDisabled?: boolean
}

function AuthRecoveryScreen({ variant, onRetry, onLogin, retryDisabled }: AuthRecoveryScreenProps) {
  const isError = variant === 'error'
  const title = isError ? 'Nie udało się odświeżyć sesji' : 'Twoja sesja wygasła'
  const description = isError
    ? 'Supabase nie odpowiedziało na czas. Spróbuj jeszcze raz albo zaloguj się ponownie.'
    : 'Wylogowaliśmy Cię dla bezpieczeństwa. Kliknij przycisk, aby przejść do logowania.'
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#05010d] via-[#0b031c] to-[#12062c] px-6 py-12 text-center text-white">
      <div className="space-y-4 max-w-md">
        <p className="text-xs uppercase tracking-[0.5em] text-white/60">Panel gracza</p>
        <h1 className="text-2xl font-headline font-black">{title}</h1>
        <p className="text-sm leading-relaxed text-white/70">{description}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {isError && (
          <Button onClick={onRetry} disabled={retryDisabled} className="h-11 min-w-[180px] rounded-xl font-semibold">
            Spróbuj ponownie
          </Button>
        )}
        <Button
          variant={isError ? 'secondary' : 'default'}
          onClick={onLogin}
          className={cn(
            'h-11 min-w-[180px] rounded-xl font-semibold',
            isError ? 'border border-white/30 bg-white/10 text-white hover:bg-white/20' : '',
          )}
        >
          Przejdź do logowania
        </Button>
      </div>
    </div>
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
