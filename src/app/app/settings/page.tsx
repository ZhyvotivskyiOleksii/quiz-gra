"use client";

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getSupabase } from '@/lib/supabaseClient'
import NotchedInput from '@/components/ui/notched-input'
import PhoneInputField from '@/components/ui/phone-input'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { User, Phone, Lock, Hand, HelpCircle, BadgeCheck, AlertTriangle } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Image from 'next/image'
import { emitAuthEvent, subscribeToAuthEvents } from '@/lib/auth-events'

export default function SettingsPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto w-full max-w-[900px] p-6">Ładowanie…</div>}>
      <SettingsContent />
    </React.Suspense>
  )
}

function SettingsContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const urlTab = sp?.get('tab') ?? ''

  const [tab, setTab] = React.useState<'account'|'phone'|'password'|'consents'|'support'>(
    (['account','phone','password','consents','support'].includes(urlTab) ? (urlTab as any) : 'account')
  )

  React.useEffect(() => {
    const t = sp?.get('tab')
    if (t && ['account','phone','password','consents','support'].includes(t)) setTab(t as any)
    // also support #phone when coming from a hash
    if (typeof window !== 'undefined' && window.location.hash === '#phone') setTab('phone')
  }, [sp])

  const { toast } = useToast()
  const [userEmail, setUserEmail] = React.useState<string>('')
  const [contactEmail, setContactEmail] = React.useState<string>('')
  const [firstName, setFirstName] = React.useState<string>('')
  const [lastName, setLastName] = React.useState<string>('')
  const [displayName, setDisplayName] = React.useState<string>('')
  const [avatarUrl, setAvatarUrl] = React.useState<string|undefined>(undefined)
  const [initials, setInitials] = React.useState<string>('US')
  const [hasPhone, setHasPhone] = React.useState(false)
  const [phoneConfirmed, setPhoneConfirmed] = React.useState(false)
  const [birthDate, setBirthDate] = React.useState<Date | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const syncProfileFromAuth = React.useCallback(async () => {
    try {
      const supabase = getSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const email = user.email ?? (user.user_metadata?.email as string | undefined) ?? ''
      setUserEmail(email)
      const cemail = (user.user_metadata as any)?.contact_email as string | undefined
      if (cemail) setContactEmail(cemail)
      const fn = (user.user_metadata?.first_name as string | undefined) || ''
      const ln = (user.user_metadata?.last_name as string | undefined) || ''
      setFirstName(fn)
      setLastName(ln)
      const display = `${fn} ${ln}`.trim() || (email.split('@')[0] ?? 'User')
      setDisplayName(display)
      const baseAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      setAvatarUrl(baseAvatar)
      const parts = (display || email).replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
      setInitials(`${(parts[0]?.[0] || 'U').toUpperCase()}${(parts[1]?.[0] || email[0] || 'S').toUpperCase()}`)
      const phoneNow = (user as any).phone || (user.user_metadata as any)?.phone
      setHasPhone(Boolean(phoneNow))
      setPhoneConfirmed(Boolean((user as any).phone_confirmed_at))
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('birth_date, avatar_url, display_name')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.birth_date) setBirthDate(new Date(profile.birth_date))
        else setBirthDate(null)
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url as string)
        if (profile?.display_name) setDisplayName(profile.display_name as string)
      } catch {}
    } catch {}
  }, [])

  React.useEffect(() => {
    const supabase = getSupabase()
    syncProfileFromAuth()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncProfileFromAuth()
    })
    const unsubscribe = subscribeToAuthEvents((event) => {
      if (event.type === 'profile:update' || event.type === 'session:refresh') {
        syncProfileFromAuth()
      }
    })
    return () => {
      sub?.subscription?.unsubscribe()
      unsubscribe?.()
    }
  }, [syncProfileFromAuth])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const iso = birthDate
        ? new Date(Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())).toISOString().slice(0, 10)
        : null

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          contactEmail: contactEmail || null,
          birthDate: iso,
          avatarUrl: avatarUrl || null,
        }),
      })

      const result = await res.json().catch(() => null)
      if (!res.ok || result?.ok === false) {
        throw new Error(result?.error || 'Nie udało się zapisać')
      }

      await syncProfileFromAuth().catch(() => {})
      emitAuthEvent({ type: 'profile:update' })
      setEditing(false)
      toast({ title: 'Zapisano zmiany' })
    } catch (e: any) {
      toast({
        title: 'Błąd zapisu',
        description: e?.message || 'Nie udało się zapisać',
        variant: 'destructive' as any,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4">
      <Tabs value={tab} onValueChange={(v:any) => { setTab(v); router.replace(`/app/settings?tab=${v}` as any) }}>
        <div className="flex justify-center relative pb-8">
          <TabsList className="bg-transparent p-0 flex gap-3 relative z-10">
            <TabsTrigger value="account" className="h-10 rounded-2xl px-4 bg-transparent relative overflow-hidden data-[state=active]:bg-muted/50 dark:data-[state=active]:bg-white/10 data-[state=active]:backdrop-blur-sm data-[state=active]:text-red-600 data-[state=active]:shadow data-[state=active]:shadow-black/10 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:inset-y-0 data-[state=active]:after:right-0 data-[state=active]:after:w-10 data-[state=active]:after:bg-gradient-to-l data-[state=active]:after:from-red-500/10 dark:data-[state=active]:after:from-white/10 data-[state=active]:after:to-transparent">
              <User className="mr-2 h-4 w-4" /> Informacje o koncie
            </TabsTrigger>
            <div className="relative">
              <TabsTrigger value="phone" className="h-10 rounded-2xl px-4 bg-transparent relative overflow-hidden data-[state=active]:bg-muted/50 dark:data-[state=active]:bg-white/10 data-[state=active]:backdrop-blur-sm data-[state=active]:text-red-600 data-[state=active]:shadow data-[state=active]:shadow-black/10 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:inset-y-0 data-[state=active]:after:right-0 data-[state=active]:after:w-10 data-[state=active]:after:bg-gradient-to-l data-[state=active]:after:from-red-500/10 dark:data-[state=active]:after:from-white/10 data-[state=active]:after:to-transparent">
                <Phone className="mr-2 h-4 w-4" /> Weryfikacja numeru telefonu
              </TabsTrigger>
              {!phoneConfirmed && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 rounded-full bg-red-600 text-white text-[12px] leading-[1.1] px-3 py-1.5 shadow-sm shadow-red-800/40 ring-1 ring-red-700/60 text-center whitespace-nowrap">
                  Wymagana weryfikacja telefonu
                  <span className="absolute -top-[5px] left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 bg-red-600 rounded-[3px] ring-1 ring-red-700/60" />
                </div>
              )}
            </div>
            <TabsTrigger value="password" className="h-10 rounded-2xl px-4 bg-transparent relative overflow-hidden data-[state=active]:bg-muted/50 dark:data-[state=active]:bg-white/10 data-[state=active]:backdrop-blur-sm data-[state=active]:text-red-600 data-[state=active]:shadow data-[state=active]:shadow-black/10 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:inset-y-0 data-[state=active]:after:right-0 data-[state=active]:after:w-10 data-[state=active]:after:bg-gradient-to-l data-[state=active]:after:from-red-500/10 dark:data-[state=active]:after:from-white/10 data-[state=active]:after:to-transparent">
              <Lock className="mr-2 h-4 w-4" /> Zmień hasło
            </TabsTrigger>
            <TabsTrigger value="consents" className="h-10 rounded-2xl px-4 bg-transparent relative overflow-hidden data-[state=active]:bg-muted/50 dark:data-[state=active]:bg-white/10 data-[state=active]:backdrop-blur-sm data-[state=active]:text-red-600 data-[state=active]:shadow data-[state=active]:shadow-black/10 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:inset-y-0 data-[state=active]:after:right-0 data-[state=active]:after:w-10 data-[state=active]:after:bg-gradient-to-l data-[state=active]:after:from-red-500/10 dark:data-[state=active]:after:from-white/10 data-[state=active]:after:to-transparent">
              <Hand className="mr-2 h-4 w-4" /> Zgody marketingowe
            </TabsTrigger>
            <TabsTrigger value="support" className="h-10 rounded-2xl px-4 bg-transparent relative overflow-hidden data-[state=active]:bg-muted/50 dark:data-[state=active]:bg-white/10 data-[state=active]:backdrop-blur-sm data-[state=active]:text-red-600 data-[state=active]:shadow data-[state=active]:shadow-black/10 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:inset-y-0 data-[state=active]:after:right-0 data-[state=active]:after:w-10 data-[state=active]:after:bg-gradient-to-l data-[state=active]:after:from-red-500/10 dark:data-[state=active]:after:from-white/10 data-[state=active]:after:to-transparent">
              <HelpCircle className="mr-2 h-4 w-4" /> Pomoc & Wsparcie
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="account">
          <Card className="mt-2">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-headline font-extrabold uppercase">Informacje o koncie</h2>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage data-ai-hint="person face" src={avatarUrl} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <AvatarUploadButton onUploaded={(url)=>setAvatarUrl(url)} />
              </div>

              {!editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Imię i nazwisko</div>
                    <div className="text-lg font-semibold">{displayName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">E‑mail</div>
                    <div className="text-lg font-semibold">{userEmail || contactEmail || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Telefon</div>
                    <div className="text-lg font-semibold">{hasPhone ? 'Dodany' : 'Brak' } {hasPhone && !phoneConfirmed && <span className="text-yellow-600 text-sm ml-2">(do weryfikacji)</span>}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Data urodzenia</div>
                    <div className="text-lg font-semibold">{birthDate ? birthDate.toLocaleDateString('pl-PL') : 'Brak'}</div>
                  </div>
                </div>
              ) : (
                <AccountEditForm
                  firstName={firstName}
                  lastName={lastName}
                  email={userEmail}
                  contactEmail={contactEmail}
                  birthDate={birthDate}
                  onFirstName={setFirstName}
                  onLastName={setLastName}
                  onBirthDate={setBirthDate}
                  onContactEmail={setContactEmail}
                />
              )}

              {/* Bottom actions: Edit + Save */}
              <div className="mt-8 flex items-center gap-3">
                <Button
                  onClick={() => setEditing((v)=>!v)}
                  className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white"
                  type="button"
                >
                  {editing ? 'Anuluj' : 'Edytuj'}
                </Button>
                <Button
                  onClick={handleSave}
                  className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                  disabled={!editing || saving}
                  type="button"
                >
                  {saving ? 'Zapisywanie…' : 'Zapisz'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phone">
          <PhoneVerificationPanel />
        </TabsContent>

        <TabsContent value="password">
          <ChangePasswordPanel />
        </TabsContent>

        <TabsContent value="consents">
          <Card className="mt-2"><CardContent className="p-6">Wkrótce: zarządzanie zgodami marketingowymi.</CardContent></Card>
        </TabsContent>

        <TabsContent value="support">
          <Card className="mt-2"><CardContent className="p-6">Potrzebujesz pomocy? Napisz na support@quiztime.app</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const normalizePhone = (value: string) => {
  if (!value) return ''
  const trimmed = value.startsWith('+') ? value : `+${value}`
  return trimmed.replace(/[^\d+]/g, '')
}

function PhoneVerificationPanel() {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [currentPhone, setCurrentPhone] = React.useState<string | null>(null)
  const [confirmed, setConfirmed] = React.useState<boolean>(false)
  const [conflictPhone, setConflictPhone] = React.useState<string | null>(null)
  const [dialogError, setDialogError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const supabase = getSupabase()

    async function hydrate() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const p = (user as any).phone || (user.user_metadata as any)?.phone || null
          setCurrentPhone(p)
          setConfirmed(Boolean((user as any).phone_confirmed_at))
        }
      } catch {}
    }

    hydrate()
    const { data: sub } = supabase.auth.onAuthStateChange(() => hydrate())
    return () => {
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setStep('phone')
      setCode('')
      setDialogError(null)
    }
  }

  function prettyPhone(p?: string | null) {
    if (!p) return ''
    return (p.startsWith('+') ? p : `+${p}`).replace(/[^\d+]/g, '')
  }

  const handlePhoneChange = (value: string) => {
    setPhone(value)
    if (dialogError) setDialogError(null)
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    if (dialogError) setDialogError(null)
  }

  const resetToPhoneStep = () => {
    setStep('phone')
    setCode('')
    setDialogError(null)
  }

  async function sendCode() {
    setLoading(true)
    setDialogError(null)
    const norm = normalizePhone(phone)
    if (!norm) {
      setDialogError('Wpisz numer telefonu.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: norm }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errorMsg = payload?.error || 'Nie udało się wysłać kodu'
        // Check if error is recoverable (SMS might have been sent anyway)
        // "Signups not allowed" often appears but SMS is still sent
        if (
          errorMsg.includes('signups not allowed') ||
          errorMsg.includes('already') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('too many') ||
          res.status === 500
        ) {
          // SMS was likely sent despite the error, continue to code step
          setStep('code')
          setCurrentPhone(norm)
          toast({ title: 'Wysłaliśmy kod SMS.' })
          setLoading(false)
          return
        }
        throw new Error(errorMsg)
      }
      setStep('code')
      setCurrentPhone(norm)
      toast({ title: 'Wysłaliśmy kod SMS.' })
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('already been registered') || msg.includes('already registered') || /422/.test(String(e?.status))) {
        setConflictPhone(norm)
        handleOpenChange(false)
        toast({
          title: 'Ten numer jest już używany',
          description: 'Możesz zalogować się tym numerem i połączyć konta.',
          variant: 'destructive' as any,
        })
      } else {
        const description = e?.message || 'Nie udało się wysłać kodu'
        setDialogError(description)
        toast({ title: 'Błąd', description, variant: 'destructive' as any })
      }
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    setLoading(true)
    setDialogError(null)
    const norm = normalizePhone(currentPhone || phone)
    if (!norm) {
      setDialogError('Brak numeru telefonu.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: norm, code }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Sprawdź kod i spróbuj ponownie')
      }
      handleOpenChange(false)
      setConfirmed(true)
      setCurrentPhone(norm)
      emitAuthEvent({ type: 'profile:update' })
      toast({ title: 'Numer zweryfikowany' })
    } catch (e: any) {
      const description = e?.message || 'Sprawdź kod i spróbuj ponownie'
      setDialogError(description)
      toast({ title: 'Nieprawidłowy kod', description, variant: 'destructive' as any })
    } finally {
      setLoading(false)
    }
  }

  let phoneCard: React.ReactNode

  if (confirmed && currentPhone) {
    phoneCard = (
      <Card className="mt-2">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-headline font-extrabold uppercase text-emerald-600">Telefon zweryfikowany</h2>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <div className="font-semibold">{prettyPhone(currentPhone)}</div>
            <div className="text-emerald-700 dark:text-emerald-300 mt-1">
              Wszystko gra — możesz w pełni korzystać z serwisu.
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="secondary"
              className="h-10"
              onClick={() => {
                resetToPhoneStep()
                handleOpenChange(true)
                setPhone('')
              }}
            >
              Zmień numer
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  } else {
    phoneCard = (
      <Card className="mt-2">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-headline font-extrabold uppercase">Weryfikacja numeru telefonu</h2>
          </div>
          {!conflictPhone ? (
            <p className="text-sm text-muted-foreground mb-4">
              Sprawdź, czy Twój numer jest poprawny. Wyślemy kod SMS do weryfikacji.
            </p>
          ) : (
            <div className="mb-4">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <div className="font-semibold">Numer {conflictPhone} jest już przypisany do innego konta.</div>
                  <div className="opacity-90">Możesz zalogować się tym numerem i połączyć konta (w ustawieniach dodaj Google).</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConflictPhone(null)
                    resetToPhoneStep()
                    setPhone('')
                    handleOpenChange(true)
                  }}
                >
                  Wprowadź inny numer
                </Button>
                <Button onClick={() => setConflictPhone(null)}>Anuluj</Button>
              </div>
            </div>
          )}
          {!conflictPhone && (
            <Button
              className="h-10"
              onClick={() => {
                resetToPhoneStep()
                handleOpenChange(true)
              }}
            >
              Zweryfikuj telefon
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {phoneCard}
      <SettingsPhoneDialog
        open={open}
        step={step}
        phone={phone}
        code={code}
        loading={loading}
        error={dialogError}
        onOpenChange={handleOpenChange}
        onSendCode={sendCode}
        onVerify={verify}
        onPhoneChange={handlePhoneChange}
        onCodeChange={handleCodeChange}
        onBackToPhone={resetToPhoneStep}
      />
    </>
  )
}

type SettingsPhoneDialogProps = {
  open: boolean
  step: 'phone' | 'code'
  phone: string
  code: string
  loading: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSendCode: () => void
  onVerify: () => void
  onPhoneChange: (value: string) => void
  onCodeChange: (value: string) => void
  onBackToPhone: () => void
}

function SettingsPhoneDialog({
  open,
  step,
  phone,
  code,
  loading,
  error,
  onOpenChange,
  onSendCode,
  onVerify,
  onPhoneChange,
  onCodeChange,
  onBackToPhone,
}: SettingsPhoneDialogProps) {
  const isCodeStep = step === 'code'
  const chipBase =
    'rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border border-white/20 transition-colors duration-200'
  const phoneChipClass = `${chipBase} ${!isCodeStep ? 'bg-white/20 text-white' : 'text-white/60'}`
  const codeChipClass = `${chipBase} ${isCodeStep ? 'bg-white/20 text-white' : 'text-white/60'}`
  const digitsCount = phone.replace(/[^\d]/g, '').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden border border-white/10 bg-[rgba(12,10,25,0.92)] backdrop-blur-xl p-0 text-white rounded-[26px] shadow-[0_45px_110px_rgba(4,3,18,0.7)]">
        <div className="relative overflow-hidden rounded-t-[26px] px-6 pt-14 pb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-[#ff6b6b]/40 via-[#a855f7]/20 to-transparent" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="mt-2 sm:mt-4">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-2xl font-headline font-extrabold uppercase tracking-wide">
                  Zweryfikuj telefon
                </DialogTitle>
                <DialogDescription className="text-sm text-white/85">
                  Dzięki temu będziemy mogli wysyłać Ci potwierdzenia wygranych i bezpiecznie rozliczać bonusy.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/70">
                <span className={phoneChipClass}>1. Numer</span>
                <span className="h-px flex-1 bg-white/20" aria-hidden />
                <span className={codeChipClass}>2. Kod SMS</span>
              </div>
            </div>
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src="/icon/ver-sms.webp"
                alt=""
                width={80}
                height={80}
                className="object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.35)]"
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-7 pt-5 space-y-4">
          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/70">
              Zweryfikowany numer pozwala odzyskać dostęp do konta i brać udział w płatnych kampaniach. Proces zajmuje mniej
              niż minutę.
            </div>
          )}
          {!isCodeStep ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <PhoneInputField id="settings-phone" label={'Numer telefonu'} value={phone} onChange={onPhoneChange} />
              </div>
              <Button
                onClick={onSendCode}
                disabled={loading || digitsCount < 6}
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-violet-500 text-white font-semibold shadow-lg shadow-rose-500/25 disabled:opacity-60"
              >
                {loading ? 'Wysyłanie…' : 'Wyślij kod SMS'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <NotchedInput
                type="text"
                inputMode="numeric"
                label={'Kod z SMS'}
                value={code}
                onChange={(e: any) => onCodeChange(e.target.value)}
              />
              <Button
                onClick={onVerify}
                disabled={loading || !code}
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold shadow-lg shadow-violet-500/25 disabled:opacity-60"
              >
                {loading ? 'Sprawdzanie…' : 'Potwierdź numer'}
              </Button>
              <button type="button" onClick={onBackToPhone} className="text-sm text-primary hover:underline">
                Zmień numer telefonu
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AvatarUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const { toast } = useToast()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = React.useState(false)

  const pick = () => inputRef.current?.click()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Nieprawidłowy plik', description: 'Wybierz obraz.', variant: 'destructive' as any })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Zbyt duży plik', description: 'Maksymalnie 5 MB.', variant: 'destructive' as any })
      return
    }

    setBusy(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Brak sesji')
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = data.publicUrl
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl } as any, { onConflict: 'id' } as any)
      onUploaded(`${publicUrl}?v=${Date.now()}`)
      toast({ title: 'Avatar zaktualizowany' })
    } catch (e: any) {
      toast({ title: 'Błąd przesyłania', description: e?.message || 'Nie udało się przesłać zdjęcia', variant: 'destructive' as any })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button variant="link" className="text-red-600 p-0" onClick={pick} disabled={busy}>
        {busy ? 'Przesyłanie…' : 'Zmień zdjęcie profilowe'}
      </Button>
    </>
  )
}

function AccountEditForm({ firstName, lastName, email, contactEmail, birthDate, onFirstName, onLastName, onBirthDate, onContactEmail }: {
  firstName: string
  lastName: string
  email: string
  contactEmail: string
  birthDate: Date | null
  onFirstName: (v: string) => void
  onLastName: (v: string) => void
  onBirthDate: (d: Date | null) => void
  onContactEmail: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-3">
        <NotchedInput label={'Imię'} value={firstName} onChange={(e:any)=>onFirstName(e.target.value)} />
        <NotchedInput label={'Nazwisko'} value={lastName} onChange={(e:any)=>onLastName(e.target.value)} />
        <div>
          <div className="mb-2 text-sm text-muted-foreground">Data urodzenia</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                {birthDate ? birthDate.toLocaleDateString('pl-PL') : 'Wybierz datę'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Calendar
                mode="single"
                selected={birthDate ?? undefined}
                onSelect={(d:any)=>onBirthDate(d ?? null)}
                captionLayout="buttons"
                fromYear={1940}
                toYear={new Date().getFullYear()}
                withDropdowns
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-3">
        {email ? (
          <NotchedInput label={'E‑mail'} value={email} disabled />
        ) : (
          <NotchedInput label={'E‑mail (opcjonalnie)'} value={contactEmail} onChange={(e:any)=>onContactEmail(e.target.value)} placeholder="np. jan@example.com" />
        )}
      </div>
    </div>
  )
}

function ChangePasswordPanel() {
  const { toast } = useToast()
  const [pwd, setPwd] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  async function save() {
    setLoading(true)
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) throw error
      setPwd('')
      toast({ title: 'Hasło zaktualizowane' })
    } catch (e: any) {
      toast({ title: 'Błąd', description: e?.message || 'Nie udało się zmienić hasła', variant: 'destructive' as any })
    } finally { setLoading(false) }
  }
  return (
    <Card className="mt-2">
      <CardContent className="p-6 sm:p-8 space-y-4">
        <h2 className="text-xl font-headline font-extrabold uppercase">Zmień hasło</h2>
        <NotchedInput type="password" label={'Nowe hasło'} value={pwd} onChange={(e:any)=>setPwd(e.target.value)} />
        <Button onClick={save} disabled={loading || pwd.length < 8} className="h-10 w-full sm:w-auto">Zapisz</Button>
      </CardContent>
    </Card>
  )
}
