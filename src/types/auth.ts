export type InitialAuthState = {
  email?: string
  avatarUrl?: string
  displayName?: string
  shortId?: string | null
  isAdmin?: boolean
  needsPhone?: boolean
  walletBalance?: number | null
  hasSession?: boolean
}
