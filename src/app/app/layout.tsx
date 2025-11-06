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
  SidebarInset,
} from '@/components/ui/sidebar';
import { Play, History, LogOut, Settings as SettingsIcon, LayoutDashboard, Shield } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSupabase } from '@/lib/supabaseClient';
import { Header } from '@/components/shared/header';
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

  // initials no longer used in this layout

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
    <>
      <Header />
      <SidebarProvider>
      <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className="border-0">
        {/* Global header already contains the logo */}
        <SidebarHeader className="px-2 py-2" />
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
        <main className="flex-1 overflow-auto px-15 py-4 sm:py-6">{children}</main>
      </SidebarInset>
      </SidebarProvider>
    </>
  );
}
