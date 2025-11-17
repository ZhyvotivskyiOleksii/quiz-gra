'use client';

import { Logo } from '@/components/shared/logo';
// No i18n now: Polish only
import { User, Settings as SettingsIcon, History as HistoryIcon, Shield, LogOut as LogOutIcon, CircleDollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoginForm } from '../auth/login-form';
import { RegisterForm } from '../auth/register-form';
import * as React from 'react';
import { Button } from '../ui/button';
import { getSupabase } from '@/lib/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [authView, setAuthView] = React.useState<'login' | 'register'>('login');
  const [loginPrefill, setLoginPrefill] = React.useState<{ email?: string; password?: string; notice?: string }|null>(null);
  const [userEmail, setUserEmail] = React.useState<string | undefined>(undefined)
  const [hasSession, setHasSession] = React.useState(false)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [displayName, setDisplayName] = React.useState<string | undefined>(undefined)
  const [shortId, setShortId] = React.useState<string | undefined>(undefined)
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null)
  const formattedBalance = React.useMemo(() => {
    if (walletBalance === null) return null
    return formatCurrency(walletBalance)
  }, [walletBalance])

  const fetchBalance = React.useCallback(async (supabaseClient: ReturnType<typeof getSupabase>) => {
    try {
      const { data } = await supabaseClient.rpc('get_user_balance')
      if (typeof data === 'number') {
        setWalletBalance(data)
      } else if (data === null || data === undefined) {
        setWalletBalance(0)
      } else {
        const parsed = Number(data)
        setWalletBalance(Number.isFinite(parsed) ? parsed : 0)
      }
    } catch {
      setWalletBalance(null)
    }
  }, [])

  React.useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (user && !userErr) {
        setHasSession(true)
        setUserEmail(
          (user.email as string | undefined)
          || (user.user_metadata?.email as string | undefined)
          || ((user.user_metadata as any)?.contact_email as string | undefined)
        )
        // 1) read avatar from auth metadata/provider
        let nextAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
        // 2) fallback to profiles.avatar_url (often updates first)
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url, display_name, email, is_admin')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.avatar_url) nextAvatar = profile.avatar_url as string
          if (profile?.email && !user.email) setUserEmail(profile.email as any)
          if (profile?.display_name) setDisplayName((profile.display_name as any))
          setIsAdmin(Boolean(profile?.is_admin))
        } catch {}
        // Name + short id
        const fn = (user.user_metadata?.first_name as string | undefined) || ''
        const ln = (user.user_metadata?.last_name as string | undefined) || ''
        const dn = `${fn} ${ln}`.trim()
        setDisplayName(dn || undefined)
        try {
          const { data: sid } = await supabase.rpc('get_or_create_short_id')
          if (sid) setShortId(String(sid))
        } catch {}
        await fetchBalance(supabase)
        // Ensure server-side cookies exist if client has a session
        try {
          // quick ping to see if server sees session
          const ping = await fetch('/api/auth/ping', { credentials: 'include', cache: 'no-store' })
          const pj = await ping.json().catch(() => ({} as any))
          if (!pj?.ok) {
            const { data: sess } = await supabase.auth.getSession()
            if (sess?.session?.access_token && sess?.session?.refresh_token) {
              await fetch('/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ event: 'SIGNED_IN', session: sess.session }),
              })
            }
          }
        } catch {}
        // Auto-promote by env if configured
        try {
          const envAdmins = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e=>e.trim().toLowerCase()).filter(Boolean) || []
          const mail = (user.email || (user.user_metadata?.email as string) || '').toLowerCase()
          if (envAdmins.includes(mail)) {
            await supabase.from('profiles').upsert({ id: user.id, is_admin: true } as any, { onConflict: 'id' } as any)
            setIsAdmin(true)
          }
        } catch {}
        setAvatarUrl(nextAvatar)
      }
      // Keep server cookies in sync so RSC routes (/app) see the session
      const { data: sub } = supabase.auth.onAuthStateChange(async (evt, sess) => {
        setHasSession(Boolean(sess?.user))
        const shouldSync =
          (!!sess?.user && evt === 'INITIAL_SESSION') ||
          evt === 'SIGNED_IN' ||
          evt === 'TOKEN_REFRESHED' ||
          evt === 'USER_UPDATED'
        if (shouldSync && sess?.access_token && (sess as any)?.refresh_token) {
          try {
            await fetch('/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                event: evt,
                session: {
                  access_token: (sess as any).access_token,
                  refresh_token: (sess as any).refresh_token,
                },
              }),
            })
          } catch {}
        }
        // Do not force navigation here; redirect is handled by forms and OAuth callback
        if (sess?.user) {
          setUserEmail(
            (sess.user.email as string | undefined)
            || (sess.user.user_metadata?.email as string | undefined)
            || ((sess.user.user_metadata as any)?.contact_email as string | undefined)
          )
          let nextAvatar = (sess.user.user_metadata?.avatar_url || sess.user.user_metadata?.picture) as string | undefined
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url, display_name, email, is_admin')
              .eq('id', sess.user.id)
              .maybeSingle()
            if (profile?.avatar_url) nextAvatar = profile.avatar_url as string
            if (profile?.email && !sess.user.email) setUserEmail(profile.email as any)
            if (profile?.display_name) setDisplayName((profile.display_name as any))
            setIsAdmin(Boolean(profile?.is_admin))
          } catch {}
          const fn = (sess.user.user_metadata?.first_name as string | undefined) || ''
          const ln = (sess.user.user_metadata?.last_name as string | undefined) || ''
          const dn = `${fn} ${ln}`.trim()
          setDisplayName(dn || undefined)
          try {
            const { data: sid } = await supabase.rpc('get_or_create_short_id')
            if (sid) setShortId(String(sid))
          } catch {}
          await fetchBalance(supabase)
          setAvatarUrl(nextAvatar)
        } else {
          setUserEmail(undefined); setAvatarUrl(undefined); setIsAdmin(false); setDisplayName(undefined); setShortId(undefined); setWalletBalance(null);
        }
      })
      return () => { sub.subscription.unsubscribe() }
    })()
  }, [])

  // Автооткрывать модалку только если пользователь НЕ авторизован
  // и явно передан параметр ?auth=login|register на публичных страницах
  const searchParams = useSearchParams();
  React.useEffect(() => {
    const auth = searchParams?.get('auth');
    if (userEmail) return; // не открываем, если уже залогинен
    if (pathname?.startsWith('/app') || pathname?.startsWith('/admin')) return; // в приложении/админке модалка не нужна
    if (auth === 'login' || auth === 'register') {
      setAuthView(auth);
      setOpen(true);
      // Clean the query param to keep URL pretty
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('auth');
        router.replace(url.pathname + url.search + url.hash);
      } catch {}
    }
  }, [searchParams, hasSession, pathname, router]);

  const initials = React.useMemo(() => {
    const base = (displayName || userEmail || '').trim()
    const e = userEmail || ''
    const name = base ? base.split('@')[0] : ''
    if (!name) return 'US'
    const first = name[0]?.toUpperCase() || 'U'
    const second = (name.split(/[\W_]+/)[1]?.[0] || e[0] || 'S').toUpperCase()
    return `${first}${second}`
  }, [userEmail, displayName])

  const handleLogout = async () => {
    const s = getSupabase();
    try { await s.auth.signOut() } catch {}
    try {
      await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ event: 'SIGNED_OUT' }),
      })
    } catch {}
    try { router.push('/') } catch {}
  }

  const handleLoginSuccess = () => {
    setOpen(false);
    setTimeout(() => setAuthView('login'), 300);
  }

  // Если авторизовался — гарантированно закрыть модалку
  React.useEffect(() => {
    if (hasSession && open) setOpen(false)
  }, [hasSession, open])

  const handleRegisterSuccess = (prefill?: { email?: string; password?: string; notice?: string }) => {
    // Switch to login and prefill credentials, keep dialog open
    setLoginPrefill(prefill ?? null);
    setAuthView('login');
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl shadow-[0_12px_45px_rgba(3,4,10,0.65)] overflow-hidden"
        suppressHydrationWarning
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(187,155,255,0.35),_rgba(7,8,20,0.85)_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,102,51,0.2),transparent_55%)]" />
        </div>
        <div className="relative w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-screen-2xl flex h-16 items-center">
          <Logo />
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
            {hasSession ? (
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold text-foreground/80 shadow-[0_8px_20px_rgba(5,6,16,0.35)] transition-all hover:text-white hover:bg-white/10 focus:outline-none">
                  <User className="h-5 w-5" />
                  <span>Zaloguj się</span>
                </button>
              </DialogTrigger>
              <DialogContent
                className="left-0 top-0 h-[100dvh] w-screen translate-x-0 translate-y-0 rounded-none p-4 sm:p-6 overflow-y-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl font-extrabold uppercase">
                    {authView === 'login' ? 'Zaloguj się' : 'Dołącz do QuizTime'}
                  </DialogTitle>
                  {authView === 'register' ? (
                    <DialogDescription>Utwórz konto, aby zacząć rywalizację.</DialogDescription>
                  ) : (
                    // Provide an accessible description to silence aria warning
                    <DialogDescription className="sr-only">Authentication</DialogDescription>
                  )}
                </DialogHeader>
                
                {authView === 'login' ? (
                  <LoginForm
                    initialEmail={loginPrefill?.email}
                    initialPassword={loginPrefill?.password}
                    notice={loginPrefill?.notice}
                    onSuccess={handleLoginSuccess}
                    onSwitchToRegister={() => setAuthView('register')}
                  />
                ) : (
                  <>
                    <RegisterForm onSuccess={handleRegisterSuccess} />
                    <Button
                      variant="secondary"
                      className="mt-2 bg-secondary/60 hover:bg-secondary/80"
                      onClick={() => setAuthView('login')}
                    >
                      Masz już konto? Zaloguj się
                    </Button>
                  </>
                )}
              </DialogContent>
            </Dialog>
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
