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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { User, Phone, Lock, Hand, HelpCircle } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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

  React.useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const email = user.email ?? (user.user_metadata?.email as string | undefined) ?? ''
          setUserEmail(email)
          const fn = (user.user_metadata?.first_name as string | undefined) || ''
          const ln = (user.user_metadata?.last_name as string | undefined) || ''
          setFirstName(fn); setLastName(ln)
          const name = `${fn} ${ln}`.trim() || (email.split('@')[0] ?? 'User')
          setDisplayName(name)
          setAvatarUrl((user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined)
          const parts = (name || email).replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
          setInitials(`${(parts[0]?.[0]||'U').toUpperCase()}${(parts[1]?.[0]||email[0]||'S').toUpperCase()}`)
          const phoneNow = (user as any).phone || (user.user_metadata as any)?.phone
          setHasPhone(!!phoneNow)
          setPhoneConfirmed(Boolean((user as any).phone_confirmed_at))
          try {
            // Try read birth_date from profiles
            const { data: profile } = await supabase.from('profiles').select('birth_date, avatar_url, display_name').eq('id', user.id).maybeSingle()
            if (profile?.birth_date) setBirthDate(new Date(profile.birth_date))
            if (profile?.avatar_url && !avatarUrl) setAvatarUrl(profile.avatar_url as string)
            if (profile?.display_name && !name) setDisplayName(profile.display_name as string)
          } catch {}
        }
      } catch {}
    })()
  }, [])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Brak sesji')
      await supabase.auth.updateUser({ data: { first_name: firstName, last_name: lastName, avatar_url: avatarUrl || null } })
      const iso = birthDate ? new Date(Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())).toISOString().slice(0,10) : null
      await supabase.from('profiles').upsert({ id: user.id, display_name: `${firstName} ${lastName}`.trim() || null, birth_date: iso, avatar_url: avatarUrl || null } as any, { onConflict: 'id' } as any)
      setEditing(false)
      toast({ title: 'Zapisano zmiany' })
    } catch (e: any) {
      toast({ title: 'Błąd zapisu', description: e?.message || 'Nie udało się zapisać', variant: 'destructive' as any })
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
                    <div className="text-lg font-semibold">{userEmail || '—'}</div>
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
                  birthDate={birthDate}
                  onFirstName={setFirstName}
                  onLastName={setLastName}
                  onBirthDate={setBirthDate}
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

function PhoneVerificationPanel() {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<'phone'|'code'>('phone')
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function sendCode() {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.updateUser({ phone: phone.startsWith('+') ? phone : `+${phone}` })
      if (error) throw error
      setStep('code')
      toast({ title: 'Wysłaliśmy kod SMS.' })
    } catch (e: any) {
      toast({ title: 'Błąd', description: e?.message || 'Nie udało się wysłać kodu', variant: 'destructive' as any })
    } finally { setLoading(false) }
  }

  async function verify() {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.verifyOtp({ phone: phone.startsWith('+') ? phone : `+${phone}` , token: code, type: 'phone_change' as any })
      if (error) throw error
      setOpen(false)
      toast({ title: 'Numer zweryfikowany' })
    } catch (e: any) {
      toast({ title: 'Nieprawidłowy kod', description: e?.message || 'Sprawdź kod i spróbuj ponownie', variant: 'destructive' as any })
    } finally { setLoading(false) }
  }

  return (
    <Card className="mt-2">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-headline font-extrabold uppercase">Weryfikacja numeru telefonu</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Sprawdź, czy Twój numer jest poprawny. Wyślemy kod SMS do weryfikacji.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10">Zweryfikuj telefon</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-extrabold uppercase">Weryfikacja numeru telefonu</DialogTitle>
              <DialogDescription>Wpisz numer telefonu, a następnie kod, który wyślemy SMS‑em.</DialogDescription>
            </DialogHeader>
            {step === 'phone' ? (
              <div className="space-y-4">
                <PhoneInputField id="settings-phone" label={'Numer telefonu'} value={phone} onChange={setPhone} />
                <Button onClick={sendCode} disabled={loading || phone.length < 6} className="w-full h-10">
                  {loading ? 'Wysyłanie…' : 'Wyślij kod'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <NotchedInput type="text" inputMode="numeric" label={'Kod z SMS'} value={code} onChange={(e:any)=>setCode(e.target.value)} />
                <Button onClick={verify} disabled={loading || code.length === 0} className="w-full h-10">
                  {loading ? 'Sprawdzanie…' : 'Potwierdź'}
                </Button>
                <button type="button" onClick={()=>setStep('phone')} className="text-sm text-primary hover:underline">Zmień numer telefonu</button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
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
      onUploaded(publicUrl)
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

function AccountEditForm({ firstName, lastName, email, birthDate, onFirstName, onLastName, onBirthDate }: {
  firstName: string
  lastName: string
  email: string
  birthDate: Date | null
  onFirstName: (v: string) => void
  onLastName: (v: string) => void
  onBirthDate: (d: Date | null) => void
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
        <NotchedInput label={'E‑mail'} value={email} disabled />
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
