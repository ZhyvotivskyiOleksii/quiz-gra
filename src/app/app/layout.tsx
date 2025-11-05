'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Play, History, LogOut, Bell, Settings as SettingsIcon, LayoutDashboard, Shield } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSupabase } from '@/lib/supabaseClient';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import TopBar from '@/components/shared/topbar';
// SidebarMenuBadge not needed; integrate badge inline within button

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  // Client-side auth guard removed to avoid race with server cookies.
  // Server components under /app already check session and redirect.

  const [userEmail, setUserEmail] = React.useState<string | undefined>(undefined)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined)
  const [displayName, setDisplayName] = React.useState<string | undefined>(undefined)
  const [shortId, setShortId] = React.useState<string | undefined>(undefined)
  const [needsPhone, setNeedsPhone] = React.useState<boolean>(false)
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false)
  React.useEffect(() => {
    const supabase = getSupabase();

    async function hydrate(user: any | null) {
      if (!user) { setUserEmail(undefined); setAvatarUrl(undefined); setDisplayName(undefined); setIsAdmin(false); return }
      setUserEmail(user.email ?? (user.user_metadata?.email as string | undefined))
      const viaProvider = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      setAvatarUrl(viaProvider)
      const fn = (user.user_metadata?.first_name as string | undefined) || ''
      const ln = (user.user_metadata?.last_name as string | undefined) || ''
      const dn = `${fn} ${ln}`.trim() || (user.email?.split('@')[0] ?? 'User')
      setDisplayName(dn)
      try {
        const hasPhone = !!(user as any).phone || !!(user.user_metadata as any)?.phone
        const phoneConfirmed = Boolean((user as any).phone_confirmed_at)
        setNeedsPhone(!hasPhone || !phoneConfirmed)
      } catch { setNeedsPhone(false) }
      try {
        const { data: rpcData } = await supabase.rpc('get_or_create_short_id')
        if (rpcData) setShortId(rpcData as any)
      } catch {}

      // Fallback to profiles table so header reflects latest avatar/name and admin flag
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, is_admin')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url as any)
        if (profile?.display_name) setDisplayName((profile.display_name as any) || dn)
        setIsAdmin(Boolean((profile as any)?.is_admin))
      } catch {}
    }

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await hydrate(user)
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      hydrate(session?.user ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  const initials = React.useMemo(() => {
    const e = userEmail || ''
    const name = e.split('@')[0]
    if (!name) return 'US'
    const parts = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
    const a = (parts[0]?.[0] || 'U').toUpperCase()
    const b = (parts[1]?.[0] || e[0] || 'S').toUpperCase()
    return `${a}${b}`
  }, [userEmail])

  const menuItems = [
    { href: '/app', label: 'Panel', icon: LayoutDashboard },
    { href: '/app/play', label: 'SuperGame', icon: Play },
    { href: '/app/history', label: 'Historia', icon: History },
  ];
  
  const handleNavigate = (href: string) => router.push(href);
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
    router.push('/');
  }

  const getActiveState = (itemHref: string) => {
    if (!pathname) return false
    if (itemHref === '/app') return pathname === '/app'
    return pathname.startsWith(itemHref)
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className="border-0">
        <SidebarHeader className="px-4 py-5">
          <Logo href="/" />
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarMenu className="gap-2">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  onClick={() => handleNavigate(item.href)}
                  isActive={getActiveState(item.href)}
                  tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  variant="bubble"
                  size="lg"
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="mt-auto px-2 pb-4">
          <SidebarMenu>
            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleNavigate('/admin')}
                  variant="bubble"
                  size="lg"
                  isActive={pathname?.startsWith('/admin')}
                  tooltip={{ children: 'Admin panel', side: 'right', align: 'center' }}
                >
                  <Shield />
                  <span>Admin</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => handleNavigate('/app/settings?tab=phone')}
                variant="bubble"
                size="lg"
                isActive={getActiveState('/app/settings')}
                tooltip={{
                  children: needsPhone ? 'Dodaj i potwierdź numer telefonu' : 'Ustawienia',
                  side: 'right',
                  align: 'center',
                }}
              >
                <SettingsIcon />
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
              <SidebarMenuButton onClick={handleLogout} tooltip={{children: 'Wyloguj', side: 'right', align: 'center'}} variant="bubble" size="lg">
                <LogOut />
                <span>Wyloguj</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <TopBar>
          <SidebarTrigger className="md:hidden" />
          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {/* Header quick switch: Panel <-> SuperGame */}
            <div className="hidden md:flex items-center rounded-full bg-muted/60 p-1">
              <Button
                size="sm"
                variant={pathname === '/app' ? 'default' : 'ghost'}
                className={pathname === '/app' ? 'h-10 px-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-md !bg-gradient-to-r !from-indigo-600 !to-violet-600 !text-white' : 'h-10 px-4 rounded-full'}
                onClick={() => handleNavigate('/app')}
              >
                Panel
              </Button>
              <Button
                size="sm"
                variant={pathname?.startsWith('/app/play') ? 'default' : 'ghost'}
                className={pathname?.startsWith('/app/play') ? 'h-10 px-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-md !bg-gradient-to-r !from-indigo-600 !to-violet-600 !text-white' : 'h-10 px-4 rounded-full'}
                onClick={() => handleNavigate('/app/play')}
              >
                SuperGame
              </Button>
            </div>
            <Button variant="ghost" size="icon" aria-label="Powiadomienia" className="rounded-full">
              <Bell className="h-5 w-5" />
            </Button>
            <ThemeSwitcher />
            {/* User info placed right next to avatar */}
            {(displayName || shortId) && (
              <div className="hidden sm:flex flex-col items-end mr-1 leading-tight">
                {displayName && <span className="text-sm font-medium truncate max-w-[200px]">{displayName}</span>}
                {shortId && <span className="text-xs text-muted-foreground">ID: {shortId}</span>}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                  <Avatar>
                    <AvatarImage data-ai-hint="person face" src={avatarUrl} alt="User" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Moje konto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigate(needsPhone ? '/app/settings?tab=phone' : '/app/settings')}>Ustawienia</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate('/app/history')}>Historia</DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleNavigate('/admin')}>Admin panel</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Wyloguj</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TopBar>
        <main className="flex-1 overflow-auto px-15 py-4 sm:py-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
