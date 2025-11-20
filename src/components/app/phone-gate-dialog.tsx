"use client"

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import PhoneInputField from '@/components/ui/phone-input'
import NotchedInput from '@/components/ui/notched-input'
import { getSupabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { AlertTriangle } from 'lucide-react'
import Image from 'next/image'

type PhoneGateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified?: () => void
}

export function PhoneGateDialog({ open, onOpenChange, onVerified }: PhoneGateDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = React.useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [targetPhone, setTargetPhone] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setStep('phone')
      setPhone('')
      setCode('')
      setLoading(false)
      setTargetPhone(null)
      setError(null)
      return
    }
    ;(async () => {
      try {
        const supabase = getSupabase()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const existing = (user as any)?.phone || (user?.user_metadata as any)?.phone
        if (existing) setPhone(existing)
      } catch {}
    })()
  }, [open])

  function normalize(phoneValue: string) {
    if (!phoneValue) return ''
    const trimmed = phoneValue.startsWith('+') ? phoneValue : `+${phoneValue}`
    return trimmed.replace(/[^\d+]/g, '')
  }

  async function sendCode() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      const norm = normalize(phone)
      if (!norm) {
        setError('Wpisz numer telefonu.')
        return
      }
      const { error } = await supabase.auth.updateUser({ phone: norm })
      if (error) throw error
      setTargetPhone(norm)
      setStep('code')
      toast({ title: 'Wysłaliśmy kod SMS.' })
    } catch (e: any) {
      setError(e?.message || 'Nie udało się wysłać kodu.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      const norm = targetPhone || normalize(phone)
      if (!norm) throw new Error('Brak numeru telefonu.')
      const { error } = await supabase.auth.verifyOtp({ phone: norm, token: code, type: 'phone_change' as any })
      if (error) throw error
      toast({ title: 'Numer zweryfikowany' })
      onVerified?.()
    } catch (e: any) {
      setError(e?.message || 'Nieprawidłowy kod SMS.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden border border-white/10 bg-[rgba(12,10,25,0.96)] backdrop-blur-lg p-0 text-white rounded-[22px] shadow-[0_40px_100px_rgba(6,3,20,0.65)]">
        <div className="relative flex items-start justify-between gap-4 rounded-t-[22px] bg-gradient-to-r from-white/10 via-white/0 to-transparent px-6 pt-14 pr-28 pb-6">
          <div className="mt-4 sm:mt-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-2xl font-headline font-extrabold uppercase tracking-wide">Zweryfikuj telefon</DialogTitle>
              <DialogDescription className="text-sm text-white/80">
                Podaj numer telefonu i potwierdź go kodem SMS, aby kontynuować grę.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="relative h-16 w-16 shrink-0">
            <Image
              src="/icon/ver-sms.webp"
              alt=""
              width={80}
              height={80}
              className="object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.35)] rounded-[28px]"
            />
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
        {step === 'phone' ? (
          <div className="space-y-4">
            <PhoneInputField id="play-phone" label={'Numer telefonu'} value={phone} onChange={setPhone} />
            <Button onClick={sendCode} disabled={loading || !phone} className="h-11 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-violet-500 text-white font-semibold shadow-lg shadow-rose-500/25">
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
              onChange={(e: any) => setCode(e.target.value)}
            />
            <Button onClick={verifyCode} disabled={loading || !code} className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold shadow-lg shadow-violet-500/25">
              {loading ? 'Sprawdzanie…' : 'Potwierdź numer'}
            </Button>
            <button type="button" onClick={() => { setStep('phone'); setCode('') }} className="text-sm text-primary hover:underline">
              Zmień numer telefonu
            </button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PhoneGateDialog
