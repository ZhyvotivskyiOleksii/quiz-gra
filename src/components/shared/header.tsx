'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Logo } from '@/components/shared/logo'
import {
  User,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Shield,
  LogOut as LogOutIcon,
  CircleDollarSign,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { performClientLogout } from '@/lib/logout-client'

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
  const router = useRouter()
  const pathname = usePathname()
  const email = initialAuth?.email
  const avatarUrl = initialAuth?.avatarUrl
  const displayName = initialAuth?.displayName ?? (email ? email.split('@')[0] : undefined)
  const shortId = initialAuth?.shortId ? String(initialAuth.shortId) : undefined
  const walletBalance =
    typeof initialAuth?.walletBalance === 'number' ? initialAuth.walletBalance : null
  const isAdmin = Boolean(initialAuth?.isAdmin)
  const hasSession = Boolean(initialAuth?.hasSession ?? initialAuth?.email)

  const formattedBalance = React.useMemo(() => {
    if (walletBalance === null || walletBalance === undefined) return null
    return `${walletBalance.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`
  }, [walletBalance])

  const initials = React.useMemo(() => {
    const base = (displayName || email || '').trim()
    if (!base) return 'US'
    const parts = base.split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }, [displayName, email])

  const handleLogout = React.useCallback(async () => {
    try {
      await performClientLogout()
    } finally {
      router.replace('/')
    }
  }, [router])

  const goTo = React.useCallback(
    (target: string) => {
      if (pathname === target) return
      router.push(target)
    },
    [router, pathname],
  )

  const logoHref = React.useMemo(() => {
    if (pathname?.startsWith('/admin')) return '/admin'
    if (pathname?.startsWith('/app')) return '/app'
    return '/'
  }, [pathname])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-transparent backdrop-blur-md">
        <div className="relative w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between">
            <Logo href={logoHref} />
            <div className="flex items-center gap-3">
              {hasSession ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-3 rounded-full bg-transparent px-2 text-white hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage data-ai-hint="person face" src={avatarUrl} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="hidden text-left text-sm sm:flex sm:flex-col">
                        <span className="font-semibold leading-tight text-white">
                          {displayName}
                        </span>
                        {shortId && (
                          <span className="text-xs text-white/70">ID: {shortId}</span>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 rounded-2xl border border-border/40 bg-card/95 p-1.5 backdrop-blur-sm"
                  >
                    <DropdownMenuLabel className="px-3 py-3 text-center">
                      <div className="truncate text-sm font-semibold text-white">
                        {displayName || 'Moje konto'}
                      </div>
                      {email && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {email}
                        </div>
                      )}
                      {shortId && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          ID: {shortId}
                        </div>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                        <CircleDollarSign className="h-3 w-3" />
                        <span>Saldo: {formattedBalance ?? '0,00 zł'}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="group flex items-center gap-2 rounded-md px-3 py-2 text-foreground/90 transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      onClick={() => goTo('/app/settings?tab=account')}
                    >
                      <SettingsIcon className="h-4 w-4 text-muted-foreground transition-colors group-data-[highlighted]:text-white" />
                      <span>Ustawienia</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="group flex items-center gap-2 rounded-md px-3 py-2 text-foreground/90 transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      onClick={() => goTo('/app/history')}
                    >
                      <HistoryIcon className="h-4 w-4 text-muted-foreground transition-colors group-data-[highlighted]:text-white" />
                      <span>Historia</span>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        className="group flex items-center gap-2 rounded-md px-3 py-2 text-foreground/90 transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                        onClick={() => goTo('/admin')}
                      >
                        <Shield className="h-4 w-4 text-muted-foreground transition-colors group-data-[highlighted]:text-white" />
                        <span>Admin panel</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="group flex items-center gap-2 rounded-md px-3 py-2 text-red-500 transition-colors data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-500"
                      onClick={handleLogout}
                    >
                      <LogOutIcon className="h-4 w-4" />
                      <span>Wyloguj</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => router.push('/login')}
                >
                  <User className="h-4 w-4" />
                  Zaloguj się
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      <div aria-hidden className="h-16 w-full" />
    </>
  )
}
