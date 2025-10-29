"use client";

import React from 'react'

export function ClientGate() {
  const [attempted, setAttempted] = React.useState(false)

  React.useEffect(() => {
    (async () => {
      try {
        const { getSupabase } = await import('@/lib/supabaseClient')
        const s = getSupabase()
        const { data: { session } } = await s.auth.getSession()
        if (session) {
          try {
            await fetch('/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ event: 'SIGNED_IN', session }),
            })
            await new Promise(r => setTimeout(r, 30))
            window.location.replace('/app')
            return
          } catch {}
        }
      } catch {}
      setAttempted(true)
    })()
  }, [])

  React.useEffect(() => {
    if (attempted) {
      try { window.location.replace('/?auth=login') } catch {}
    }
  }, [attempted])

  return null
}

