import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

type CookieValue = { name: string; value: string }

export type SupabaseCookieAdapter = {
  get: (name: string) => string | undefined
  getAll?: () => CookieValue[]
  set?: (name: string, value: string, options?: any) => void
  remove?: (name: string, options?: any) => void
  setAll?: (cookies: Array<{ name: string; value: string; options?: any }>) => void
}

const getEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Missing Supabase environment variables')
  }
  return { url, anon }
}

const adaptCookieStore = (store: any): SupabaseCookieAdapter => {
  const hasMutableApi = typeof store?.set === 'function'

  const set = (name: string, value: string, options?: any) => {
    if (!hasMutableApi) return
    try {
      store.set({ name, value, ...(options ?? {}) })
    } catch {
      // ignore
    }
  }

  return {
    get: (name: string) => store?.get?.(name)?.value,
    getAll: () => {
      const entries =
        typeof store?.getAll === 'function' ? store.getAll() : []
      return (entries as Array<{ name: string; value: string }>).map((c) => ({
        name: c.name,
        value: c.value,
      }))
    },
    set,
    remove: (name: string, options?: any) => {
      if (!hasMutableApi) return
      set(name, '', { ...(options ?? {}), maxAge: 0 })
    },
    setAll: (cookiesToSet: Array<{ name: string; value: string; options?: any }>) => {
      if (!hasMutableApi || !Array.isArray(cookiesToSet)) return
      cookiesToSet.forEach(({ name, value, options }) => set(name, value, options))
    },
  }
}

export async function createServerSupabaseClient(adapter?: SupabaseCookieAdapter) {
  const { url, anon } = getEnv()
  const cookieAdapter = adapter ?? adaptCookieStore(await cookies())
  return createServerClient(url, anon, {
    cookies: cookieAdapter as any,
  })
}
