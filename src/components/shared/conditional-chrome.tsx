'use client'

import { usePathname } from 'next/navigation'
import { Header } from './header'
import { Footer } from './footer'
import * as React from 'react'

// Renders site Header/Footer only for marketing pages.
// Hides them for in-app sections like /app or /admin
export function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isAppArea = React.useMemo(() => {
    if (!pathname) return false
    // direct paths
    if (pathname.startsWith('/app') || pathname.startsWith('/admin')) return true
    // i18n prefix e.g. /pl/app, /en/admin
    return /^\/[a-zA-Z]{2}(?:-[A-Z]{2})?\/(app|admin)(?:\/|$)/.test(pathname)
  }, [pathname])

  // Avoid SSR/header flicker on app/admin routes: don't render header/footer
  // until we know the real pathname on the client.
  if (!mounted || isAppArea) {
    return <>{children}</>
  }

  return (
    <>
      <Header />
      <main className="flex-grow w-full">{children}</main>
      <Footer />
    </>
  )
}
