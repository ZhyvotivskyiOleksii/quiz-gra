// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  // простий pass-through response (без форс-підміни headers)
  const res = NextResponse.next()

  // ВАЖЛИВО: @supabase/ssr очікує cookies з методами get/set/remove
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cookieList) => {
          cookieList.forEach(({ name, value, options }) => {
            try { res.cookies.set({ name, value, ...options }) } catch {}
          })
        },
      } as any,
    }
  )

  // торкнемося сесії — це тригерне рефреш токенів і set-cookie на res
  const { data: { session } } = await supabase.auth.getSession()
  // Тимчасова діагностика редірект-лупів (+заголовки для просмотра в Network)
  let hasUser = false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    hasUser = !!user
    console.log('[MW]', {
      path: req.nextUrl.pathname,
      hasUser,
      cookies: {
        sb: !!req.cookies.get('sb-access-token'),
        supabase: !!req.cookies.get('supabase-auth-token'),
      },
    })
  } catch {}
  try {
    res.headers.set('x-mw-path', req.nextUrl.pathname)
    res.headers.set('x-mw-user', hasUser ? '1' : '0')
    res.headers.set('x-mw-sb', req.cookies.get('sb-access-token') ? '1' : '0')
    res.headers.set('x-mw-supabase', req.cookies.get('supabase-auth-token') ? '1' : '0')
  } catch {}

  // No route protection: always pass through
  
  return res
}

export const config = {
  matcher: [],
}
