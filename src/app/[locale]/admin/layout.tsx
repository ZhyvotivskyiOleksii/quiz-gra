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
import {
  LayoutDashboard,
  HelpCircle,
  Book,
  Users,
  FileClock,
  Settings,
  LogOut,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { usePathname, useRouter } from '@/navigation';
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
import { useCurrentLocale } from '@/lib/i18n/client';
import { getSupabase } from '@/lib/supabaseClient';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const locale = useCurrentLocale();
  
  // Client-side auth guard; adjust to your admin policy later
  React.useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.push(`/` as any);
        }
      } catch {
        router.push(`/` as any);
      }
    })();
  }, []);

  const [userEmail, setUserEmail] = React.useState<string | undefined>(undefined)
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email ?? (user.user_metadata?.email as string | undefined))
          const viaProvider = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
          setAvatarUrl(viaProvider)
        }
      } catch {}
    })();
  }, [])

  const initials = React.useMemo(() => {
    const e = userEmail || ''
    const name = e.split('@')[0]
    if (!name) return 'AD'
    const parts = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
    const a = (parts[0]?.[0] || 'A').toUpperCase()
    const b = (parts[1]?.[0] || e[0] || 'D').toUpperCase()
    return `${a}${b}`
  }, [userEmail])

  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/questions', label: 'Pytania', icon: HelpCircle },
    { href: '/admin/settlements', label: 'Rozliczenia', icon: Book },
    { href: '/admin/users', label: 'Użytkownicy', icon: Users },
    { href: '/admin/logs', label: 'Logi audytowe', icon: FileClock },
    { href: '/admin/settings', label: 'Ustawienia', icon: Settings },
  ];
  
  const handleNavigate = (href: string) => {
    router.push(href as any);
  }
  
  const handleLogout = async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } finally {
      router.push(`/`);
    }
  }

  const getActiveState = (itemHref: string) => {
    if (itemHref === '/admin') {
      return pathname === itemHref;
    }
    return pathname.startsWith(itemHref);
  }

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
                <SidebarMenuButton
                  onClick={() => handleNavigate(item.href)}
                  isActive={getActiveState(item.href)}
                  tooltip={{
                    children: item.label,
                    side: 'right',
                    align: 'center',
                  }}
                >
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
              <SidebarMenuButton onClick={handleLogout} tooltip={{children: 'Wyloguj', side: 'right', align: 'center'}}>
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
                    <AvatarImage data-ai-hint="person face" src={avatarUrl} alt="Admin" />
                    <AvatarFallback>{initials}</AvatarFallback>
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
        <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
