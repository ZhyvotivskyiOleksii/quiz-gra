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
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options?: Parameters<NextResponse['cookies']['set']>[2]) => {
          // прокидаємо set-cookie в відповідь
          res.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options?: Parameters<NextResponse['cookies']['set']>[2]) => {
          res.cookies.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )

  // торкнемося сесії — це тригерне рефреш токенів і set-cookie на res
  const { data: { session } } = await supabase.auth.getSession()
  // Тимчасова діагностика редірект-лупів
  try {
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[MW]', {
      path: req.nextUrl.pathname,
      hasUser: !!user,
      cookies: {
        sb: !!req.cookies.get('sb-access-token'),
        supabase: !!req.cookies.get('supabase-auth-token'),
      },
    })
  } catch {}

  // Do not redirect here. Let server pages handle auth guards to avoid loops.

  return res
}

// обмежуємо дію тільки потрібними шляхами (щоб не було зайвих викликів)
export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/:locale([a-zA-Z]{2}(?:-[A-Z]{2})?)/(app|admin)/:path*',
  ],
}
