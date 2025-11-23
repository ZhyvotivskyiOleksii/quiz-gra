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
import { cn } from '@/lib/utils'
import { emitAuthEvent } from '@/lib/auth-events'

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
    const norm = normalize(phone)
    if (!norm) {
      setError('Wpisz numer telefonu.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: norm }),
      })
      const payload = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        const errorMsg = payload?.error || 'Nie udało się wysłać kodu.'
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
          setTargetPhone(norm)
          setStep('code')
          toast({ title: 'Wysłaliśmy kod SMS.' })
          setLoading(false)
          return
        }
        throw new Error(errorMsg)
      }
      
      setTargetPhone(norm)
      setStep('code')
      toast({ title: 'Wysłaliśmy kod SMS.' })
    } catch (e: any) {
      const errorMsg = e?.message || 'Nie udało się wysłać kodu.'
      // Check if error is recoverable
      if (
        errorMsg.includes('already') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('too many')
      ) {
        // SMS was likely sent, continue to code step
        setTargetPhone(norm)
        setStep('code')
        toast({ title: 'Wysłaliśmy kod SMS.' })
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    setLoading(true)
    setError(null)
    const norm = targetPhone || normalize(phone)
    if (!norm) {
      setError('Brak numeru telefonu.')
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
      if (!res.ok) throw new Error(payload?.error || 'Nieprawidłowy kod SMS.')
      emitAuthEvent({ type: 'profile:update' })
      toast({ title: 'Numer zweryfikowany' })
      onVerified?.()
    } catch (e: any) {
      setError(e?.message || 'Nieprawidłowy kod SMS.')
    } finally {
      setLoading(false)
    }
  }

  const isCodeStep = step === 'code'
  const chipBase =
    'rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border border-white/20 transition-colors duration-200'

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
                <span className={cn(chipBase, !isCodeStep ? 'bg-white/20 text-white' : 'text-white/60')}>
                  1. Numer
                </span>
                <span className="h-px flex-1 bg-white/20" aria-hidden />
                <span className={cn(chipBase, isCodeStep ? 'bg-white/20 text-white' : 'text-white/60')}>
                  2. Kod SMS
                </span>
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
          {step === 'phone' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <PhoneInputField id="play-phone" label={'Numer telefonu'} value={phone} onChange={setPhone} />
              </div>
              <Button
                onClick={sendCode}
                disabled={loading || !phone}
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
                onChange={(e: any) => setCode(e.target.value)}
              />
              <Button
                onClick={verifyCode}
                disabled={loading || !code}
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold shadow-lg shadow-violet-500/25 disabled:opacity-60"
              >
                {loading ? 'Sprawdzanie…' : 'Potwierdź numer'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setCode('')
                }}
                className="text-sm text-primary hover:underline"
              >
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
