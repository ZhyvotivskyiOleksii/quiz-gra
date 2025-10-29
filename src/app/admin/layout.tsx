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
import { LayoutDashboard, HelpCircle, Book, Users, FileClock, Settings, LogOut, ListChecks } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSupabase } from '@/lib/supabaseClient';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [userEmail, setUserEmail] = React.useState<string | undefined>(undefined)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined)
  const [displayName, setDisplayName] = React.useState<string | undefined>(undefined)
  const [shortId, setShortId] = React.useState<string | undefined>(undefined)

  // Admin layout no longer blocks navigation here; gating handled elsewhere if needed

  React.useEffect(() => {
    const supabase = getSupabase();
    async function hydrate(user: any | null) {
      if (!user) { setUserEmail(undefined); setAvatarUrl(undefined); setDisplayName(undefined); return }
      setUserEmail(user.email ?? (user.user_metadata?.email as string | undefined))
      const viaProvider = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      setAvatarUrl(viaProvider)
      const fn = (user.user_metadata?.first_name as string | undefined) || ''
      const ln = (user.user_metadata?.last_name as string | undefined) || ''
      const dn = `${fn} ${ln}`.trim() || (user.email?.split('@')[0] ?? 'User')
      setDisplayName(dn)
      try {
        const { data: rpcData } = await supabase.rpc('get_or_create_short_id')
        if (rpcData) setShortId(rpcData as any)
      } catch {}
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, display_name')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url as any)
        if (profile?.display_name) setDisplayName((profile.display_name as any) || dn)
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
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/quizzes', label: 'Wiktoryny', icon: ListChecks },
    { href: '/admin/questions', label: 'Pytania', icon: HelpCircle },
    { href: '/admin/settlements', label: 'Rozliczenia', icon: Book },
    { href: '/admin/users', label: 'Użytkownicy', icon: Users },
    { href: '/admin/logs', label: 'Logi audytowe', icon: FileClock },
    { href: '/admin/settings', label: 'Ustawienia', icon: Settings },
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
  const getActiveState = (itemHref: string) => (itemHref === '/admin' ? pathname === itemHref : pathname.startsWith(itemHref));

  return (
    <SidebarProvider>
      <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'}>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton onClick={() => handleNavigate(item.href)} isActive={getActiveState(item.href)} tooltip={{ children: item.label, side: 'right', align: 'center' }}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => handleNavigate('/app')}
                isActive={pathname?.startsWith('/app')}
                tooltip={{ children: 'Panel', side: 'right', align: 'center' }}
              >
                <LayoutDashboard />
                <span>Panel</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip={{ children: 'Wyloguj', side: 'right', align: 'center' }}>
                <LogOut />
                <span>Wyloguj</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 bg-background px-4 md:px-6 border-b border-border/40">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-auto flex items-center gap-2 md:gap-4">
            <ThemeSwitcher />
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
                <DropdownMenuItem onClick={() => handleNavigate('/app/settings')}>Ustawienia</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate('/app/history')}>Historia</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Wyloguj</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
