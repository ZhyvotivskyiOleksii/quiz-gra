"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSupabase } from '@/lib/supabaseClient'

type Status = 'exchanging' | 'syncing' | 'done' | 'error'

export default function AuthCallbackPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<Status>('exchanging')
  const [error, setError] = useState<string | null>(null)

  const redirectTo = useMemo(() => {
    const from = params?.get('from')
    if (from && from.startsWith('/')) {
      return from
    }
    return '/app'
  }, [params])

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase()
        const currentUrl = new URL(window.location.href)

        const syncSessionToServer = async (accessToken: string, refreshToken: string) => {
          setStatus('syncing')
          const resp = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              event: 'SIGNED_IN',
              session: {
                access_token: accessToken,
                refresh_token: refreshToken,
              },
            }),
          })

          if (!resp.ok) {
            throw new Error('Nie udało się zsynchronizować sesji.')
          }
        }

        const clearHashFromUrl = () => {
          if (!window.location.hash) return
          const cleanUrl = `${currentUrl.pathname}${currentUrl.search}`
          window.history.replaceState(null, '', cleanUrl || '/')
        }

        if (!currentUrl.searchParams.get('code')) {
          const hashParams = window.location.hash
            ? new URLSearchParams(window.location.hash.substring(1))
            : null

          if (hashParams) {
            const hashError = hashParams.get('error')
            if (hashError) {
              throw new Error(hashParams.get('error_description') || hashError)
            }

            const accessToken = hashParams.get('access_token')
            const refreshToken = hashParams.get('refresh_token')

            if (accessToken && refreshToken) {
              const { data, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })

              if (sessionError || !data.session) {
                throw new Error(sessionError?.message || 'Nie udało się odczytać sesji.')
              }

              clearHashFromUrl()
              await syncSessionToServer(accessToken, refreshToken)
              setStatus('done')
              router.replace(redirectTo)
              return
            }
          }
        }

        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          currentUrl.toString(),
        )

        if (exchangeError || !data.session) {
          throw new Error(exchangeError?.message || 'Nie udało się odczytać sesji.')
        }

        await syncSessionToServer(data.session.access_token, data.session.refresh_token)

        setStatus('done')
        router.replace(redirectTo)
      } catch (err: any) {
        console.error('auth/callback error', err)
        setError(err?.message || 'Wystąpił nieoczekiwany błąd.')
        setStatus('error')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messageMap: Record<Status, string> = {
    exchanging: 'Kończymy logowanie...',
    syncing: 'Synchronizujemy Twoją sesję...',
    done: 'Przekierowujemy...',
    error:
      error ??
      'Nie udało się ukończyć logowania. Spróbuj ponownie lub skontaktuj się z obsługą.',
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#05010d] via-[#0b031c] to-[#12062c] px-6 text-center text-white">
      {status !== 'error' ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="auth-loader" />
          <p className="text-sm text-white/80">{messageMap[status]}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-red-300 max-w-md">{messageMap.error}</p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Wróć do logowania
          </button>
        </>
      )}
    </div>
  )
}
