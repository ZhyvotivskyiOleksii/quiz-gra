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
  SidebarInset,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Book, Users, FileClock, Settings, LogOut, ListChecks, Gift, Archive } from 'lucide-react';
import { Header } from '@/components/shared/header';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSupabase } from '@/lib/supabaseClient';

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
    { href: '/admin/bonuses', label: 'Bonusy', icon: Gift },
    { href: '/admin/history-bank', label: 'Bank pytań', icon: Archive },
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
    <>
      <React.Suspense fallback={null}>
        <Header />
      </React.Suspense>
      <SidebarProvider>
      <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'}>
        <SidebarHeader />
        <SidebarContent className="pt-20 pb-4 flex flex-col">
          {/* Group header card like client panel */}
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

          {/* Bubble style nav items inside a soft card */}
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
        <main className="flex-1 overflow-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8">
          <div className="mx-auto w-full max-w-screen-2xl">
            {children}
          </div>
        </main>
      </SidebarInset>
      </SidebarProvider>
    </>
  );
}
