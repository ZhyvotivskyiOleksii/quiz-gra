'use client';

import { Logo } from '@/components/shared/logo';
// No i18n now: Polish only
import { User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoginForm } from '../auth/login-form';
import { RegisterForm } from '../auth/register-form';
import * as React from 'react';
import { Button } from '../ui/button';
import { ThemeSwitcher } from './theme-switcher';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();
  const [userEmail, setUserEmail] = React.useState<string | undefined>(undefined)
  const [hasSession, setHasSession] = React.useState(false)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [displayName, setDisplayName] = React.useState<string | undefined>(undefined)
  const [shortId, setShortId] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (user && !userErr) {
        setHasSession(true)
        setUserEmail(user.email ?? (user.user_metadata?.email as string | undefined))
        // 1) read avatar from auth metadata/provider
        let nextAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
        // 2) fallback to profiles.avatar_url (often updates first)
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url, is_admin')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.avatar_url) nextAvatar = profile.avatar_url as string
          setIsAdmin(Boolean(profile?.is_admin))
        } catch {}
        // Name + short id
        const fn = (user.user_metadata?.first_name as string | undefined) || ''
        const ln = (user.user_metadata?.last_name as string | undefined) || ''
        const dn = `${fn} ${ln}`.trim() || (user.email?.split('@')[0] ?? 'User')
        setDisplayName(dn)
        try {
          const { data: sid } = await supabase.rpc('get_or_create_short_id')
          if (sid) setShortId(String(sid))
        } catch {}
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
        if (evt === 'SIGNED_IN' && sess?.access_token && (sess as any)?.refresh_token) {
          try {
            await fetch('/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ event: evt, session: { access_token: (sess as any).access_token, refresh_token: (sess as any).refresh_token } }),
            })
          } catch {}
        }
        // Do not force navigation here; redirect is handled by forms and OAuth callback
        if (sess?.user) {
          setUserEmail(sess.user.email ?? (sess.user.user_metadata?.email as string | undefined))
          let nextAvatar = (sess.user.user_metadata?.avatar_url || sess.user.user_metadata?.picture) as string | undefined
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url, is_admin')
              .eq('id', sess.user.id)
              .maybeSingle()
            if (profile?.avatar_url) nextAvatar = profile.avatar_url as string
            setIsAdmin(Boolean(profile?.is_admin))
          } catch {}
          const fn = (sess.user.user_metadata?.first_name as string | undefined) || ''
          const ln = (sess.user.user_metadata?.last_name as string | undefined) || ''
          const dn = `${fn} ${ln}`.trim() || (sess.user.email?.split('@')[0] ?? 'User')
          setDisplayName(dn)
          try {
            const { data: sid } = await supabase.rpc('get_or_create_short_id')
            if (sid) setShortId(String(sid))
          } catch {}
          setAvatarUrl(nextAvatar)
        } else {
          setUserEmail(undefined); setAvatarUrl(undefined); setIsAdmin(false); setDisplayName(undefined); setShortId(undefined);
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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center w-full max-w-[1440px] mx-auto px-[60px]">
        <Logo />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {!isMobile && <ThemeSwitcher />}
            {(displayName || shortId) && (
              <div className="hidden sm:flex flex-col items-end mr-1 leading-tight">
                {displayName && <span className="text-sm font-medium truncate max-w-[200px]">{displayName}</span>}
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
                  <DropdownMenuContent align="end">
                    {(displayName || shortId) && (
                      <>
                        <DropdownMenuLabel>Moje konto</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => router.push('/app/settings' as any)}>Ustawienia</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/app/history' as any)}>Historia</DropdownMenuItem>
                    {isAdmin && (<>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/admin' as any)}>Admin panel</DropdownMenuItem>
                    </>)}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>Wyloguj</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center justify-center text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none">
                  <User className="h-6 w-6" />
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
    </header>
  );
}
