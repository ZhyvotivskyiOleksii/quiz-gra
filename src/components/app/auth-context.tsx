"use client"

import * as React from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { InitialAuthState } from "@/types/auth"
import { getSupabase } from "@/lib/supabaseClient"
import { emitAuthEvent, subscribeToAuthEvents } from "@/lib/auth-events"
import { performClientLogout } from "@/lib/logout-client"

const debugAuth = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1"

const authLog = (...args: any[]) => {
  if (debugAuth) {
    // eslint-disable-next-line no-console
    console.log("[auth]", ...args)
  }
}

type AuthStatus = "loading" | "ready" | "anonymous" | "error"

type AuthState = {
  email?: string
  avatarUrl?: string
  displayName?: string
  shortId?: string
  isAdmin: boolean
  needsPhone: boolean
  walletBalance: number | null
  hasSession: boolean
}

type AuthContextValue = AuthState & {
  status: AuthStatus
  initialized: boolean
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

const emptyState: AuthState = {
  email: undefined,
  avatarUrl: undefined,
  displayName: undefined,
  shortId: undefined,
  isAdmin: false,
  needsPhone: false,
  walletBalance: null,
  hasSession: false,
}

export function AuthProvider({
  initialAuth,
  children,
}: {
  initialAuth: InitialAuthState
  children: React.ReactNode
}) {
  const [state, setState] = React.useState<AuthState>(() => ({
    email: initialAuth.email,
    avatarUrl: initialAuth.avatarUrl,
    displayName: initialAuth.displayName,
    shortId: initialAuth.shortId ?? undefined,
    isAdmin: Boolean(initialAuth.isAdmin),
    needsPhone: Boolean(initialAuth.needsPhone),
    walletBalance:
      typeof initialAuth.walletBalance === "number"
        ? initialAuth.walletBalance
        : null,
    hasSession: Boolean(initialAuth.hasSession),
  }))

  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState<AuthStatus>("loading")
  const [initialized, setInitialized] = React.useState<boolean>(false)

  const supabaseRef = React.useRef<SupabaseClient | null>(null)
  const mountedRef = React.useRef(true)
  const refreshPromiseRef = React.useRef<Promise<void> | null>(null)
  const stateRef = React.useRef<AuthState>(state)

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const buildAuthState = React.useCallback(
    async (
      preloadedUser?: import("@supabase/supabase-js").User,
    ): Promise<AuthState> => {
      const supabase = supabaseRef.current
      if (!supabase) {
        authLog("buildAuthState error: supabase client not initialized")
        throw new Error("Supabase client is not available.")
      }
      authLog("build:start")

      try {
        const user =
          preloadedUser ?? (await supabase.auth.getUser())?.data?.user ?? null

        authLog("build:user object", {
          hasUser: Boolean(user),
          source: preloadedUser ? "preloaded" : "getUser",
        })

        if (!user) {
          authLog("buildAuthState: no user, setting empty state")
          return { ...emptyState }
        }

        authLog("buildAuthState: user", { id: user.id })


        let profileRes
        try {
          authLog("profile:fetch start")
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10-second timeout

          const { data, error } = await supabase
            .from("profiles")
            .select(
              "display_name, avatar_url, is_admin, phone, phone_confirmed_at, short_id",
            )
            .eq("id", user.id)
            .abortSignal(controller.signal)
            .maybeSingle();
          
          clearTimeout(timeoutId)

          if (error) {
            throw error;
          }

          authLog("profile:fetch ok", data);
          profileRes = data ?? null;
        } catch (err: any) {
          authLog("profile:fetch error", err?.message || err)
          profileRes = null
        }

        const balanceRes = { data: 0 }

        let shortIdRes
        try {
          authLog("shortId:fetch start")
          const res = await supabase.rpc("get_or_create_short_id")
          authLog("shortId:fetch ok", res?.data)
          shortIdRes = res
        } catch (err: any) {
          authLog("shortId:fetch error", err?.message || err)
          shortIdRes = { data: null }
        }


        const profile = profileRes ?? null
        authLog("profile loaded", profile)

        const emailFromUser =
          user.email ??
          (user.user_metadata?.email as string | undefined) ??
          ((user.user_metadata as any)?.contact_email as string | undefined)

        const metaFirst =
          (user.user_metadata?.first_name as string | undefined) || ""
        const metaLast =
          (user.user_metadata?.last_name as string | undefined) || ""
        const metadataName = `${metaFirst} ${metaLast}`.trim()

        const avatarUrl =
          profile?.avatar_url ||
          (user.user_metadata?.avatar_url as string | undefined) ||
          (user.user_metadata?.picture as string | undefined)

        const displayName =
          profile?.display_name ||
          metadataName ||
          emailFromUser?.split("@")[0] ||
          undefined

        let shortId = profile?.short_id ? String(profile.short_id) : undefined
        if (!shortId && shortIdRes?.data) {
          shortId = String(shortIdRes.data)
        }

        let walletBalance: number | null = null
        const balanceRaw = balanceRes?.data
        if (typeof balanceRaw === "number") {
          walletBalance = balanceRaw
        } else if (balanceRaw !== null && balanceRaw !== undefined) {
          const parsed = Number(balanceRaw)
          walletBalance = Number.isFinite(parsed) ? parsed : 0
        } else {
          walletBalance = 0
        }

        // ---- телефон ----
        const phoneConfirmedProfile = Boolean(profile?.phone_confirmed_at)
        const phoneConfirmedAuth =
          Boolean((user as any).phone_confirmed_at) ||
          Boolean((user.user_metadata as any)?.phone_confirmed_at)

        const phoneConfirmed = phoneConfirmedProfile || phoneConfirmedAuth
        const needsPhone = !phoneConfirmed

        authLog("needsPhone computed", {
          needsPhone,
          phoneConfirmedProfile,
          phoneConfirmedAuth,
          phoneConfirmed,
        })

        // ---- админство ----
        const envAdmins =
          process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean) || []

        const mail = (emailFromUser || "").toLowerCase()
        const isEnvAdmin = mail && envAdmins.includes(mail)

        const roleArray = Array.isArray((user.app_metadata as any)?.roles)
          ? ((user.app_metadata as any).roles as string[]).map((r) =>
              r.toLowerCase(),
            )
          : []

        const isAdmin =
          Boolean(profile?.is_admin) ||
          Boolean(user.app_metadata?.is_admin) ||
          Boolean(user.user_metadata?.is_admin) ||
          isEnvAdmin ||
          roleArray.includes("admin")

        return {
          email: emailFromUser || undefined,
          avatarUrl,
          displayName,
          shortId,
          isAdmin,
          needsPhone,
          walletBalance,
          hasSession: true,
        }
      } catch (err: any) {
        authLog("buildAuthState exception", err?.message || err)
        return { ...emptyState }
      }
    },
    [],
  )

  const refresh = React.useCallback(
    async (opts?: {
      soft?: boolean
      user?: import("@supabase/supabase-js").User | null
    }) => {      
      // Простая и надежная блокировка: если refresh уже запущен, выходим.
      if (refreshPromiseRef.current) {
        authLog("refresh: already in progress, skipping")
        return
      }

      const promise = (async () => {
        try {
          const soft = Boolean(opts?.soft)
          authLog("refresh:start", soft ? "soft" : "hard")

          if (!soft) {
            setLoading(true)
            setStatus("loading")
          }

          const next = await buildAuthState(opts?.user ?? undefined)
          if (mountedRef.current) {
            setState(next)
            setStatus(next.hasSession ? "ready" : "anonymous")
            setInitialized(true)
            authLog("refresh:state", next)
          }
        } catch (err: any) {
          authLog("refresh:error", err?.message || err)
        } finally {
          if (mountedRef.current) {
            setLoading(false)
            refreshPromiseRef.current = null
          }
          authLog("refresh:end")
        }
      })()

      refreshPromiseRef.current = promise
    },
    [buildAuthState],
  )

  React.useEffect(() => {
    // Создаем клиент Supabase только один раз на клиенте.
    // Это ключевое изменение для стабильности в Next.js.
    if (!supabaseRef.current) {
      supabaseRef.current = getSupabase()
    }
    const supabase = supabaseRef.current

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (evt, sess) => {
        authLog("onAuthStateChange", evt, Boolean(sess))

        // Если refresh уже выполняется, игнорируем дублирующие события,
        // которые часто приходят при загрузке страницы (SIGNED_IN, INITIAL_SESSION).
        if (refreshPromiseRef.current) {
          authLog("onAuthStateChange: refresh in progress, skipping event", evt)
          return
        }

        // Now that any previous refresh is complete, handle the current event.
        switch (evt) { // NOSONAR
          case "INITIAL_SESSION":
          case "SIGNED_IN": {
            await refresh({
              user: sess?.user ?? null,
            })
            break
          }
          case "TOKEN_REFRESHED":
          case "USER_UPDATED": {
            await refresh({ soft: true, user: sess?.user ?? null })
            break
          }
          case "SIGNED_OUT":
            if (mountedRef.current) {
              setState({ ...emptyState })
              setStatus("anonymous")
              setInitialized(true)
              setLoading(false)
            }
            break;
          default:
            break
        }
      },
    )

    const unsubscribe = subscribeToAuthEvents((event) => {
      authLog("auth-event", event)

      if (event.type === "profile:update" || event.type === "session:refresh") {
        refresh({ soft: true })
      }
      if (event.type === "session:logout") {
        if (mountedRef.current) {
          setState({ ...emptyState })
          setStatus("anonymous")
          setInitialized(true)
          setLoading(false)
        }
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
      unsubscribe?.()
    }
  }, [buildAuthState]) // Убрали refresh из зависимостей

  const logout = React.useCallback(async () => {
    emitAuthEvent({ type: "session:logout" })
    authLog("logout:start")
    try {
      await performClientLogout()
    } finally {
      if (mountedRef.current) {
        setState({ ...emptyState })
        setStatus("anonymous")
        setInitialized(true)
        setLoading(false)
      }
      authLog("logout:end")
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      status,
      initialized,
      loading,
      refresh: () => refresh(),
      logout,
    }),
    [state, status, initialized, loading, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}

export function useAuthOptional() {
  return React.useContext(AuthContext)
}
