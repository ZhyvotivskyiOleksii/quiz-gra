// middleware.ts
// Centralized authentication logic - this is the single source of truth
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type PendingCookie = { name: string; value: string; options?: any }

export async function middleware(req: NextRequest) {
  const baseResponse = NextResponse.next({ request: { headers: req.headers } })
  const pendingCookies: PendingCookie[] = []

  const persistCookie = (name: string, value: string, options?: any) => {
    pendingCookies.push({ name, value, options })
    try {
      baseResponse.cookies.set({ name, value, ...(options ?? {}) })
    } catch {}
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => persistCookie(name, value, options),
        remove: (name: string, options: any) => persistCookie(name, '', { ...(options ?? {}), maxAge: 0 }),
        getAll: () =>
          req.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          })),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: any }>) => {
          cookiesToSet.forEach(({ name, value, options }) => persistCookie(name, value, options))
        },
      },
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isProtected = /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:app|admin)(?:\/|$)/.test(path)
  const isAdminRoute = /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?admin(?:\/|$)/.test(path)
  const isLoginPage = path === '/login' || path.startsWith('/login/')
  const isRegisterPage = path === '/register' || path.startsWith('/register/')
  const isAuthCallback = path.startsWith('/auth/callback')

  const applyCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      try {
        response.cookies.set({ name, value, ...(options ?? {}) })
      } catch {}
    })
    return response
  }

  const redirectWithCookies = (pathname: string) => {
    const url = req.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    return applyCookies(NextResponse.redirect(url))
  }

  if (isAuthCallback) {
    return applyCookies(baseResponse)
  }

  if (!session && isProtected) {
    return redirectWithCookies('/login')
  }

  if (session && (isLoginPage || isRegisterPage)) {
    return redirectWithCookies('/app')
  }

  if (session && isAdminRoute) {
    const user = session.user
    const envAdmins =
      process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? []
    const emailLower = (user.email || (user.user_metadata?.email as string | undefined) || '').toLowerCase()
    const roles = Array.isArray((user.app_metadata as any)?.roles)
      ? ((user.app_metadata as any).roles as string[]).map((role) => role.toLowerCase())
      : []

    let isAdmin =
      Boolean(user.app_metadata?.is_admin) ||
      Boolean(user.user_metadata?.is_admin) ||
      envAdmins.includes(emailLower) ||
      (user.app_metadata?.role as string | undefined)?.toLowerCase() === 'admin' ||
      roles.includes('admin')

    if (!isAdmin) {
      try {
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
        isAdmin = Boolean(profile?.is_admin)
      } catch {
        // ignore and fallback to existing isAdmin flag
      }
    }

    if (!isAdmin) {
      return redirectWithCookies('/app')
    }
  }

  return applyCookies(baseResponse)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
