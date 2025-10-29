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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();

  // Client-side guard
  React.useEffect(() => {
    (async () => {
      const s = getSupabase();
      const { data: { user } } = await s.auth.getUser();
      if (!user) { router.push('/'); return }
      try {
        const { data: p } = await s.from('profiles').select('is_admin').eq('id', user.id).single()
        if (!p?.is_admin) router.push('/');
      } catch { router.push('/') }
    })()
  }, [])

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
  const handleLogout = async () => { const s = getSupabase(); await s.auth.signOut(); router.push('/'); }
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
              <SidebarMenuButton onClick={handleLogout} tooltip={{ children: 'Wyloguj', side: 'right', align: 'center' }}>
                <LogOut />
                <span>Wyloguj</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-auto flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                  <Avatar>
                    <AvatarImage data-ai-hint="person face" src={`https://picsum.photos/seed/admin/40/40`} alt="Admin" />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigate('/admin/settings')}>Ustawienia</DropdownMenuItem>
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
