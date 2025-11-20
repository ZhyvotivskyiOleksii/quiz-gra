'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from '@/components/ui/form';
// Input kept for other components; not used here after NotchedInput migration
import NotchedInput from '@/components/ui/notched-input';
import PhoneInputField from '@/components/ui/phone-input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Smartphone } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';
import { getSupabase, setAuthPersistence } from '@/lib/supabaseClient';

type LoginFormProps = {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  initialEmail?: string;
  initialPassword?: string;
  notice?: string;
};

export function LoginForm({ onSuccess, onSwitchToRegister, initialEmail, initialPassword, notice }: LoginFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPhoneLogin, setIsPhoneLogin] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpPhone, setOtpPhone] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  // Polish-only labels

  const emailSchema = z.object({
    email: z.string().min(1, 'Email jest wymagany.').email({ message: 'Nieprawidłowy adres email.' }),
    password: z.string().min(1, { message: 'Hasło jest wymagane.' }),
    rememberMe: z.boolean().default(true),
    ageConfirmation: z.boolean().refine(val => val === true, {
      message: 'Musisz potwierdzić, że masz ukończone 18 lat i akceptujesz regulamin.',
    }),
    marketingConsent: z.boolean().default(true),
  });

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialEmail ?? '', password: initialPassword ?? '', rememberMe: true, ageConfirmation: true, marketingConsent: true },
    mode: 'onBlur',
  });

  React.useEffect(() => {
    form.reset({
      email: initialEmail ?? '',
      password: initialPassword ?? '',
      rememberMe: true,
      ageConfirmation: true,
      marketingConsent: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail, initialPassword])

  function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    (async () => {
      try {
        setIsLoading(true)
        // Respect "Pozostaw mnie zalogowanym"
        setAuthPersistence(values.rememberMe)
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })
        if (error || !data.session) throw error ?? new Error('Invalid credentials')
        // Sync server cookies so RSC (/app) sees the session immediately
        let ok = false
        try {
          await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
          })
          // Подождать, пока сервер увидит сессию
          for (let i = 0; i < 20; i++) {
            try {
              const ping = await fetch('/api/auth/ping', { credentials: 'include', cache: 'no-store' })
              const j = await ping.json().catch(() => ({}))
              if (j?.ok) { ok = true; break }
            } catch {}
            await new Promise((r) => setTimeout(r, 100))
          }
        } catch {}
        toast({ title: 'Zalogowano pomyślnie!' })
        // Use hard redirect to ensure server sees fresh auth cookies
        if (ok) {
          try {
            if (typeof window !== 'undefined') {
              window.location.assign('/app')
            } else {
              router.replace('/app')
            }
          } catch { router.replace('/app') }
        } else {
          toast({ title: 'Проблема сессии', description: 'Сервер не видит вход. Попробуйте ещё раз.', variant: 'destructive' as any })
          return
        }
        onSuccess?.()
      } catch (err: any) {
        const msg = typeof err?.message === 'string' ? err.message : ''
        const hint = /invalid login credentials/i.test(msg)
          ? 'Jeśli rejestrowałeś się przez telefon, e‑mail mógł nie być ustawiony jako główny. Spróbuj „Telefon” lub zresetuj hasło.'
          : msg
        toast({ title: 'Błędny email lub hasło', description: hint, variant: 'destructive' as any })
      } finally {
        setIsLoading(false)
      }
    })()
  }

  async function handleForgotPassword() {
    try {
      const emailVal = form.getValues('email')
      if (!emailVal) {
        toast({ title: 'Podaj email, aby zresetować hasło', variant: 'destructive' as any })
        return
      }
      const supabase = getSupabase();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '')
      await supabase.auth.resetPasswordForEmail(emailVal, {
        redirectTo: `${origin}/reset-password`,
      })
      toast({ title: 'Wysłaliśmy link resetu hasła na email.' })
    } catch (e: any) {
      toast({ title: 'Nie udało się wysłać resetu', description: e?.message ?? '', variant: 'destructive' as any })
    }
  }
  
  async function sendOtp() {
    try {
      setIsLoading(true)
      const phoneRaw = otpPhone.trim()
      const phone = (phoneRaw.startsWith('+') ? phoneRaw : `+${phoneRaw}`).replace(/[^\d+]/g, '')
      const supabase = getSupabase();
      // Allow auto‑creation to avoid confusing 422 errors when the phone isn't registered yet.
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true, channel: 'sms' as any },
      })
      if (error) throw error
      setOtpSent(true)
      toast({ title: 'Wysłano kod SMS.' })
    } catch (err: any) {
      const msg = typeof err?.message === 'string' && /signups not allowed/i.test(err.message)
        ? 'Numer nie jest zarejestrowany, a rejestracja jest wyłączona.'
        : (err?.message ?? 'Unknown error')
      toast({ title: 'SMS error', description: msg, variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  async function verifyOtp() {
    try {
      setIsLoading(true)
      const phone = (otpPhone.startsWith('+') ? otpPhone : `+${otpPhone}`).replace(/[^\d+]/g, '')
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: otpCode, type: 'sms' })
      if (error) throw error
      // Set default marketing consent for phone login if not set
      try { await supabase.auth.updateUser({ data: { marketing_consent: true } }) } catch {}
      // Sync server cookies
      let ok = false
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ event: 'SIGNED_IN', session: (data as any)?.session }),
        })
        for (let i = 0; i < 50; i++) {
          try {
            const ping = await fetch('/api/auth/ping', { credentials: 'include', cache: 'no-store' })
            const j = await ping.json().catch(() => ({}))
            if (j?.ok) { ok = true; break }
          } catch {}
          await new Promise((r) => setTimeout(r, 100))
        }
      } catch {}
      toast({ title: 'Zalogowano pomyślnie!' })
      if (ok) {
        try {
          if (typeof window !== 'undefined') {
            window.location.assign('/app')
          } else {
            router.replace('/app')
          }
        } catch { router.replace('/app') }
      } else {
        toast({ title: 'Проблема сессии', description: 'Сервер не видит вход. Попробуйте ещё раз.', variant: 'destructive' as any })
        return
      }
      onSuccess?.()
    } catch (err: any) {
      toast({ title: 'Nieprawidłowy kod.', description: err?.message ?? 'Invalid code', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }
  
  if (isPhoneLogin) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Logowanie przez SMS</h3>
          <Button variant="ghost" type="button" onClick={() => setIsPhoneLogin(false)}>Wróć do e-mail</Button>
        </div>
        <div className="space-y-3">
          <PhoneInputField
            id="login-phone"
            label={'Telefon'}
            value={otpPhone}
            onChange={(v) => setOtpPhone(v)}
          />
          {otpSent && (
            <NotchedInput
              type="text"
              label={'Kod z SMS'}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          )}
          {!otpSent ? (
            <Button className="w-full h-11 sm:h-12 text-base font-bold" onClick={sendOtp} disabled={isLoading || !otpPhone}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Wyślij kod
            </Button>
          ) : (
            <Button className="w-full h-11 sm:h-12 text-base font-bold" onClick={verifyOtp} disabled={isLoading || !otpCode}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Potwierdź kod
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-3 sm:space-y-4">
        {notice && (
          <div className="rounded-md border border-primary/40 bg-primary/10 text-primary px-3 py-2 text-sm">
            {notice}
          </div>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <NotchedInput
                  type="email"
                  autoComplete="email"
                  {...field}
                  error={!!fieldState.error}
                  label={renderLabel('Email', fieldState.error?.message, true)}
                />
              </FormControl>
              <FormMessage className="sr-only" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <NotchedInput
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...field}
                  error={!!fieldState.error}
                  label={renderLabel('Hasło', fieldState.error?.message, true)}
                  rightAdornment={
                    <Button
                      type="button"
                      aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  }
                />
              </FormControl>
              <FormMessage className="sr-only" />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                    <Switch
                        id="rememberMe"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                </FormControl>
                <Label htmlFor="rememberMe" className="font-normal pointer-events-auto">Pozostaw mnie zalogowanym</Label>
              </FormItem>
            )}
          />
          <button type="button" onClick={handleForgotPassword} className="text-sm text-primary hover:underline">
            Zapomniałem hasła
          </button>
        </div>
        
        <div className="space-y-3 sm:space-y-4 pt-4">
          <FormField
            control={form.control}
            name="ageConfirmation"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal leading-none pointer-events-auto">Mam ukończone 18 lat i akceptuję <a href="#" className="underline">Regulamin</a>.</FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="marketingConsent"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal leading-none pointer-events-auto">Zgoda marketingowa – (opcjonalnie)</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2 sm:space-y-3">
            <Button type="submit" className="w-full h-10 sm:h-11 text-base font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ZALOGUJ SIĘ
            </Button>
            <Button type="button" variant="secondary" className="w-full h-10 sm:h-11 text-base font-bold" onClick={onSwitchToRegister}>
                REJESTRACJA
            </Button>
        </div>
        
        <div className="relative pt-2">
            <Separator />
            <span className="absolute left-1/2 -top-1 -translate-x-1/2 bg-card px-2 text-muted-foreground text-sm">LUB</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="w-full h-11 sm:h-12 bg-background border-border"
            type="button"
            onClick={async () => {
              try {
                const supabase = getSupabase();
                const origin = (process.env.NEXT_PUBLIC_SITE_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '')
                await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })
              } catch (e) {
                toast({ title: 'Nie udało się rozpocząć logowania Google', variant: 'destructive' as any })
              }
            }}
          >
              <svg className="mr-2 h-4 w-4" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.6402 9.20455C17.6402 8.56636 17.5855 7.95455 17.4761 7.36364H9V10.8409H13.8436C13.6364 11.9659 13.0091 12.9318 12.0432 13.5682V15.7045H14.4761C16.3409 14.0455 17.6402 11.8318 17.6402 9.20455Z" fill="#4285F4"/>
                <path d="M9.00023 18C11.4332 18 13.4673 17.1818 14.4775 15.7045L12.0434 13.5682C11.2252 14.125 10.215 14.4545 9.00023 14.4545C6.88773 14.4545 5.15318 13.0114 4.54568 11.0568H2.0125V13.1591C3.05682 15.2273 5.79682 18 9.00023 18Z" fill="#34A853"/>
                <path d="M4.54541 11.0568C4.37041 10.5568 4.27609 10.0114 4.27609 9.45455C4.27609 8.89773 4.37041 8.35227 4.54541 7.85227V5.75H2.01245C1.04814 7.75 0.500227 9.45455 0.500227 11.375C0.500227 13.2955 1.04814 15.0000 2.01245 16.9545L4.54541 14.8523V11.0568Z" fill="#FBBC05"/>
                <path d="M9.00023 3.54545C10.3525 3.54545 11.508 4.02273 12.4411 4.91818L14.5229 2.84091C13.4659 1.84091 11.4318 0.909091 9.00023 0.909091C5.79682 0.909091 3.05682 2.77273 2.0125 4.84091L4.54545 6.94318C5.15318 4.98864 6.88773 3.54545 9.00023 3.54545Z" fill="#EA4335"/>
              </svg>
              Google
          </Button>
          <Button variant="outline" className="w-full h-10 sm:h-11 bg-background border-border" onClick={() => setIsPhoneLogin(true)} type="button">
            <Smartphone className="mr-2 h-4 w-4" />
            Telefon
          </Button>
        </div>
      </form>
    </Form>
  );
}
  const renderLabel = (text: string, error?: string) => (
    <span className="flex items-baseline gap-2 text-muted-foreground">
      <span>{text}</span>
      {error && <span className="text-xs font-semibold text-destructive">{error}</span>}
    </span>
  )
