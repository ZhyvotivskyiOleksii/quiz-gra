// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Supabase SSR expects cookies with get/set/remove in middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          try { res.cookies.set({ name, value, ...options }) } catch {}
        },
        remove: (name: string, options: any) => {
          try { res.cookies.set({ name, value: '', ...options, maxAge: 0 }) } catch {}
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isProtected = /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:app|admin)(?:\/|$)/.test(path)

  if (isProtected && !session) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('auth', 'login')
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/:locale([a-z]{2}(?:-[A-Z]{2})?)/(app|admin)/:path*',
  ],
}
