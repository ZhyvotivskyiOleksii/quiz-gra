'use client';

import { Logo } from '@/components/shared/logo';
// No i18n now: Polish only
import { User, Settings as SettingsIcon, History as HistoryIcon, Shield, LogOut as LogOutIcon, CircleDollarSign } from 'lucide-react';
import * as React from 'react';
import { Button } from '../ui/button';
import { getSupabase } from '@/lib/supabaseClient';
import { performClientLogout } from '@/lib/logout-client';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useRouter, usePathname } from 'next/navigation';
import { emitAuthEvent, subscribeToAuthEvents } from '@/lib/auth-events';
import Link from 'next/link';

export type HeaderInitialAuth = {
  email?: string
  avatarUrl?: string
  displayName?: string
  shortId?: string | null
  isAdmin?: boolean
  walletBalance?: number | null
  hasSession?: boolean
}

type HeaderProps = {
  initialAuth?: HeaderInitialAuth
}

export function Header({ initialAuth }: HeaderProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = React.useState<string | undefined>(initialAuth?.email)
  const [hasSession, setHasSession] = React.useState(Boolean(initialAuth?.hasSession ?? initialAuth?.email))
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(initialAuth?.avatarUrl || undefined)
  const [isAdmin, setIsAdmin] = React.useState(Boolean(initialAuth?.isAdmin))
  const [displayName, setDisplayName] = React.useState<string | undefined>(initialAuth?.displayName || undefined)
  const [shortId, setShortId] = React.useState<string | undefined>(
    initialAuth?.shortId ? String(initialAuth.shortId) : undefined
  )
  
  // Preserve shortId from initialAuth and don't clear it unnecessarily
  React.useEffect(() => {
    if (initialAuth?.shortId && !shortId) {
      setShortId(String(initialAuth.shortId))
    }
  }, [initialAuth?.shortId, shortId])
  const [walletBalance, setWalletBalance] = React.useState<number | null>(
    typeof initialAuth?.walletBalance === 'number' ? initialAuth.walletBalance : null,
  )
  const formattedBalance = React.useMemo(() => {
    if (walletBalance === null) return null
    return formatCurrency(walletBalance)
  }, [walletBalance])
  const supabaseRef = React.useRef<ReturnType<typeof getSupabase> | null>(null)
  const mountedRef = React.useRef(true)
  const loggingOutRef = React.useRef(false)
  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchBalance = React.useCallback(async (supabaseClient: ReturnType<typeof getSupabase>) => {
    try {
      // Check if we still have a valid session before querying
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session) {
        setWalletBalance(0)
        return
      }
      
      const { data, error } = await supabaseClient.rpc('get_user_balance')
      if (error) {
        // Function might not exist (404) - set balance to 0
        setWalletBalance(0)
        return
      }
      if (typeof data === 'number') {
        setWalletBalance(data)
      } else if (data === null || data === undefined) {
        setWalletBalance(0)
      } else {
        const parsed = Number(data)
        setWalletBalance(Number.isFinite(parsed) ? parsed : 0)
      }
    } catch {
      // Silently handle errors - function might not exist
      setWalletBalance(0)
    }
  }, [])

  const applyUser = React.useCallback(
    async (user: any | null, supabaseClient?: ReturnType<typeof getSupabase>) => {
      const supabase = supabaseClient ?? supabaseRef.current ?? getSupabase()
      supabaseRef.current = supabase

      if (!mountedRef.current) return
      if (!user) {
        setHasSession(false)
        setUserEmail(undefined)
        setAvatarUrl(undefined)
        setIsAdmin(false)
        setDisplayName(undefined)
        setShortId(undefined)
        setWalletBalance(null)
        return
      }

      setHasSession(true)
      
      // Preserve current shortId before updating
      const preservedShortId = shortId || initialAuth?.shortId
      
      const emailFromUser =
        user.email ??
        (user.user_metadata?.email as string | undefined) ??
        ((user.user_metadata as any)?.contact_email as string | undefined)
      setUserEmail(emailFromUser)

      let profileAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      let profileDisplayName: string | undefined
      let profileIsAdmin = false
      try {
        // Check if we still have a valid session before querying
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !mountedRef.current) return
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, email, is_admin, short_id')
          .eq('id', user.id)
          .maybeSingle()
        
        if (profileError) {
          // Silently handle 400/404 errors - profile might not exist or query syntax issue
          // Don't log to console to avoid noise
        } else if (profile) {
          if (profile.avatar_url) profileAvatar = profile.avatar_url as string
          if (profile.email && !user.email) setUserEmail(profile.email as any)
          if (profile.display_name) profileDisplayName = profile.display_name as string
          profileIsAdmin = Boolean(profile?.is_admin)
          // Use short_id from profile if available
          if (profile.short_id && !shortId) {
            setShortId(String(profile.short_id))
          }
        }
      } catch (err) {
        // Silently handle errors - profile might not exist
        console.warn('[header] Profile fetch error:', err)
      }

      const fn = (user.user_metadata?.first_name as string | undefined) || ''
      const ln = (user.user_metadata?.last_name as string | undefined) || ''
      const dn = `${fn} ${ln}`.trim()
      const derivedName = profileDisplayName?.trim() || dn || emailFromUser?.split('@')[0] || 'User'
      setDisplayName(derivedName)

      // Get short ID - preserve existing one if RPC fails
      // First check if we still have a valid session
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !mountedRef.current) {
          // No session - use preserved shortId if available
          if (preservedShortId) {
            setShortId(preservedShortId)
          }
          return
        }
      } catch {
        // Session check failed - use preserved shortId
        if (preservedShortId) {
          setShortId(preservedShortId)
        }
        return
      }
      
      // First try to get from profile if available
      let profileShortId: string | undefined = undefined
      try {
        const { data: profileWithShortId, error: profileError } = await supabase
          .from('profiles')
          .select('short_id')
          .eq('id', user.id)
          .maybeSingle()
        if (profileError) {
          // Silently handle errors
        } else if (profileWithShortId?.short_id) {
          profileShortId = String(profileWithShortId.short_id)
        }
      } catch {
        // Silently handle errors
      }
      
      // Try RPC function
      try {
        const { data: sid, error: sidError } = await supabase.rpc('get_or_create_short_id')
        if (sidError) {
          // RPC function might not exist (404) - use fallback
          const fallbackId = profileShortId || preservedShortId
          if (fallbackId && !mountedRef.current) return
          if (fallbackId) {
            setShortId(fallbackId)
          }
        } else if (sid) {
          if (!mountedRef.current) return
          setShortId(String(sid))
        } else {
          // RPC returned null - use profile or preserved
          const fallbackId = profileShortId || preservedShortId
          if (fallbackId && !mountedRef.current) return
          if (fallbackId) {
            setShortId(fallbackId)
          }
        }
      } catch (err) {
        // RPC function might not exist - use fallback
        const fallbackId = profileShortId || preservedShortId
        if (fallbackId && !mountedRef.current) return
        if (fallbackId) {
          setShortId(fallbackId)
        }
      }

      await fetchBalance(supabase)
      if (!mountedRef.current) return
      setAvatarUrl(profileAvatar)

      // Check admin status from multiple sources
      const envAdmins =
        process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) || []
      const mail = (user.email || (user.user_metadata?.email as string) || '').toLowerCase()
      const isEnvAdmin = mail && envAdmins.includes(mail)
      
      const metaAdmin =
        profileIsAdmin ||
        Boolean(user.app_metadata?.is_admin) ||
        Boolean(user.user_metadata?.is_admin) ||
        (Array.isArray((user.app_metadata as any)?.roles) && (user.app_metadata as any).roles.includes('admin')) ||
        isEnvAdmin

      // Always set admin status - preserve current status if we were already admin
      // This prevents admin status from being lost during navigation
      const shouldBeAdmin = metaAdmin || (isAdmin && initialAuth?.isAdmin)
      setIsAdmin(shouldBeAdmin)

      // If user is in admin list but not marked in profile, update profile
      if (isEnvAdmin && !profileIsAdmin) {
        try {
          await supabase.from('profiles').upsert({ id: user.id, is_admin: true } as any, { onConflict: 'id' } as any)
          if (!mountedRef.current) return
          setIsAdmin(true)
        } catch {}
      }
      
      // Also refresh profile to get updated is_admin status
      if (isEnvAdmin || shouldBeAdmin) {
        try {
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle()
          if (!mountedRef.current) return
          if (updatedProfile?.is_admin || shouldBeAdmin) {
            setIsAdmin(true)
          }
        } catch {}
      }
    },
    [fetchBalance, shortId, initialAuth?.shortId, isAdmin, initialAuth?.isAdmin],
  )

  const syncServerCookies = React.useCallback(async (evt: string, session: any) => {
    const shouldSync =
      (!!session?.user && evt === 'INITIAL_SESSION') ||
      evt === 'SIGNED_IN' ||
      evt === 'TOKEN_REFRESHED' ||
      evt === 'USER_UPDATED'
    if (shouldSync && session?.access_token && (session as any)?.refresh_token) {
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            event: evt,
            session: {
              access_token: (session as any).access_token,
              refresh_token: (session as any).refresh_token,
            },
          }),
        })
      } catch {}
    }
  }, [])

  const resetAuthState = React.useCallback(() => {
    setHasSession(false)
    setUserEmail(undefined)
    setAvatarUrl(undefined)
    setIsAdmin(false)
    setDisplayName(undefined)
    setShortId(undefined)
    setWalletBalance(null)
  }, [])

  const refreshCurrentUser = React.useCallback(async () => {
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
    let active = true

    ;(async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!active) return

    if (user && !error) {
      await applyUser(user, supabase)
      if (!active) return

      try {
        const { data: sess } = await supabase.auth.getSession()
        if (sess?.session) {
          await syncServerCookies('INITIAL_SESSION', sess.session)
        }
      } catch {}
    } else {
      await applyUser(null, supabase)
    }
  } catch (err) {
    // на всякий пожарный
    console.error('[header] initial user sync failed', err)
    if (!active) return
    await applyUser(null, supabase)
  }
})()


    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, sess) => {
      if (!active || loggingOutRef.current) return
      
      // If signed out, immediately reset state and stop
      if (evt === 'SIGNED_OUT' || !sess) {
        if (!loggingOutRef.current) {
          resetAuthState()
        }
        return
      }
      
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!active) return
        
        // Only apply user if we have a valid session
        if (user && sess) {
          await applyUser(user, supabase)
        } else {
          await applyUser(null, supabase)
        }
      } catch {
        if (!active) return
        await applyUser(null, supabase)
      }
      if (!active || !sess) return
      await syncServerCookies(evt, sess)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [applyUser, syncServerCookies])

  React.useEffect(() => {
    return subscribeToAuthEvents((event) => {
      if (event.type === 'profile:update' || event.type === 'session:refresh') {
        refreshCurrentUser()
        return
      }
      if (event.type === 'session:logout') {
        resetAuthState()
      }
    })
  }, [refreshCurrentUser, resetAuthState])
  
  // Refresh admin status when navigating between /app and /admin
  // But preserve admin status - don't let it be reset
  React.useEffect(() => {
    if (pathname && (pathname.startsWith('/app') || pathname.startsWith('/admin'))) {
      // Small delay to ensure route has changed
      const timeoutId = setTimeout(() => {
        refreshCurrentUser()
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [pathname, refreshCurrentUser])
  

  const initials = React.useMemo(() => {
    const base = (displayName || userEmail || '').trim()
    const e = userEmail || ''
    const name = base ? base.split('@')[0] : ''
    if (!name) return 'US'
    const first = name[0]?.toUpperCase() || 'U'
    const second = (name.split(/[\W_]+/)[1]?.[0] || e[0] || 'S').toUpperCase()
    return `${first}${second}`
  }, [userEmail, displayName])

  const redirectToHome = React.useCallback(() => {
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
    resetAuthState()
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
  }, [resetAuthState, router])

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-transparent backdrop-blur-md"
        suppressHydrationWarning
      >
        <div className="relative w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-screen-2xl flex h-16 items-center">
          <Logo href="/" />
          <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {(displayName || userEmail || shortId) && (
              <div className="hidden sm:flex flex-col items-end mr-1 leading-tight">
                {/* Первая строка: имя и фамилия, если есть; иначе e‑mail */}
                <span className="text-sm font-medium truncate max-w-[220px]">
                  {displayName ? displayName : (userEmail || '')}
                </span>
                {/* Вторая строка: всегда ID */}
                {shortId && <span className="text-xs text-muted-foreground">ID: {shortId}</span>}
              </div>
            )}
            {(hasSession || displayName || userEmail || shortId) ? (
              // На маркетинговых страницах (главная и пр.) вместо меню — прямой вход в панель
              pathname && !pathname.startsWith('/app') && !pathname.startsWith('/admin') ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="overflow-hidden rounded-full"
                  title="Przejdź do panelu"
                  onClick={() => {
                    try { window.location.assign('/app') } catch { router.push('/app' as any) }
                  }}
                >
                  <Avatar>
                    <AvatarImage data-ai-hint="person face" src={avatarUrl} alt="User" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="overflow-hidden rounded-full"
                      title="Menu użytkownika"
                    >
                      <Avatar>
                        <AvatarImage data-ai-hint="person face" src={avatarUrl} alt="User" />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 p-1.5 rounded-xl border border-border/40 bg-card/95 backdrop-blur-sm shadow-lg"
                  >
                    <DropdownMenuLabel className="px-3 py-3 text-center">
                      <div className="text-sm font-semibold truncate">
                        {displayName || 'Moje konto'}
                      </div>
                      {userEmail && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</div>
                      )}
                      {shortId && (
                        <div className="text-xs text-muted-foreground mt-0.5">ID: {shortId}</div>
                      )}
                      {formattedBalance && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                          <CircleDollarSign className="h-3 w-3" />
                          <span>Saldo: {formattedBalance}</span>
                        </div>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="group flex items-center gap-2 rounded-md px-3 py-2 text-foreground/90 transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      onClick={() => router.push('/app/settings' as any)}
                    >
                      <SettingsIcon className="h-4 w-4 text-muted-foreground transition-colors group-data-[highlighted]:text-white" />
                      <span className="transition-colors group-data-[highlighted]:text-white">Ustawienia</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      className="group flex items-center gap-2 rounded-md px-3 py-2 text-foreground/90 transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      onClick={() => router.push('/app/history' as any)}
                    >
                      <HistoryIcon className="h-4 w-4 text-muted-foreground transition-colors group-data-[highlighted]:text-white" />
                      <span className="transition-colors group-data-[highlighted]:text-white">Historia</span>
                    </DropdownMenuItem>

                    {isAdmin && (
                      <DropdownMenuItem
                        className="group flex items-center gap-2 rounded-md px-3 py-2 text-foreground/90 transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                        onClick={() => router.push('/admin' as any)}
                      >
                        <Shield className="h-4 w-4 text-muted-foreground transition-colors group-data-[highlighted]:text-white" />
                        <span className="transition-colors group-data-[highlighted]:text-white">Admin panel</span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <div className="px-2 pb-1.5">
                      <Button
                        variant="destructive"
                        className="w-full h-10 text-[13px] font-extrabold tracking-wide"
                        onClick={handleLogout}
                      >
                        <LogOutIcon className="h-4 w-4 mr-2" /> Wyloguj
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            ) : (
              <Button
                variant="outline"
                className="border-white/30 bg-white/5 text-foreground/90 hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/login" className="flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4" />
                  Zaloguj się
                </Link>
              </Button>
            )}
          </nav>
          </div>
        </div>
        </div>
      </header>
      <div aria-hidden className="h-16 w-full" />
    </>
  );
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}
