'use client'

const AUTH_EVENT_NAME = 'quiztime:auth-sync'

export type AuthSyncEvent =
  | { type: 'profile:update' }
  | { type: 'session:refresh' }
  | { type: 'session:logout' }

export function emitAuthEvent(event: AuthSyncEvent) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AuthSyncEvent>(AUTH_EVENT_NAME, { detail: event }))
}

export function subscribeToAuthEvents(callback: (event: AuthSyncEvent) => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const custom = event as CustomEvent<AuthSyncEvent>
    if (custom.detail) {
      callback(custom.detail)
    }
  }
  window.addEventListener(AUTH_EVENT_NAME, handler as EventListener)
  return () => window.removeEventListener(AUTH_EVENT_NAME, handler as EventListener)
}
